"""add assignment context to progress and scoring

Revision ID: 201e65aa15f2
Revises: c3f1a2d4e85b
Create Date: 2026-08-22 13:43:06.944958

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '201e65aa15f2'
down_revision: Union[str, Sequence[str], None] = 'c3f1a2d4e85b'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # ---------------------------------------------------------
    # user_lab_progress
    # ---------------------------------------------------------
    with op.batch_alter_table("user_lab_progress") as batch_op:
        batch_op.add_column(
            sa.Column("assignment_id", sa.Integer(), nullable=True)
        )

        batch_op.create_foreign_key(
            "fk_ulp_assignment_id",
            "assignments",
            ["assignment_id"],
            ["id"],
            ondelete="SET NULL",
        )

        batch_op.create_unique_constraint(
            "uq_ulp_assignment_user_module",
            ["assignment_id", "user_id", "module_id"],
        )

    op.create_index(
        "ix_user_lab_progress_assignment_id",
        "user_lab_progress",
        ["assignment_id"],
        unique=False,
    )

    # ---------------------------------------------------------
    # user_progress
    # ---------------------------------------------------------
    with op.batch_alter_table("user_progress") as batch_op:
        batch_op.add_column(
            sa.Column("assignment_id", sa.Integer(), nullable=True)
        )

        batch_op.create_foreign_key(
            "fk_user_progress_assignment_id",
            "assignments",
            ["assignment_id"],
            ["id"],
            ondelete="SET NULL",
        )

        batch_op.drop_constraint(
            "_user_track_module_uc",
            type_="unique",
        )

    op.create_index(
        "ix_user_progress_assignment_id",
        "user_progress",
        ["assignment_id"],
        unique=False,
    )

    op.create_index(
        "uq_user_progress_assignment_track_module",
        "user_progress",
        [
            "user_id",
            "assignment_id",
            "track_id",
            "module_id",
        ],
        unique=True,
        postgresql_where=sa.text("assignment_id IS NOT NULL"),
        sqlite_where=sa.text("assignment_id IS NOT NULL"),
    )

    op.create_index(
        "uq_user_progress_legacy_track_module",
        "user_progress",
        ["user_id", "track_id", "module_id"],
        unique=True,
        postgresql_where=sa.text("assignment_id IS NULL"),
        sqlite_where=sa.text("assignment_id IS NULL"),
    )

    # ---------------------------------------------------------
    # score_events
    # ---------------------------------------------------------
    with op.batch_alter_table("score_events") as batch_op:
        batch_op.add_column(
            sa.Column("assignment_id", sa.Integer(), nullable=True)
        )

        batch_op.create_foreign_key(
            "fk_score_events_assignment_id",
            "assignments",
            ["assignment_id"],
            ["id"],
            ondelete="SET NULL",
        )

        batch_op.drop_constraint(
            "uq_score_event_user_module_type",
            type_="unique",
        )

    op.create_index(
        "ix_score_events_assignment_id",
        "score_events",
        ["assignment_id"],
        unique=False,
    )

    op.create_index(
        "uq_score_event_assignment_module_type",
        "score_events",
        [
            "user_id",
            "assignment_id",
            "module_id",
            "event_type",
        ],
        unique=True,
        postgresql_where=sa.text("assignment_id IS NOT NULL"),
        sqlite_where=sa.text("assignment_id IS NOT NULL"),
    )

    op.create_index(
        "uq_score_event_legacy_module_type",
        "score_events",
        ["user_id", "module_id", "event_type"],
        unique=True,
        postgresql_where=sa.text("assignment_id IS NULL"),
        sqlite_where=sa.text("assignment_id IS NULL"),
    )



def downgrade() -> None:
    """Downgrade schema."""
    pass

