"""formalize grading rubrics

Revision ID: 9c61b3e8a4f7
Revises: 7b0f4a91c2d8
Create Date: 2026-08-22
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "9c61b3e8a4f7"
down_revision: Union[str, None] = "7b0f4a91c2d8"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "lab_rubrics",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("lab_id", sa.String(length=100), nullable=False),
        sa.Column("version", sa.Integer(), nullable=False),
        sa.Column("name", sa.String(length=200), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("status", sa.String(length=20), nullable=False, server_default=sa.text("'ACTIVE'")),
        sa.Column("rubric_json", sa.JSON(), nullable=False),
        sa.Column("created_by", sa.Integer(), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=False, server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(), nullable=False, server_default=sa.func.now()),
        sa.CheckConstraint("status IN ('ACTIVE', 'ARCHIVED')", name="ck_lab_rubrics_status"),
        sa.ForeignKeyConstraint(["lab_id"], ["labs.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["created_by"], ["users.id"], ondelete="SET NULL"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("lab_id", "version", name="uq_lab_rubrics_lab_version"),
    )
    op.create_index("ix_lab_rubrics_lab_id", "lab_rubrics", ["lab_id"])
    op.create_index("ix_lab_rubrics_status", "lab_rubrics", ["status"])
    op.create_index("ix_lab_rubrics_created_by", "lab_rubrics", ["created_by"])

    op.create_table(
        "assignment_rubrics",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("assignment_id", sa.Integer(), nullable=False),
        sa.Column("lab_rubric_id", sa.Integer(), nullable=True),
        sa.Column("rubric_version", sa.Integer(), nullable=False),
        sa.Column("rubric_json", sa.JSON(), nullable=False),
        sa.Column("created_at", sa.DateTime(), nullable=False, server_default=sa.func.now()),
        sa.ForeignKeyConstraint(["assignment_id"], ["assignments.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["lab_rubric_id"], ["lab_rubrics.id"], ondelete="SET NULL"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("assignment_id", name="uq_assignment_rubrics_assignment"),
    )
    op.create_index("ix_assignment_rubrics_assignment_id", "assignment_rubrics", ["assignment_id"])
    op.create_index("ix_assignment_rubrics_lab_rubric_id", "assignment_rubrics", ["lab_rubric_id"])

    op.create_table(
        "assignment_criterion_grades",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("assignment_id", sa.Integer(), nullable=False),
        sa.Column("student_id", sa.Integer(), nullable=False),
        sa.Column("criterion_key", sa.String(length=100), nullable=False),
        sa.Column("score_percent", sa.Numeric(precision=6, scale=2), nullable=False),
        sa.Column("feedback", sa.Text(), nullable=True),
        sa.Column("graded_by", sa.Integer(), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=False, server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(), nullable=False, server_default=sa.func.now()),
        sa.CheckConstraint("score_percent >= 0 AND score_percent <= 100", name="ck_assignment_criterion_grade_percent"),
        sa.ForeignKeyConstraint(["assignment_id"], ["assignments.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["student_id"], ["users.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["graded_by"], ["users.id"], ondelete="SET NULL"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("assignment_id", "student_id", "criterion_key", name="uq_assignment_criterion_grade"),
    )
    op.create_index("ix_assignment_criterion_grades_assignment_id", "assignment_criterion_grades", ["assignment_id"])
    op.create_index("ix_assignment_criterion_grades_student_id", "assignment_criterion_grades", ["student_id"])
    op.create_index("ix_assignment_criterion_grades_criterion_key", "assignment_criterion_grades", ["criterion_key"])
    op.create_index("ix_assignment_criterion_grades_graded_by", "assignment_criterion_grades", ["graded_by"])

    op.add_column(
        "assignment_grades",
        sa.Column("rubric_percent", sa.Numeric(precision=6, scale=2), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("assignment_grades", "rubric_percent")

    op.drop_index("ix_assignment_criterion_grades_graded_by", table_name="assignment_criterion_grades")
    op.drop_index("ix_assignment_criterion_grades_criterion_key", table_name="assignment_criterion_grades")
    op.drop_index("ix_assignment_criterion_grades_student_id", table_name="assignment_criterion_grades")
    op.drop_index("ix_assignment_criterion_grades_assignment_id", table_name="assignment_criterion_grades")
    op.drop_table("assignment_criterion_grades")

    op.drop_index("ix_assignment_rubrics_lab_rubric_id", table_name="assignment_rubrics")
    op.drop_index("ix_assignment_rubrics_assignment_id", table_name="assignment_rubrics")
    op.drop_table("assignment_rubrics")

    op.drop_index("ix_lab_rubrics_created_by", table_name="lab_rubrics")
    op.drop_index("ix_lab_rubrics_status", table_name="lab_rubrics")
    op.drop_index("ix_lab_rubrics_lab_id", table_name="lab_rubrics")
    op.drop_table("lab_rubrics")
