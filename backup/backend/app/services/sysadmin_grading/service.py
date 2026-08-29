from __future__ import annotations

import hashlib
import json
import logging
import secrets
import uuid
from datetime import datetime, timedelta
from pathlib import PurePath
from typing import Any

from sqlalchemy import and_, func, or_
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.models.sysadmin_submission import SysadminSubmission

from .config import GradingConfigurationError, SysadminGradingSettings
from .executor import GradingExecution, GradingExecutionError, build_grading_executor
from .question_bank import QuestionBankError, QuestionBankRepository
from .queue import GradingQueueError, SQSGradingQueue


logger = logging.getLogger(__name__)


class SubmissionValidationError(ValueError):
    pass


class IdempotencyConflictError(ValueError):
    pass


class SysadminGradingService:
    ACADEMIC_TERMINAL_STATUSES = frozenset({"PASS", "FAIL"})
    INFRA_TERMINAL_STATUSES = frozenset({"ERROR", "TIMED_OUT"})
    TERMINAL_STATUSES = ACADEMIC_TERMINAL_STATUSES | INFRA_TERMINAL_STATUSES
    ACTIVE_STATUSES = frozenset({"QUEUED", "STARTING", "RUNNING"})

    def __init__(self, settings: SysadminGradingSettings | None = None) -> None:
        self.settings = settings or SysadminGradingSettings.from_env()
        self.repository = QuestionBankRepository(self.settings.question_bank_root)
        self.executor = build_grading_executor(self.settings, self.repository)

    def validate_submission(self, *, lab_id: str, filename: str, content: str) -> None:
        encoded = content.encode("utf-8")
        if not content.strip():
            raise SubmissionValidationError("Submission is empty.")
        if len(encoded) > self.settings.max_submission_bytes:
            raise SubmissionValidationError(
                f"Submission exceeds {self.settings.max_submission_bytes} bytes."
            )
        if "\x00" in content:
            raise SubmissionValidationError("Submission contains a NUL byte.")

        # The client sends only the basename. Never allow a caller to choose a
        # host-side path used by the grading subprocess.
        if not filename or PurePath(filename).name != filename:
            raise SubmissionValidationError("filename must be a basename, not a path.")
        if filename in {".", ".."} or len(filename) > 128:
            raise SubmissionValidationError("Invalid submission filename.")
        if not filename.endswith(".sh"):
            raise SubmissionValidationError("Sysadmin submissions must use a .sh filename.")

        try:
            self.repository.resolve_lab(lab_id)
        except QuestionBankError as exc:
            raise SubmissionValidationError(str(exc)) from exc

    @staticmethod
    def normalize_idempotency_key(value: str) -> str:
        raw = (value or "").strip()
        try:
            parsed = uuid.UUID(raw)
        except (ValueError, AttributeError) as exc:
            raise SubmissionValidationError(
                "Idempotency-Key must be a UUID generated once per logical submission."
            ) from exc
        return str(parsed)

    @staticmethod
    def student_view(row: SysadminSubmission) -> dict[str, Any]:
        tests: list[dict[str, Any]] = []
        if row.result_json:
            try:
                raw = json.loads(row.result_json)
                tests = raw.get("tests", []) if isinstance(raw, dict) else []
            except Exception:
                tests = []

        status = str(row.status or "").upper()
        return {
            "submission_id": row.id,
            "lab_id": row.lab_id,
            "filename": row.filename,
            "status": status,
            "score": row.score,
            "max_score": row.max_score,
            "pass_score": row.pass_score,
            "passed": row.passed,
            "tests": tests,
            "submitted_at": row.submitted_at,
            "started_at": row.started_at,
            "completed_at": row.completed_at,
            "graded_at": row.graded_at,
            "error": (
                "Grading infrastructure error. Contact your instructor with this submission ID."
                if status in SysadminGradingService.INFRA_TERMINAL_STATUSES
                else None
            ),
        }

    @staticmethod
    def _submission_hash(content: str) -> str:
        return hashlib.sha256(content.encode("utf-8")).hexdigest()

    @staticmethod
    def _same_logical_request(
        row: SysadminSubmission,
        *,
        lab_id: str,
        filename: str,
        content: str,
        submission_hash: str,
    ) -> bool:
        return (
            row.lab_id == lab_id
            and row.filename == filename
            and row.submission_sha256 == submission_hash
            and row.submission_content == content
        )

    def _new_submission(
        self,
        *,
        student_id: int,
        lab_id: str,
        filename: str,
        content: str,
        status: str,
        idempotency_key: str | None = None,
    ) -> SysadminSubmission:
        return SysadminSubmission(
            student_id=student_id,
            lab_id=lab_id,
            filename=filename,
            submission_content=content,
            submission_sha256=self._submission_hash(content),
            seed=secrets.randbelow(2**31 - 1),
            status=status,
            idempotency_key=idempotency_key,
        )

    def _apply_execution_result(
        self,
        row: SysadminSubmission,
        execution: GradingExecution,
    ) -> None:
        result = execution.result
        metadata = result.get("metadata", {})

        row.status = "PASS" if bool(result["passed"]) else "FAIL"
        row.runner_version = str(result.get("runner_version", "")) or None
        row.lab_version = str(result.get("lab_version", "")) or None
        row.question_bank_commit = execution.question_bank_commit
        row.lab_package_sha256 = metadata.get("lab_package_sha256")
        row.grader_image = metadata.get("image")
        row.grader_image_id = metadata.get("image_id")
        row.score = int(result["score"])
        row.max_score = int(result["max_score"])
        row.pass_score = int(result["pass_score"])
        row.passed = bool(result["passed"])
        row.result_json = json.dumps(result, separators=(",", ":"))
        row.runner_stdout = execution.runner_stdout
        row.runner_stderr = execution.runner_stderr
        if execution.task_arn:
            row.ecs_task_arn = execution.task_arn
        if execution.worker_exit_code is not None:
            row.worker_exit_code = execution.worker_exit_code
        row.error_message = None
        row.processing_token = None
        row.lease_expires_at = None
        row.mark_graded()

    def _mark_running(
        self,
        db: Session,
        *,
        submission_id: int,
        processing_token: str,
        task_arn: str | None = None,
    ) -> None:
        values: dict[Any, Any] = {SysadminSubmission.status: "RUNNING"}
        if task_arn:
            values[SysadminSubmission.ecs_task_arn] = task_arn
        updated = (
            db.query(SysadminSubmission)
            .filter(
                SysadminSubmission.id == submission_id,
                SysadminSubmission.processing_token == processing_token,
            )
            .update(values, synchronize_session=False)
        )
        if updated != 1:
            db.rollback()
            raise GradingExecutionError(
                f"Submission {submission_id} lost its dispatcher lease before grading started."
            )
        db.commit()

    def _cleanup_async_transport(self, row: SysadminSubmission) -> None:
        cleanup_job = getattr(self.executor, "cleanup_job", None)
        if not callable(cleanup_job):
            return
        try:
            cleanup_job(lab_id=row.lab_id, job_id=f"submission-{row.id}")
        except Exception:
            logger.warning(
                "Unable to clean transient grading transport submission_id=%s",
                row.id,
                exc_info=True,
            )

    # ------------------------------------------------------------------
    # v0.5-compatible synchronous endpoint support
    # ------------------------------------------------------------------
    def grade_submission(
        self,
        db: Session,
        *,
        student_id: int,
        lab_id: str,
        filename: str,
        content: str,
    ) -> SysadminSubmission:
        self.settings.assert_ready()
        self.validate_submission(lab_id=lab_id, filename=filename, content=content)
        lab = self.repository.resolve_lab(lab_id)

        row = self._new_submission(
            student_id=student_id,
            lab_id=lab_id,
            filename=filename,
            content=content,
            status="STARTING",
        )
        row.attempt_count = 1
        row.started_at = datetime.utcnow()
        db.add(row)
        db.commit()
        db.refresh(row)

        sync_token = uuid.uuid4().hex
        row.processing_token = sync_token
        db.commit()

        try:
            self._mark_running(
                db,
                submission_id=row.id,
                processing_token=sync_token,
            )
            execution = self.executor.grade(
                lab=lab,
                filename=filename,
                content=content,
                seed=row.seed,
                task_started=lambda arn: self._mark_running(
                    db,
                    submission_id=row.id,
                    processing_token=sync_token,
                    task_arn=arn,
                ),
            )
            db.refresh(row)
            self._apply_execution_result(row, execution)
            db.commit()
            db.refresh(row)
            return row

        except (GradingExecutionError, QuestionBankError, GradingConfigurationError) as exc:
            db.rollback()
            row = db.query(SysadminSubmission).filter(SysadminSubmission.id == row.id).one()
            row.status = "TIMED_OUT" if isinstance(exc, GradingExecutionError) and exc.timed_out else "ERROR"
            row.error_message = str(exc)[:8000]
            if isinstance(exc, GradingExecutionError):
                if exc.task_arn:
                    row.ecs_task_arn = exc.task_arn
                if exc.worker_exit_code is not None:
                    row.worker_exit_code = exc.worker_exit_code
            row.processing_token = None
            row.lease_expires_at = None
            row.mark_graded()
            db.commit()
            db.refresh(row)
            return row
        except Exception as exc:
            db.rollback()
            row = db.query(SysadminSubmission).filter(SysadminSubmission.id == row.id).one()
            row.status = "ERROR"
            row.error_message = f"Unexpected grading failure: {exc}"[:8000]
            row.processing_token = None
            row.lease_expires_at = None
            row.mark_graded()
            db.commit()
            db.refresh(row)
            return row

    # ------------------------------------------------------------------
    # v0.6 durable asynchronous workspace submission
    # ------------------------------------------------------------------
    def accept_submission(
        self,
        db: Session,
        *,
        student_id: int,
        lab_id: str,
        filename: str,
        content: str,
        idempotency_key: str,
        queue: SQSGradingQueue | None = None,
    ) -> SysadminSubmission:
        self.settings.assert_queue_ready()
        self.validate_submission(lab_id=lab_id, filename=filename, content=content)
        normalized_key = self.normalize_idempotency_key(idempotency_key)
        submission_hash = self._submission_hash(content)

        existing = (
            db.query(SysadminSubmission)
            .filter(
                SysadminSubmission.student_id == student_id,
                SysadminSubmission.idempotency_key == normalized_key,
            )
            .first()
        )
        if existing is not None:
            if not self._same_logical_request(
                existing,
                lab_id=lab_id,
                filename=filename,
                content=content,
                submission_hash=submission_hash,
            ):
                raise IdempotencyConflictError(
                    "Idempotency-Key was already used for a different submission."
                )
            self.ensure_enqueued(db, existing, queue=queue)
            db.refresh(existing)
            return existing

        row = self._new_submission(
            student_id=student_id,
            lab_id=lab_id,
            filename=filename,
            content=content,
            status="QUEUED",
            idempotency_key=normalized_key,
        )
        db.add(row)
        try:
            db.commit()
            db.refresh(row)
        except IntegrityError:
            # Concurrent retries with the same key race on the unique constraint.
            db.rollback()
            existing = (
                db.query(SysadminSubmission)
                .filter(
                    SysadminSubmission.student_id == student_id,
                    SysadminSubmission.idempotency_key == normalized_key,
                )
                .first()
            )
            if existing is None:
                raise
            if not self._same_logical_request(
                existing,
                lab_id=lab_id,
                filename=filename,
                content=content,
                submission_hash=submission_hash,
            ):
                raise IdempotencyConflictError(
                    "Idempotency-Key was already used for a different submission."
                )
            row = existing

        # The submission row is a tiny transactional outbox. A publish failure
        # does not lose the accepted job: queue_message_id stays NULL and the
        # dispatcher recovery sweep republishes it later.
        self.ensure_enqueued(db, row, queue=queue)
        db.refresh(row)
        return row

    def ensure_enqueued(
        self,
        db: Session,
        row: SysadminSubmission,
        *,
        queue: SQSGradingQueue | None = None,
    ) -> bool:
        if row.queue_message_id:
            return True
        queue = queue or SQSGradingQueue(self.settings)
        try:
            message_id = queue.send_job(row.id)
        except GradingQueueError as exc:
            row.error_message = f"Queue publish pending: {exc}"[:8000]
            db.commit()
            logger.warning(
                "Accepted Sysadmin submission_id=%s but SQS publish is pending: %s",
                row.id,
                exc,
            )
            return False

        row.queue_message_id = message_id
        row.enqueued_at = datetime.utcnow()
        row.error_message = None
        db.commit()
        return True

    def recover_unpublished_submissions(
        self,
        db: Session,
        *,
        queue: SQSGradingQueue,
        limit: int = 25,
    ) -> int:
        rows = (
            db.query(SysadminSubmission)
            .filter(
                SysadminSubmission.status == "QUEUED",
                SysadminSubmission.queue_message_id.is_(None),
            )
            .order_by(SysadminSubmission.id.asc())
            .limit(max(1, min(limit, 100)))
            .all()
        )
        recovered = 0
        for row in rows:
            if self.ensure_enqueued(db, row, queue=queue):
                recovered += 1
        return recovered

    def record_queue_delivery(
        self,
        db: Session,
        *,
        submission_id: int,
        message_id: str,
    ) -> None:
        row = db.query(SysadminSubmission).filter(SysadminSubmission.id == submission_id).first()
        if row is None or row.queue_message_id:
            return
        row.queue_message_id = message_id
        row.enqueued_at = row.enqueued_at or datetime.utcnow()
        db.commit()

    @staticmethod
    def get_submission(db: Session, submission_id: int) -> SysadminSubmission | None:
        return db.query(SysadminSubmission).filter(SysadminSubmission.id == submission_id).first()

    def claim_submission(
        self,
        db: Session,
        *,
        submission_id: int,
        lease_seconds: int,
    ) -> SysadminSubmission | None:
        now = datetime.utcnow()
        lease_until = now + timedelta(seconds=max(60, lease_seconds))
        token = uuid.uuid4().hex

        eligible = or_(
            SysadminSubmission.status == "QUEUED",
            and_(
                SysadminSubmission.status.in_(("STARTING", "RUNNING")),
                or_(
                    SysadminSubmission.lease_expires_at.is_(None),
                    SysadminSubmission.lease_expires_at < now,
                ),
            ),
        )
        updated = (
            db.query(SysadminSubmission)
            .filter(SysadminSubmission.id == submission_id, eligible)
            .update(
                {
                    SysadminSubmission.status: "STARTING",
                    SysadminSubmission.attempt_count: SysadminSubmission.attempt_count + 1,
                    SysadminSubmission.processing_token: token,
                    SysadminSubmission.lease_expires_at: lease_until,
                    SysadminSubmission.started_at: func.coalesce(
                        SysadminSubmission.started_at,
                        now,
                    ),
                },
                synchronize_session=False,
            )
        )
        if updated != 1:
            db.rollback()
            return None
        db.commit()
        return db.query(SysadminSubmission).filter(SysadminSubmission.id == submission_id).one()

    def execute_claimed_submission(
        self,
        db: Session,
        *,
        submission_id: int,
        processing_token: str,
    ) -> SysadminSubmission:
        row = (
            db.query(SysadminSubmission)
            .filter(
                SysadminSubmission.id == submission_id,
                SysadminSubmission.processing_token == processing_token,
            )
            .first()
        )
        if row is None:
            raise GradingExecutionError(
                f"Submission {submission_id} is no longer owned by this dispatcher."
            )

        lab = self.repository.resolve_lab(row.lab_id)
        job_id = f"submission-{row.id}"
        self._mark_running(
            db,
            submission_id=row.id,
            processing_token=processing_token,
            task_arn=row.ecs_task_arn,
        )
        db.refresh(row)

        resume = getattr(self.executor, "resume", None)
        if row.ecs_task_arn and callable(resume):
            execution = resume(
                lab=lab,
                task_arn=row.ecs_task_arn,
                job_id=job_id,
                cleanup=False,
            )
        else:
            execution = self.executor.grade(
                lab=lab,
                filename=row.filename,
                content=row.submission_content,
                seed=row.seed,
                job_id=job_id,
                task_started=lambda arn: self._mark_running(
                    db,
                    submission_id=row.id,
                    processing_token=processing_token,
                    task_arn=arn,
                ),
                cleanup=False,
            )

        row = (
            db.query(SysadminSubmission)
            .filter(
                SysadminSubmission.id == submission_id,
                SysadminSubmission.processing_token == processing_token,
            )
            .first()
        )
        if row is None:
            raise GradingExecutionError(
                f"Submission {submission_id} lost its dispatcher lease before result persistence."
            )

        self._apply_execution_result(row, execution)
        db.commit()
        db.refresh(row)
        self._cleanup_async_transport(row)
        return row

    def record_infrastructure_failure(
        self,
        db: Session,
        *,
        submission_id: int,
        processing_token: str,
        error: Exception,
        final: bool,
        timed_out: bool = False,
        worker_exit_code: int | None = None,
    ) -> SysadminSubmission | None:
        row = (
            db.query(SysadminSubmission)
            .filter(
                SysadminSubmission.id == submission_id,
                SysadminSubmission.processing_token == processing_token,
            )
            .first()
        )
        if row is None:
            return None

        row.error_message = str(error)[:8000]
        if worker_exit_code is not None:
            row.worker_exit_code = worker_exit_code

        if isinstance(error, GradingExecutionError) and error.task_arn:
            row.ecs_task_arn = error.task_arn

        # A stopped/timed-out worker cannot be resumed usefully. Other transport
        # failures preserve ecs_task_arn so redelivery can inspect the same task.
        if timed_out or worker_exit_code not in (None, 0):
            row.ecs_task_arn = None

        row.processing_token = None
        row.lease_expires_at = None
        if final:
            row.status = "TIMED_OUT" if timed_out else "ERROR"
            row.mark_graded()
        else:
            row.status = "QUEUED"

        db.commit()
        db.refresh(row)
        return row
