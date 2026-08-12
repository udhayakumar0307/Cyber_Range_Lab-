"""Create CTF tables: ctf, ctf_challenge, ctf_challenge_file,
ctf_hint, ctf_hint_unlock, ctf_submission, ctf_participation.

Revision ID: c3f1a2d4e85b
Revises: b7d4f0a2e19c
Create Date: 2026-08-12 07:30:00.000000
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "c3f1a2d4e85b"
down_revision: Union[str, Sequence[str], None] = "b7d4f0a2e19c"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Create all CTF-related tables."""

    bind = op.get_bind()
    inspector = sa.inspect(bind)
    existing = set(inspector.get_table_names())

    # ------------------------------------------------------------------
    # 1. ctf  (parent event)
    # ------------------------------------------------------------------
    if "ctf" not in existing:
        op.create_table(
            "ctf",
            sa.Column("id", sa.Integer(), primary_key=True, nullable=False),
            sa.Column("title", sa.String(length=200), nullable=False),
            sa.Column("description", sa.Text(), nullable=True),
            sa.Column("start_time", sa.DateTime(), nullable=False),
            sa.Column("end_time", sa.DateTime(), nullable=False),
            sa.Column("status", sa.String(length=50), nullable=False, server_default="scheduled"),
            sa.Column("is_frozen", sa.Boolean(), nullable=False, server_default=sa.false()),
            sa.Column("is_public", sa.Boolean(), nullable=False, server_default=sa.true()),
            sa.Column("created_at", sa.DateTime(), nullable=False),
            sa.Column("updated_at", sa.DateTime(), nullable=False),
        )
        op.create_index("ix_ctf_id", "ctf", ["id"], unique=False)

    # ------------------------------------------------------------------
    # 2. ctf_challenge
    # ------------------------------------------------------------------
    if "ctf_challenge" not in existing:
        op.create_table(
            "ctf_challenge",
            sa.Column("id", sa.Integer(), primary_key=True, nullable=False),
            sa.Column("ctf_id", sa.Integer(), sa.ForeignKey("ctf.id", ondelete="CASCADE"), nullable=False),
            sa.Column("title", sa.String(length=200), nullable=False),
            sa.Column("description", sa.Text(), nullable=True),
            sa.Column("category", sa.String(length=100), nullable=True),
            sa.Column("connection_string", sa.String(length=500), nullable=True),
            sa.Column("challenge_url", sa.String(length=500), nullable=True),
            # Scoring
            sa.Column("scoring_mode", sa.String(length=20), nullable=False, server_default="static"),
            sa.Column("static_points", sa.Integer(), nullable=True),
            sa.Column("dynamic_ceiling", sa.Integer(), nullable=True),
            sa.Column("dynamic_floor", sa.Integer(), nullable=True),
            sa.Column("decay_constant", sa.Float(), nullable=True),
            # Flag
            sa.Column("flag_hash", sa.String(length=255), nullable=True),
            sa.Column("flag_salt", sa.String(length=64), nullable=True),
            # State
            sa.Column("is_hidden", sa.Boolean(), nullable=False, server_default=sa.false()),
            sa.Column("url_active", sa.Boolean(), nullable=False, server_default=sa.true()),
            sa.Column("solve_count", sa.Integer(), nullable=False, server_default="0"),
            sa.Column("created_at", sa.DateTime(), nullable=False),
            sa.Column("updated_at", sa.DateTime(), nullable=False),
        )
        op.create_index("ix_ctf_challenge_id", "ctf_challenge", ["id"], unique=False)
        op.create_index("ix_ctf_challenge_ctf_id", "ctf_challenge", ["ctf_id"], unique=False)

    # ------------------------------------------------------------------
    # 3. ctf_challenge_file  (attachments)
    # ------------------------------------------------------------------
    if "ctf_challenge_file" not in existing:
        op.create_table(
            "ctf_challenge_file",
            sa.Column("id", sa.Integer(), primary_key=True, nullable=False),
            sa.Column(
                "challenge_id",
                sa.Integer(),
                sa.ForeignKey("ctf_challenge.id", ondelete="CASCADE"),
                nullable=False,
            ),
            sa.Column("filename", sa.String(length=255), nullable=False),
            sa.Column("storage_path", sa.String(length=500), nullable=False),
            sa.Column("mime_type", sa.String(length=100), nullable=True),
            sa.Column("file_size_bytes", sa.Integer(), nullable=False, server_default="0"),
            sa.Column("uploaded_at", sa.DateTime(), nullable=False),
        )
        op.create_index("ix_ctf_challenge_file_id", "ctf_challenge_file", ["id"], unique=False)
        op.create_index(
            "ix_ctf_challenge_file_challenge_id", "ctf_challenge_file", ["challenge_id"], unique=False
        )

    # ------------------------------------------------------------------
    # 4. ctf_hint
    # ------------------------------------------------------------------
    if "ctf_hint" not in existing:
        op.create_table(
            "ctf_hint",
            sa.Column("id", sa.Integer(), primary_key=True, nullable=False),
            sa.Column(
                "challenge_id",
                sa.Integer(),
                sa.ForeignKey("ctf_challenge.id", ondelete="CASCADE"),
                nullable=False,
            ),
            sa.Column("order_index", sa.Integer(), nullable=False, server_default="0"),
            sa.Column("text", sa.Text(), nullable=False),
            sa.Column("cost_percent", sa.Float(), nullable=False, server_default="0"),
        )
        op.create_index("ix_ctf_hint_id", "ctf_hint", ["id"], unique=False)
        op.create_index("ix_ctf_hint_challenge_id", "ctf_hint", ["challenge_id"], unique=False)

    # ------------------------------------------------------------------
    # 5. ctf_hint_unlock
    # ------------------------------------------------------------------
    if "ctf_hint_unlock" not in existing:
        op.create_table(
            "ctf_hint_unlock",
            sa.Column("id", sa.Integer(), primary_key=True, nullable=False),
            sa.Column(
                "hint_id",
                sa.Integer(),
                sa.ForeignKey("ctf_hint.id", ondelete="CASCADE"),
                nullable=False,
            ),
            sa.Column(
                "participant_id",
                sa.Integer(),
                sa.ForeignKey("users.id", ondelete="CASCADE"),
                nullable=False,
            ),
            sa.Column("unlocked_at", sa.DateTime(), nullable=False),
            sa.UniqueConstraint("hint_id", "participant_id", name="uq_hint_unlock_participant"),
        )
        op.create_index("ix_ctf_hint_unlock_id", "ctf_hint_unlock", ["id"], unique=False)
        op.create_index("ix_ctf_hint_unlock_hint_id", "ctf_hint_unlock", ["hint_id"], unique=False)
        op.create_index(
            "ix_ctf_hint_unlock_participant_id", "ctf_hint_unlock", ["participant_id"], unique=False
        )

    # ------------------------------------------------------------------
    # 6. ctf_submission
    # ------------------------------------------------------------------
    if "ctf_submission" not in existing:
        op.create_table(
            "ctf_submission",
            sa.Column("id", sa.Integer(), primary_key=True, nullable=False),
            sa.Column(
                "challenge_id",
                sa.Integer(),
                sa.ForeignKey("ctf_challenge.id", ondelete="CASCADE"),
                nullable=False,
            ),
            sa.Column(
                "participant_id",
                sa.Integer(),
                sa.ForeignKey("users.id", ondelete="CASCADE"),
                nullable=False,
            ),
            sa.Column("submitted_flag_hash", sa.String(length=255), nullable=False),
            sa.Column("is_correct", sa.Boolean(), nullable=False, server_default=sa.false()),
            sa.Column("is_first_blood", sa.Boolean(), nullable=False, server_default=sa.false()),
            sa.Column("submitted_at", sa.DateTime(), nullable=False),
            sa.Column("points_credited", sa.Integer(), nullable=False, server_default="0"),
            sa.Column("hint_penalty_percent", sa.Float(), nullable=False, server_default="0"),
        )
        op.create_index("ix_ctf_submission_id", "ctf_submission", ["id"], unique=False)
        op.create_index(
            "ix_ctf_submission_challenge_id", "ctf_submission", ["challenge_id"], unique=False
        )
        op.create_index(
            "ix_ctf_submission_participant_id", "ctf_submission", ["participant_id"], unique=False
        )
        # Composite indexes for fast leaderboard / progress queries
        op.create_index(
            "ix_ctf_submission_challenge_participant",
            "ctf_submission",
            ["challenge_id", "participant_id"],
            unique=False,
        )
        op.create_index(
            "ix_ctf_submission_submitted_at", "ctf_submission", ["submitted_at"], unique=False
        )

    # ------------------------------------------------------------------
    # 7. ctf_participation
    # ------------------------------------------------------------------
    if "ctf_participation" not in existing:
        op.create_table(
            "ctf_participation",
            sa.Column("id", sa.Integer(), primary_key=True, nullable=False),
            sa.Column(
                "ctf_id",
                sa.Integer(),
                sa.ForeignKey("ctf.id", ondelete="CASCADE"),
                nullable=False,
            ),
            sa.Column(
                "participant_id",
                sa.Integer(),
                sa.ForeignKey("users.id", ondelete="CASCADE"),
                nullable=False,
            ),
            sa.Column("total_points", sa.Integer(), nullable=False, server_default="0"),
            sa.Column("solve_count", sa.Integer(), nullable=False, server_default="0"),
            sa.Column("last_submission_at", sa.DateTime(), nullable=True),
            sa.Column("joined_at", sa.DateTime(), nullable=False),
            sa.UniqueConstraint("ctf_id", "participant_id", name="uq_ctf_participation"),
        )
        op.create_index("ix_ctf_participation_id", "ctf_participation", ["id"], unique=False)
        op.create_index("ix_ctf_participation_ctf_id", "ctf_participation", ["ctf_id"], unique=False)
        op.create_index(
            "ix_ctf_participation_participant_id",
            "ctf_participation",
            ["participant_id"],
            unique=False,
        )


