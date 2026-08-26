from __future__ import annotations

from datetime import datetime

from sqlalchemy import Boolean, Column, DateTime, ForeignKey, Integer, String, Text

from app.models.base import Base


class SysadminSubmission(Base):
    """Immutable student Bash submission plus reproducible autograding evidence."""

    __tablename__ = "sysadmin_submissions"

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

    status = Column(String(20), nullable=False, default="PENDING", index=True)
    error_message = Column(Text, nullable=True)

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
    graded_at = Column(DateTime, nullable=True)

    def mark_graded(self) -> None:
        self.graded_at = datetime.utcnow()
