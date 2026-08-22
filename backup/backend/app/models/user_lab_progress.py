from sqlalchemy import (
    Column,
    Integer,
    String,
    ForeignKey,
    DateTime,
    Boolean,
    UniqueConstraint,
)
from datetime import datetime
from app.models.base import Base


class UserLabProgress(Base):
    __tablename__ = "user_lab_progress"

    id = Column(Integer, primary_key=True, index=True)

    # Academic/execution context.
    # NULL means legacy progress or a personal/non-assignment lab run.
    assignment_id = Column(
        Integer,
        ForeignKey("assignments.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )

    user_id = Column(
        Integer,
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    lab_id = Column(
        String(100),
        ForeignKey("labs.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    module_id = Column(
        String(100),
        ForeignKey("lab_modules.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    status = Column(String(50), default="STARTED", nullable=False)
    score = Column(Integer, default=0, nullable=False)
    attempts = Column(Integer, default=0, nullable=False)
    started_at = Column(DateTime, default=datetime.utcnow)
    completed_at = Column(DateTime, nullable=True)
    time_taken_seconds = Column(Integer, nullable=True)
    last_submission = Column(String(255), nullable=True)
    flag_correct = Column(Boolean, default=False, nullable=False)

    __table_args__ = (
        UniqueConstraint(
            "assignment_id",
            "user_id",
            "module_id",
            name="uq_ulp_assignment_user_module",
        ),
    )