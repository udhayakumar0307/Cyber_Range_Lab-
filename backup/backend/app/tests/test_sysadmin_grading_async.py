from __future__ import annotations

import tempfile
import unittest
import uuid
from datetime import datetime, timedelta
from pathlib import Path
from unittest.mock import patch

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

# Register the FK target table in SQLAlchemy metadata; the tests do not need to
# create/populate users because SQLite FK enforcement is disabled by default.
from app.models.user import User  # noqa: F401
from app.models.sysadmin_submission import SysadminSubmission
from app.services.sysadmin_grading.config import SysadminGradingSettings
from app.services.sysadmin_grading.dispatcher import SysadminGradingDispatcher
from app.services.sysadmin_grading.executor import GradingExecution, GradingExecutionError
from app.services.sysadmin_grading.queue import GradingQueueError, GradingQueueMessage
from app.services.sysadmin_grading.service import (
    IdempotencyConflictError,
    SysadminGradingService,
)


class FakeQueue:
    def __init__(self, *, fail: bool = False):
        self.fail = fail
        self.sent: list[int] = []

    def send_job(self, submission_id: int) -> str:
        if self.fail:
            raise GradingQueueError("simulated SQS outage")
        self.sent.append(submission_id)
        return f"message-{submission_id}-{len(self.sent)}"


class FakeExecutor:
    def __init__(self, *, passed: bool = False, score: int = 60):
        self.passed = passed
        self.score = score
        self.grade_calls = 0
        self.cleaned: list[tuple[str, str]] = []

    def grade(self, *, lab, filename, content, seed, job_id=None, task_started=None, cleanup=True):
        self.grade_calls += 1
        if task_started:
            task_started("arn:aws:ecs:ap-south-1:123:task/grading/task-1")
        return GradingExecution(
            result={
                "contract_version": 1,
                "runner_version": "test",
                "lab_id": lab.lab_id,
                "title": "Test",
                "lab_version": "1",
                "score": self.score,
                "max_score": 100,
                "pass_score": 70,
                "passed": self.passed,
                "tests": [],
                "metadata": {},
            },
            runner_stdout="ok",
            runner_stderr="",
            question_bank_commit="deadbeef",
            task_arn="arn:aws:ecs:ap-south-1:123:task/grading/task-1",
            worker_exit_code=0,
        )

    def cleanup_job(self, *, lab_id: str, job_id: str) -> None:
        self.cleaned.append((lab_id, job_id))


class FailingExecutor:
    def __init__(self, error: Exception):
        self.error = error
        self.grade_calls = 0

    def grade(self, **kwargs):
        self.grade_calls += 1
        raise self.error


class FakeDispatcherQueue(FakeQueue):
    def __init__(self, message: GradingQueueMessage):
        super().__init__()
        self.message = message
        self.deleted: list[str] = []
        self.retried: list[str] = []

    def receive_one(self):
        message, self.message = self.message, None
        return message

    def delete(self, receipt_handle: str) -> None:
        self.deleted.append(receipt_handle)

    def retry_later(self, receipt_handle: str) -> None:
        self.retried.append(receipt_handle)


class SysadminAsyncGradingTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.root = Path(self.tmp.name)
        lab = self.root / "labs" / "01-shell" / "RHSA-SHELL-001"
        lab.mkdir(parents=True)
        for name in ("lab.yaml", "setup.sh", "grader.py", "question.md"):
            (lab / name).write_text("test\n", encoding="utf-8")
        (self.root / "grader").mkdir()

        self.settings = SysadminGradingSettings(
            enabled=True,
            question_bank_root=self.root,
            python_bin="python3",
            execution_timeout_seconds=120,
            max_submission_bytes=65536,
            grading_queue_url=(
                "https://sqs.ap-south-1.amazonaws.com/123/cyberrange-sysadmin-grading-jobs"
            ),
        )
        self.service = SysadminGradingService(self.settings)

        self.engine = create_engine("sqlite:///:memory:")
        SysadminSubmission.__table__.create(self.engine)
        self.Session = sessionmaker(bind=self.engine)
        self.db = self.Session()

        self.ready_patch = patch.object(
            SysadminGradingSettings,
            "assert_queue_ready",
            return_value=None,
        )
        self.ready_patch.start()

    def tearDown(self):
        self.ready_patch.stop()
        self.db.close()
        self.engine.dispose()
        self.tmp.cleanup()

    def _accept(self, queue: FakeQueue, *, key: str | None = None, content: str = "echo ok\n"):
        return self.service.accept_submission(
            self.db,
            student_id=42,
            lab_id="RHSA-SHELL-001",
            filename="answer.sh",
            content=content,
            idempotency_key=key or str(uuid.uuid4()),
            queue=queue,
        )

    def test_same_idempotency_key_returns_same_row_and_only_one_sqs_send(self):
        queue = FakeQueue()
        key = str(uuid.uuid4())
        first = self._accept(queue, key=key)
        second = self._accept(queue, key=key)

        self.assertEqual(first.id, second.id)
        self.assertEqual(first.status, "QUEUED")
        self.assertEqual(queue.sent, [first.id])
        self.assertEqual(self.db.query(SysadminSubmission).count(), 1)

    def test_idempotency_key_reuse_with_different_payload_is_conflict(self):
        queue = FakeQueue()
        key = str(uuid.uuid4())
        self._accept(queue, key=key, content="echo one\n")

        with self.assertRaises(IdempotencyConflictError):
            self._accept(queue, key=key, content="echo two\n")

        self.assertEqual(self.db.query(SysadminSubmission).count(), 1)
        self.assertEqual(len(queue.sent), 1)

    def test_failed_sqs_publish_is_recovered_from_durable_db_outbox(self):
        queue = FakeQueue(fail=True)
        row = self._accept(queue)
        self.assertEqual(row.status, "QUEUED")
        self.assertIsNone(row.queue_message_id)

        queue.fail = False
        recovered = self.service.recover_unpublished_submissions(
            self.db,
            queue=queue,
        )
        self.db.refresh(row)
        self.assertEqual(recovered, 1)
        self.assertEqual(queue.sent, [row.id])
        self.assertIsNotNone(row.queue_message_id)
        self.assertIsNotNone(row.enqueued_at)

    def test_live_dispatcher_lease_blocks_duplicate_claim_then_expired_lease_recovers(self):
        row = self._accept(FakeQueue())
        first = self.service.claim_submission(
            self.db,
            submission_id=row.id,
            lease_seconds=900,
        )
        self.assertIsNotNone(first)
        self.assertEqual(first.status, "STARTING")
        self.assertEqual(first.attempt_count, 1)
        first_token = str(first.processing_token)

        duplicate = self.service.claim_submission(
            self.db,
            submission_id=row.id,
            lease_seconds=900,
        )
        self.assertIsNone(duplicate)

        row = self.db.query(SysadminSubmission).filter_by(id=row.id).one()
        row.status = "RUNNING"
        row.lease_expires_at = datetime.utcnow() - timedelta(seconds=1)
        self.db.commit()

        recovered = self.service.claim_submission(
            self.db,
            submission_id=row.id,
            lease_seconds=900,
        )
        self.assertIsNotNone(recovered)
        self.assertEqual(recovered.attempt_count, 2)
        self.assertNotEqual(first_token, recovered.processing_token)

    def test_claimed_academic_fail_persists_fail_and_cleans_transport_after_commit(self):
        row = self._accept(FakeQueue())
        claimed = self.service.claim_submission(
            self.db,
            submission_id=row.id,
            lease_seconds=900,
        )
        fake_executor = FakeExecutor(passed=False, score=60)
        self.service.executor = fake_executor

        completed = self.service.execute_claimed_submission(
            self.db,
            submission_id=row.id,
            processing_token=str(claimed.processing_token),
        )

        self.assertEqual(completed.status, "FAIL")
        self.assertFalse(completed.passed)
        self.assertEqual(completed.score, 60)
        self.assertEqual(completed.worker_exit_code, 0)
        self.assertIsNotNone(completed.completed_at)
        self.assertEqual(fake_executor.grade_calls, 1)
        self.assertEqual(
            fake_executor.cleaned,
            [("RHSA-SHELL-001", f"submission-{row.id}")],
        )

    def test_infrastructure_failure_requeues_then_final_worker_error_is_error(self):
        row = self._accept(FakeQueue())
        first = self.service.claim_submission(
            self.db,
            submission_id=row.id,
            lease_seconds=900,
        )
        retry = self.service.record_infrastructure_failure(
            self.db,
            submission_id=row.id,
            processing_token=str(first.processing_token),
            error=GradingExecutionError("temporary ECS error"),
            final=False,
        )
        self.assertEqual(retry.status, "QUEUED")
        self.assertIsNone(retry.processing_token)

        second = self.service.claim_submission(
            self.db,
            submission_id=row.id,
            lease_seconds=900,
        )
        final = self.service.record_infrastructure_failure(
            self.db,
            submission_id=row.id,
            processing_token=str(second.processing_token),
            error=GradingExecutionError(
                "worker failed",
                worker_exit_code=1,
            ),
            final=True,
            worker_exit_code=1,
        )
        self.assertEqual(final.status, "ERROR")
        self.assertEqual(final.worker_exit_code, 1)
        self.assertIsNotNone(final.completed_at)
        self.assertIsNone(final.passed)

    def test_final_timeout_is_distinct_terminal_state(self):
        row = self._accept(FakeQueue())
        claimed = self.service.claim_submission(
            self.db,
            submission_id=row.id,
            lease_seconds=900,
        )
        final = self.service.record_infrastructure_failure(
            self.db,
            submission_id=row.id,
            processing_token=str(claimed.processing_token),
            error=GradingExecutionError("timeout", timed_out=True),
            final=True,
            timed_out=True,
        )
        self.assertEqual(final.status, "TIMED_OUT")
        self.assertIsNotNone(final.completed_at)

    def test_dispatcher_deletes_message_only_after_academic_result_is_persisted(self):
        row = self._accept(FakeQueue())
        message = GradingQueueMessage(
            submission_id=row.id,
            receipt_handle="receipt-1",
            message_id=str(row.queue_message_id),
            receive_count=1,
        )
        queue = FakeDispatcherQueue(message)
        executor = FakeExecutor(passed=True, score=100)
        self.service.executor = executor
        dispatcher = SysadminGradingDispatcher(
            settings=self.settings,
            session_factory=self.Session,
            queue=queue,
            grading_service=self.service,
        )

        self.assertTrue(dispatcher.run_once())
        persisted = self.db.query(SysadminSubmission).filter_by(id=row.id).one()
        self.db.refresh(persisted)
        self.assertEqual(persisted.status, "PASS")
        self.assertEqual(persisted.score, 100)
        self.assertEqual(queue.deleted, ["receipt-1"])
        self.assertEqual(queue.retried, [])


    def test_dispatcher_does_not_acknowledge_duplicate_while_live_lease_is_active(self):
        row = self._accept(FakeQueue())
        claimed = self.service.claim_submission(
            self.db,
            submission_id=row.id,
            lease_seconds=900,
        )
        self.assertIsNotNone(claimed)

        message = GradingQueueMessage(
            submission_id=row.id,
            receipt_handle="receipt-duplicate",
            message_id=str(row.queue_message_id),
            receive_count=1,
        )
        queue = FakeDispatcherQueue(message)
        dispatcher = SysadminGradingDispatcher(
            settings=self.settings,
            session_factory=self.Session,
            queue=queue,
            grading_service=self.service,
        )

        self.assertTrue(dispatcher.run_once())
        persisted = self.db.query(SysadminSubmission).filter_by(id=row.id).one()
        self.db.refresh(persisted)
        self.assertEqual(persisted.status, "STARTING")
        self.assertEqual(persisted.attempt_count, 1)
        self.assertEqual(queue.deleted, [])
        self.assertEqual(queue.retried, [])

    def test_dispatcher_retryable_infrastructure_error_is_not_acknowledged(self):
        row = self._accept(FakeQueue())
        message = GradingQueueMessage(
            submission_id=row.id,
            receipt_handle="receipt-2",
            message_id=str(row.queue_message_id),
            receive_count=1,
        )
        queue = FakeDispatcherQueue(message)
        self.service.executor = FailingExecutor(GradingExecutionError("temporary ECS outage"))
        dispatcher = SysadminGradingDispatcher(
            settings=self.settings,
            session_factory=self.Session,
            queue=queue,
            grading_service=self.service,
        )

        self.assertTrue(dispatcher.run_once())
        persisted = self.db.query(SysadminSubmission).filter_by(id=row.id).one()
        self.db.refresh(persisted)
        self.assertEqual(persisted.status, "QUEUED")
        self.assertEqual(queue.deleted, [])
        self.assertEqual(queue.retried, ["receipt-2"])

    def test_dispatcher_final_infrastructure_error_is_left_for_dlq_redrive(self):
        row = self._accept(FakeQueue())
        message = GradingQueueMessage(
            submission_id=row.id,
            receipt_handle="receipt-3",
            message_id=str(row.queue_message_id),
            receive_count=3,
        )
        queue = FakeDispatcherQueue(message)
        self.service.executor = FailingExecutor(
            GradingExecutionError("worker failed", worker_exit_code=1)
        )
        dispatcher = SysadminGradingDispatcher(
            settings=self.settings,
            session_factory=self.Session,
            queue=queue,
            grading_service=self.service,
        )

        self.assertTrue(dispatcher.run_once())
        persisted = self.db.query(SysadminSubmission).filter_by(id=row.id).one()
        self.db.refresh(persisted)
        self.assertEqual(persisted.status, "ERROR")
        self.assertEqual(persisted.worker_exit_code, 1)
        self.assertEqual(queue.deleted, [])
        self.assertEqual(queue.retried, [])


if __name__ == "__main__":
    unittest.main()
