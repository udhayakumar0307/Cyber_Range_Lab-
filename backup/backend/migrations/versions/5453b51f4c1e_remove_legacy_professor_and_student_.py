"""remove legacy professor and student assignments

Revision ID: 5453b51f4c1e
Revises: 201e65aa15f2
Create Date: 2026-08-22 14:36:24.239369

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '5453b51f4c1e'
down_revision: Union[str, Sequence[str], None] = '201e65aa15f2'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

def upgrade() -> None:
    # Child table must be removed first because it references
    # professor_assignments.
    op.drop_table("student_assignments")
    op.drop_table("professor_assignments")


def downgrade() -> None:
    # Parent table first.
    op.create_table(
        "professor_assignments",
        sa.Column(
            "id",
            sa.Integer(),
            primary_key=True,
            nullable=False,
        ),
        sa.Column(
            "professor_id",
            sa.Integer(),
            sa.ForeignKey(
                "professors.id",
                ondelete="CASCADE",
            ),
            nullable=False,
        ),
        sa.Column(
            "college_id",
            sa.Integer(),
            sa.ForeignKey(
                "colleges.id",
                ondelete="CASCADE",
            ),
            nullable=False,
        ),
        sa.Column(
            "lab_id",
            sa.String(length=100),
            sa.ForeignKey(
                "labs.id",
                ondelete="CASCADE",
            ),
            nullable=False,
        ),
        sa.Column(
            "assigned_date",
            sa.DateTime(),
            nullable=False,
        ),
        sa.Column(
            "due_date",
            sa.DateTime(),
            nullable=False,
        ),
    )

    op.create_index(
        "ix_professor_assignments_id",
        "professor_assignments",
        ["id"],
        unique=False,
    )

    op.create_index(
        "ix_professor_assignments_professor_id",
        "professor_assignments",
        ["professor_id"],
        unique=False,
    )

    op.create_index(
        "ix_professor_assignments_college_id",
        "professor_assignments",
        ["college_id"],
        unique=False,
    )

    op.create_index(
        "ix_professor_assignments_lab_id",
        "professor_assignments",
        ["lab_id"],
        unique=False,
    )

    # Child table second.
    op.create_table(
        "student_assignments",
        sa.Column(
            "assignment_id",
            sa.Integer(),
            sa.ForeignKey(
                "professor_assignments.id",
                ondelete="CASCADE",
            ),
            primary_key=True,
            nullable=False,
        ),
        sa.Column(
            "student_id",
            sa.Integer(),
            sa.ForeignKey(
                "users.id",
                ondelete="CASCADE",
            ),
            primary_key=True,
            nullable=False,
        ),
        sa.Column(
            "status",
            sa.String(length=50),
            nullable=False,
            server_default="PENDING",
        ),
        sa.Column(
            "score",
            sa.Integer(),
            nullable=False,
            server_default="0",
        ),
        sa.Column(
            "completed_at",
            sa.DateTime(),
            nullable=True,
        ),
    )

    op.create_index(
        "ix_student_assignments_assignment_id",
        "student_assignments",
        ["assignment_id"],
        unique=False,
    )

    op.create_index(
        "ix_student_assignments_student_id",
        "student_assignments",
        ["student_id"],
        unique=False,
    )
