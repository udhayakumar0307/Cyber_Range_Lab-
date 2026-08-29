from __future__ import annotations

from datetime import datetime

from sqlalchemy import Boolean, Column, DateTime, ForeignKey, Integer, String, Text, UniqueConstraint

from app.models.base import Base


class SysadminSubmission(Base):
    """Immutable student Bash submission plus reproducible autograding evidence."""

    __tablename__ = "sysadmin_submissions"
    __table_args__ = (
        UniqueConstraint(
            "student_id",
            "idempotency_key",
            name="uq_sysadmin_submissions_student_id_idempotency_key",
        ),
    )

    id = Column(Integer, primary_key=True, autoincrement=True)
    student_id = Column(
        Integer,
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    # RHSA question-bank ID, e.g. RHSA-USERS-001. It deliberately does not
    # reference labs.id because question-bank exercises are finer-grained than
    # marketplace lab products.
    lab_id = Column(String(64), nullable=False, index=True)

    filename = Column(String(128), nullable=False)
    submission_content = Column(Text, nullable=False)
    submission_sha256 = Column(String(64), nullable=False, index=True)
    seed = Column(Integer, nullable=False)

    # v0.6 lifecycle: QUEUED -> STARTING -> RUNNING -> PASS|FAIL|ERROR|TIMED_OUT.
    # Older rows are migrated from PENDING/COMPLETED without discarding results.
    status = Column(String(20), nullable=False, default="QUEUED", index=True)
    error_message = Column(Text, nullable=True)

    # Idempotent workspace/API submission and durable DB->SQS outbox metadata.
    # idempotency_key remains nullable so historical rows can coexist under the
    # unique (student_id, idempotency_key) constraint.
    idempotency_key = Column(String(64), nullable=True)
    queue_message_id = Column(String(128), nullable=True)
    enqueued_at = Column(DateTime, nullable=True, index=True)

    # Dispatcher lease/attempt metadata. The database remains authoritative;
    # SQS can deliver the same logical job more than once.
    attempt_count = Column(Integer, nullable=False, default=0)
    processing_token = Column(String(64), nullable=True)
    lease_expires_at = Column(DateTime, nullable=True, index=True)
    started_at = Column(DateTime, nullable=True)
    completed_at = Column(DateTime, nullable=True)
    ecs_task_arn = Column(String(500), nullable=True)
    worker_exit_code = Column(Integer, nullable=True)

    runner_version = Column(String(50), nullable=True)
    lab_version = Column(String(50), nullable=True)
    question_bank_commit = Column(String(64), nullable=True)
    lab_package_sha256 = Column(String(64), nullable=True)
    grader_image = Column(String(500), nullable=True)
    grader_image_id = Column(String(255), nullable=True)

    score = Column(Integer, nullable=True)
    max_score = Column(Integer, nullable=True)
    pass_score = Column(Integer, nullable=True)
    passed = Column(Boolean, nullable=True)

    # Full evidence is instructor/server-side only. Student API responses are
    # intentionally sanitized and do not expose metadata.variables or run logs.
    result_json = Column(Text, nullable=True)
    runner_stdout = Column(Text, nullable=True)
    runner_stderr = Column(Text, nullable=True)

    submitted_at = Column(DateTime, nullable=False, default=datetime.utcnow, index=True)
    # Keep graded_at for backward API compatibility. completed_at is the v0.6
    # lifecycle timestamp and is written at the same time for terminal states.
    graded_at = Column(DateTime, nullable=True)

    def mark_graded(self) -> None:
        now = datetime.utcnow()
        self.completed_at = now
        self.graded_at = now
