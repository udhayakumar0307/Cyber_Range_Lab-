"""Machine-readable grading rubric models."""

from datetime import datetime

from sqlalchemy import (
    CheckConstraint,
    Column,
    DateTime,
    ForeignKey,
    Integer,
    JSON,
    Numeric,
    String,
    Text,
    UniqueConstraint,
)

from app.models.base import Base


class LabRubric(Base):
    __tablename__ = "lab_rubrics"
    __table_args__ = (
        UniqueConstraint("lab_id", "version", name="uq_lab_rubrics_lab_version"),
        CheckConstraint(
            "status IN ('ACTIVE', 'ARCHIVED')",
            name="ck_lab_rubrics_status",
        ),
    )

    id = Column(Integer, primary_key=True, autoincrement=True)
    lab_id = Column(
        String(100),
        ForeignKey("labs.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    version = Column(Integer, nullable=False)
    name = Column(String(200), nullable=False)
    description = Column(Text, nullable=True)
    status = Column(String(20), nullable=False, default="ACTIVE", index=True)
    rubric_json = Column(JSON, nullable=False)
    created_by = Column(
        Integer,
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    created_at = Column(DateTime, nullable=False, default=datetime.utcnow)
    updated_at = Column(
        DateTime,
        nullable=False,
        default=datetime.utcnow,
        onupdate=datetime.utcnow,
    )


class AssignmentRubric(Base):
    __tablename__ = "assignment_rubrics"
    __table_args__ = (
        UniqueConstraint("assignment_id", name="uq_assignment_rubrics_assignment"),
    )

    id = Column(Integer, primary_key=True, autoincrement=True)
    assignment_id = Column(
        Integer,
        ForeignKey("assignments.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    lab_rubric_id = Column(
        Integer,
        ForeignKey("lab_rubrics.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    rubric_version = Column(Integer, nullable=False)
    rubric_json = Column(JSON, nullable=False)
    created_at = Column(DateTime, nullable=False, default=datetime.utcnow)


class AssignmentCriterionGrade(Base):
    __tablename__ = "assignment_criterion_grades"
    __table_args__ = (
        UniqueConstraint(
            "assignment_id",
            "student_id",
            "criterion_key",
            name="uq_assignment_criterion_grade",
        ),
        CheckConstraint(
            "score_percent >= 0 AND score_percent <= 100",
            name="ck_assignment_criterion_grade_percent",
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
    criterion_key = Column(String(100), nullable=False, index=True)
    score_percent = Column(Numeric(6, 2), nullable=False)
    feedback = Column(Text, nullable=True)
    graded_by = Column(
        Integer,
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    created_at = Column(DateTime, nullable=False, default=datetime.utcnow)
    updated_at = Column(
        DateTime,
        nullable=False,
        default=datetime.utcnow,
        onupdate=datetime.utcnow,
    )
