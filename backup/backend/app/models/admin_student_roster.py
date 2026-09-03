from datetime import datetime

from sqlalchemy import Column, DateTime, ForeignKey, Index, Integer
from sqlalchemy.orm import relationship

from app.models.base import Base


class AdminStudentRoster(Base):
    """Explicit manager-to-student roster ownership."""

    __tablename__ = "admin_student_roster"
    __table_args__ = (
        Index("ix_admin_student_roster_manager", "manager_user_id"),
        Index("ix_admin_student_roster_student", "student_user_id"),
    )

    manager_user_id = Column(
        Integer,
        ForeignKey("users.id", ondelete="CASCADE"),
        primary_key=True,
        nullable=False,
    )
    student_user_id = Column(
        Integer,
        ForeignKey("users.id", ondelete="CASCADE"),
        primary_key=True,
        nullable=False,
    )
    created_at = Column(DateTime, nullable=False, default=datetime.utcnow)

    manager = relationship("User", foreign_keys=[manager_user_id])
    student = relationship("User", foreign_keys=[student_user_id])
