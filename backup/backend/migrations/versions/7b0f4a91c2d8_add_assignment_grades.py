"""add assignment grades

Revision ID: 7b0f4a91c2d8
Revises: 5453b51f4c1e
Create Date: 2026-08-22

Point #5 — interactive professor gradebook.
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "7b0f4a91c2d8"
down_revision: Union[str, None] = "5453b51f4c1e"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "assignment_grades",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("assignment_id", sa.Integer(), nullable=False),
        sa.Column("student_id", sa.Integer(), nullable=False),
        sa.Column(
            "manual_adjustment",
            sa.Numeric(precision=6, scale=2),
            nullable=False,
            server_default=sa.text("0"),
        ),
        sa.Column("feedback", sa.Text(), nullable=True),
        sa.Column(
            "status",
            sa.String(length=20),
            nullable=False,
            server_default=sa.text("'DRAFT'"),
        ),
        sa.Column(
            "auto_score_earned",
            sa.Numeric(precision=12, scale=2),
            nullable=True,
        ),
        sa.Column(
            "score_possible",
            sa.Numeric(precision=12, scale=2),
            nullable=True,
        ),
        sa.Column(
            "auto_percent",
            sa.Numeric(precision=6, scale=2),
            nullable=True,
        ),
        sa.Column(
            "final_percent",
            sa.Numeric(precision=6, scale=2),
            nullable=True,
        ),
        sa.Column("graded_by", sa.Integer(), nullable=True),
        sa.Column("published_at", sa.DateTime(), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(),
            nullable=False,
            server_default=sa.func.now(),
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(),
            nullable=False,
            server_default=sa.func.now(),
        ),
        sa.CheckConstraint(
            "status IN ('DRAFT', 'PUBLISHED')",
            name="ck_assignment_grades_status",
        ),
        sa.CheckConstraint(
            "manual_adjustment >= -100 AND manual_adjustment <= 100",
            name="ck_assignment_grades_adjustment_range",
        ),
        sa.ForeignKeyConstraint(
            ["assignment_id"],
            ["assignments.id"],
            ondelete="CASCADE",
        ),
        sa.ForeignKeyConstraint(
            ["student_id"],
            ["users.id"],
            ondelete="CASCADE",
        ),
        sa.ForeignKeyConstraint(
            ["graded_by"],
            ["users.id"],
            ondelete="SET NULL",
        ),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint(
            "assignment_id",
            "student_id",
            name="uq_assignment_grades_assignment_student",
        ),
    )

    op.create_index(
        "ix_assignment_grades_assignment_id",
        "assignment_grades",
        ["assignment_id"],
        unique=False,
    )
    op.create_index(
        "ix_assignment_grades_student_id",
        "assignment_grades",
        ["student_id"],
        unique=False,
    )
    op.create_index(
        "ix_assignment_grades_status",
        "assignment_grades",
        ["status"],
        unique=False,
    )
    op.create_index(
        "ix_assignment_grades_graded_by",
        "assignment_grades",
        ["graded_by"],
        unique=False,
    )


def downgrade() -> None:
    op.drop_index(
        "ix_assignment_grades_graded_by",
        table_name="assignment_grades",
    )
    op.drop_index(
        "ix_assignment_grades_status",
        table_name="assignment_grades",
    )
    op.drop_index(
        "ix_assignment_grades_student_id",
        table_name="assignment_grades",
    )
    op.drop_index(
        "ix_assignment_grades_assignment_id",
        table_name="assignment_grades",
    )
    op.drop_table("assignment_grades")
