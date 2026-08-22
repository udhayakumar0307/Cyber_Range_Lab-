"""
AssignmentGrade — professor-owned grading decision for one student on one Assignment.

Automatic score evidence remains in ScoreEvent/User*Progress.
This table stores only the academic grading layer and the snapshots required
to make a published grade stable over time.
"""

from datetime import datetime

from sqlalchemy import (
    CheckConstraint,
    Column,
    DateTime,
    ForeignKey,
    Integer,
    Numeric,
    String,
    Text,
    UniqueConstraint,
)

from app.models.base import Base


class AssignmentGrade(Base):
    __tablename__ = "assignment_grades"

    __table_args__ = (
        UniqueConstraint(
            "assignment_id",
            "student_id",
            name="uq_assignment_grades_assignment_student",
        ),
        CheckConstraint(
            "status IN ('DRAFT', 'PUBLISHED')",
            name="ck_assignment_grades_status",
        ),
        CheckConstraint(
            "manual_adjustment >= -100 AND manual_adjustment <= 100",
            name="ck_assignment_grades_adjustment_range",
        ),
    )

    id = Column(Integer, primary_key=True, autoincrement=True)

    assignment_id = Column(
        Integer,
        ForeignKey("assignments.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    student_id = Column(
        Integer,
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    # Professor-entered decision. Interpreted as percentage points.
    manual_adjustment = Column(Numeric(6, 2), nullable=False, default=0)
    feedback = Column(Text, nullable=True)

    # Grade state.
    status = Column(String(20), nullable=False, default="DRAFT", index=True)

    # Snapshots. Drafts may be recalculated from live evidence; published rows
    # use these stored values so publication is immutable until reopened.
    auto_score_earned = Column(Numeric(12, 2), nullable=True)
    score_possible = Column(Numeric(12, 2), nullable=True)
    auto_percent = Column(Numeric(6, 2), nullable=True)
    final_percent = Column(Numeric(6, 2), nullable=True)

    graded_by = Column(
        Integer,
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    published_at = Column(DateTime, nullable=True)

    created_at = Column(DateTime, nullable=False, default=datetime.utcnow)
    updated_at = Column(
        DateTime,
        nullable=False,
        default=datetime.utcnow,
        onupdate=datetime.utcnow,
    )
