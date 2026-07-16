"""create_ops_feed_table

Revision ID: 204638eb9f46
Revises: e202ddba0302
Create Date: 2026-07-07 11:40:50.583290

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '204638eb9f46'
down_revision: Union[str, Sequence[str], None] = 'e202ddba0302'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.execute("""
    CREATE TABLE IF NOT EXISTS ops_feed (
      id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      severity            TEXT NOT NULL DEFAULT 'info',
      title               TEXT NOT NULL,
      message             TEXT,
      is_read             BOOLEAN NOT NULL DEFAULT FALSE,
      assigned_to_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
      escalation          TEXT,
      acknowledged_at     TIMESTAMPTZ,
      acknowledged_by     UUID REFERENCES users(id) ON DELETE SET NULL,
      created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
    );
    """)


def downgrade() -> None:
    """Downgrade schema."""
    op.execute("DROP TABLE IF EXISTS ops_feed;")