def downgrade() -> None:
    """Drop all CTF tables in reverse dependency order."""

    op.drop_index("ix_ctf_participation_participant_id", table_name="ctf_participation")
    op.drop_index("ix_ctf_participation_ctf_id", table_name="ctf_participation")
    op.drop_index("ix_ctf_participation_id", table_name="ctf_participation")
    op.drop_table("ctf_participation")

    op.drop_index("ix_ctf_submission_submitted_at", table_name="ctf_submission")
    op.drop_index("ix_ctf_submission_challenge_participant", table_name="ctf_submission")
    op.drop_index("ix_ctf_submission_participant_id", table_name="ctf_submission")
    op.drop_index("ix_ctf_submission_challenge_id", table_name="ctf_submission")
    op.drop_index("ix_ctf_submission_id", table_name="ctf_submission")
    op.drop_table("ctf_submission")

    op.drop_index("ix_ctf_hint_unlock_participant_id", table_name="ctf_hint_unlock")
    op.drop_index("ix_ctf_hint_unlock_hint_id", table_name="ctf_hint_unlock")
    op.drop_index("ix_ctf_hint_unlock_id", table_name="ctf_hint_unlock")
    op.drop_table("ctf_hint_unlock")

    op.drop_index("ix_ctf_hint_challenge_id", table_name="ctf_hint")
    op.drop_index("ix_ctf_hint_id", table_name="ctf_hint")
    op.drop_table("ctf_hint")

    op.drop_index("ix_ctf_challenge_file_challenge_id", table_name="ctf_challenge_file")
    op.drop_index("ix_ctf_challenge_file_id", table_name="ctf_challenge_file")
    op.drop_table("ctf_challenge_file")

    op.drop_index("ix_ctf_challenge_ctf_id", table_name="ctf_challenge")
    op.drop_index("ix_ctf_challenge_id", table_name="ctf_challenge")
    op.drop_table("ctf_challenge")

    op.drop_index("ix_ctf_id", table_name="ctf")
    op.drop_table("ctf")
