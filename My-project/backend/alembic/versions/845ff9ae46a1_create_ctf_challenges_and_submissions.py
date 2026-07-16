"""create_ctf_challenges_and_submissions

Revision ID: 845ff9ae46a1
Revises: 0007
Create Date: 2026-07-07 11:26:29.129120

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '845ff9ae46a1'
down_revision: Union[str, Sequence[str], None] = '0007'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.execute("""
    CREATE TABLE IF NOT EXISTS challenges (
      id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      content_id    UUID NOT NULL REFERENCES content_items(id) ON DELETE CASCADE,
      title         TEXT NOT NULL,
      category      TEXT,
      difficulty    TEXT,
      points        INTEGER NOT NULL DEFAULT 0,
      flag_hash     TEXT NOT NULL,
      scenario      TEXT,
      instructions  TEXT,
      hints         JSONB,
      solution_text TEXT,
      created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
    );
    """)

    op.execute("""
    CREATE TABLE IF NOT EXISTS submissions (
      id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      challenge_id       UUID NOT NULL REFERENCES challenges(id) ON DELETE CASCADE,
      user_id            UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      submitted_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
      correct            BOOLEAN NOT NULL,
      points_awarded     INTEGER NOT NULL DEFAULT 0,
      time_spent_seconds INTEGER
    );
    """)

    op.execute("""
    CREATE INDEX IF NOT EXISTS idx_submissions_challenge_user 
      ON submissions (challenge_id, user_id);
    """)


def downgrade() -> None:
    """Downgrade schema."""
    op.execute("DROP TABLE IF EXISTS submissions;")
    op.execute("DROP TABLE IF EXISTS challenges;")
