from __future__ import annotations

import logging
import time
from collections.abc import Callable
from sqlalchemy.orm import Session

from .config import SysadminGradingSettings
from .executor import GradingExecutionError
from .queue import GradingQueueError, GradingQueueMessage, SQSGradingQueue
from .service import SysadminGradingService


logger = logging.getLogger(__name__)


class SysadminGradingDispatcher:
    """
    Durable SQS consumer for Linux Sysadmin grading.

    SQS is deliberately treated as at-least-once. The submission row is the
    authoritative state machine and must be claimed before trusted grading work
    begins. A duplicate delivery therefore cannot create another academic row.
    """

    def __init__(
        self,
        *,
        settings: SysadminGradingSettings,
        session_factory: Callable[[], Session],
        queue: SQSGradingQueue | None = None,
        grading_service: SysadminGradingService | None = None,
    ) -> None:
        settings.assert_queue_ready()
        self.settings = settings
        self.session_factory = session_factory
        self.queue = queue or SQSGradingQueue(settings)
        self.service = grading_service or SysadminGradingService(settings)

    def _recover_outbox(self) -> None:
        db = self.session_factory()
        try:
            recovered = self.service.recover_unpublished_submissions(
                db,
                queue=self.queue,
                limit=25,
            )
            if recovered:
                logger.info("Recovered %d unpublished Sysadmin grading job(s).", recovered)
        except Exception:
            db.rollback()
            logger.exception("Sysadmin grading outbox recovery failed")
        finally:
            db.close()

    def _record_received_message(self, db: Session, message: GradingQueueMessage) -> None:
        self.service.record_queue_delivery(
            db,
            submission_id=message.submission_id,
            message_id=message.message_id,
        )

    def _delete_message(self, message: GradingQueueMessage) -> None:
        try:
            self.queue.delete(message.receipt_handle)
        except GradingQueueError:
            # PASS/FAIL is already durable before this is called. A failed SQS
            # acknowledgement is therefore safe: the redelivery sees the
            # terminal DB row and retries DeleteMessage without regrading.
            logger.exception(
                "Unable to acknowledge grading message submission_id=%s; redelivery is safe",
                message.submission_id,
            )

    def run_once(self) -> bool:
        """Process at most one SQS message. Returns True when a message was received."""
        self._recover_outbox()

        try:
            message = self.queue.receive_one()
        except GradingQueueError:
            logger.exception("Unable to receive Sysadmin grading queue message")
            return False

        if message is None:
            return False

        db = self.session_factory()
        try:
            self._record_received_message(db, message)
            row = self.service.get_submission(db, message.submission_id)
            if row is None:
                logger.warning(
                    "Deleting Sysadmin grading message for missing submission_id=%s",
                    message.submission_id,
                )
                self._delete_message(message)
                return True

            status = str(row.status or "").upper()
            if status in self.service.ACADEMIC_TERMINAL_STATUSES:
                # Completion was already durably persisted; this is a duplicate
                # delivery or a DeleteMessage retry.
                self._delete_message(message)
                return True

            if status in self.service.INFRA_TERMINAL_STATUSES:
                # Final infrastructure failures are deliberately left for the
                # queue redrive policy so the message reaches the DLQ.
                logger.warning(
                    "Leaving terminal infrastructure failure submission_id=%s for DLQ redrive",
                    row.id,
                )
                return True

            claimed = self.service.claim_submission(
                db,
                submission_id=row.id,
                lease_seconds=self.settings.grading_queue_visibility_seconds,
            )
            if claimed is None:
                # Another dispatcher may own a live DB lease. Never acknowledge an
                # active duplicate here: with at-least-once delivery it may be the
                # only queue copy left if the current owner dies before committing
                # PASS/FAIL. The ReceiveMessage visibility timeout already keeps
                # this copy out of circulation long enough for the live lease to
                # finish or expire; a later redelivery can then either delete the
                # terminal result or reclaim expired work.
                current = self.service.get_submission(db, row.id)
                if current and str(current.status).upper() in self.service.ACTIVE_STATUSES:
                    logger.info(
                        "Deferring duplicate in-flight grading delivery submission_id=%s",
                        row.id,
                    )
                elif current and str(current.status).upper() in self.service.ACADEMIC_TERMINAL_STATUSES:
                    self._delete_message(message)
                return True

            token = claimed.processing_token
            logger.info(
                "Claimed Sysadmin submission_id=%s attempt=%s receive_count=%s",
                claimed.id,
                claimed.attempt_count,
                message.receive_count,
            )

            try:
                completed = self.service.execute_claimed_submission(
                    db,
                    submission_id=claimed.id,
                    processing_token=str(token),
                )
            except Exception as exc:
                db.rollback()
                final_attempt = message.receive_count >= self.settings.grading_queue_max_receives
                timed_out = isinstance(exc, GradingExecutionError) and exc.timed_out
                worker_exit_code = (
                    exc.worker_exit_code if isinstance(exc, GradingExecutionError) else None
                )
                try:
                    self.service.record_infrastructure_failure(
                        db,
                        submission_id=claimed.id,
                        processing_token=str(token),
                        error=exc,
                        final=final_attempt,
                        timed_out=timed_out,
                        worker_exit_code=worker_exit_code,
                    )
                except Exception:
                    db.rollback()
                    logger.exception(
                        "Failed to persist infrastructure failure submission_id=%s",
                        claimed.id,
                    )
                    # Do not acknowledge; SQS will redeliver.
                    return True

                if final_attempt:
                    logger.error(
                        "Sysadmin submission_id=%s exhausted infrastructure retries; leaving for DLQ",
                        claimed.id,
                    )
                    return True

                logger.warning(
                    "Retryable Sysadmin grading failure submission_id=%s: %s",
                    claimed.id,
                    exc,
                )
                try:
                    self.queue.retry_later(message.receipt_handle)
                except GradingQueueError:
                    logger.exception(
                        "Unable to shorten retry visibility submission_id=%s; default visibility remains",
                        claimed.id,
                    )
                return True

            if str(completed.status).upper() not in self.service.ACADEMIC_TERMINAL_STATUSES:
                raise RuntimeError(
                    f"Grading completed without academic terminal state: {completed.status}"
                )

            # Delete only after PASS/FAIL and rubric evidence are durably committed.
            self._delete_message(message)
            return True
        finally:
            db.close()

    def run_forever(self) -> None:
        logger.info(
            "Sysadmin grading dispatcher started queue=%s region=%s",
            self.settings.grading_queue_url,
            self.settings.aws_region,
        )
        while True:
            if not self.run_once():
                # ReceiveMessage already long-polls during healthy idle periods.
                # This short backoff mainly prevents a tight loop during SQS/IAM
                # outages or malformed-message redrive cycles.
                time.sleep(2)
