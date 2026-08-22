#!/usr/bin/env python3
"""Point #6 hotfix: add rubric_percent to AssignmentGrade ORM model."""

from pathlib import Path
import datetime
import py_compile
import tempfile
import sys

ROOT = Path.cwd().resolve()
target = ROOT / "app/models/assignment_grade.py"

if not target.exists():
    print("ERROR: Run from ~/Cyber_Range_Lab-/backup/backend")
    print("Missing:", target)
    sys.exit(1)

stamp = datetime.datetime.now().strftime("%Y%m%d_%H%M%S")
backup = target.with_name(target.name + f".before_point6_rubric_percent_{stamp}")
backup.write_bytes(target.read_bytes())
print("Backup:", backup)

content = '"""\nAssignmentGrade — professor-owned grading decision for one student on one Assignment.\n\nAutomatic score evidence remains in ScoreEvent/User*Progress.\nThis table stores the academic grading layer and the snapshots required\nto make a published grade stable over time.\n\nPoint #6 adds rubric_percent as the rubric-backed academic score snapshot.\n"""\n\nfrom datetime import datetime\n\nfrom sqlalchemy import (\n    CheckConstraint,\n    Column,\n    DateTime,\n    ForeignKey,\n    Integer,\n    Numeric,\n    String,\n    Text,\n    UniqueConstraint,\n)\n\nfrom app.models.base import Base\n\n\nclass AssignmentGrade(Base):\n    __tablename__ = "assignment_grades"\n\n    __table_args__ = (\n        UniqueConstraint(\n            "assignment_id",\n            "student_id",\n            name="uq_assignment_grades_assignment_student",\n        ),\n        CheckConstraint(\n            "status IN (\'DRAFT\', \'PUBLISHED\')",\n            name="ck_assignment_grades_status",\n        ),\n        CheckConstraint(\n            "manual_adjustment >= -100 AND manual_adjustment <= 100",\n            name="ck_assignment_grades_adjustment_range",\n        ),\n    )\n\n    id = Column(Integer, primary_key=True, autoincrement=True)\n\n    assignment_id = Column(\n        Integer,\n        ForeignKey("assignments.id", ondelete="CASCADE"),\n        nullable=False,\n        index=True,\n    )\n    student_id = Column(\n        Integer,\n        ForeignKey("users.id", ondelete="CASCADE"),\n        nullable=False,\n        index=True,\n    )\n\n    # Professor-entered overall adjustment, interpreted as percentage points.\n    manual_adjustment = Column(Numeric(6, 2), nullable=False, default=0)\n    feedback = Column(Text, nullable=True)\n\n    # Grade state.\n    status = Column(String(20), nullable=False, default="DRAFT", index=True)\n\n    # Published-grade snapshots.\n    #\n    # auto_percent:\n    #   transparent raw automatic score percentage from assignment evidence.\n    #\n    # rubric_percent:\n    #   weighted academic percentage produced by the assignment\'s immutable\n    #   rubric snapshot (AUTO + MANUAL rubric criteria).\n    #\n    # final_percent:\n    #   rubric_percent plus professor overall adjustment, clamped to 0..100.\n    auto_score_earned = Column(Numeric(12, 2), nullable=True)\n    score_possible = Column(Numeric(12, 2), nullable=True)\n    auto_percent = Column(Numeric(6, 2), nullable=True)\n    rubric_percent = Column(Numeric(6, 2), nullable=True)\n    final_percent = Column(Numeric(6, 2), nullable=True)\n\n    graded_by = Column(\n        Integer,\n        ForeignKey("users.id", ondelete="SET NULL"),\n        nullable=True,\n        index=True,\n    )\n    published_at = Column(DateTime, nullable=True)\n\n    created_at = Column(DateTime, nullable=False, default=datetime.utcnow)\n    updated_at = Column(\n        DateTime,\n        nullable=False,\n        default=datetime.utcnow,\n        onupdate=datetime.utcnow,\n    )\n'
target.write_text(content)

cfile = Path(tempfile.gettempdir()) / "assignment_grade_point6.pyc"
py_compile.compile(str(target), cfile=str(cfile), doraise=True)

print("Wrote:", target)
print("✅ AssignmentGrade now declares rubric_percent")
print("✅ Python syntax check passed")
