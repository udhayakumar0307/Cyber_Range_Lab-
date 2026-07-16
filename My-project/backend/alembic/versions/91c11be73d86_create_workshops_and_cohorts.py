"""create_workshops_and_cohorts

Revision ID: 91c11be73d86
Revises: eb20c1e84a79
Create Date: 2026-07-07 11:33:48.507642

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '91c11be73d86'
down_revision: Union[str, Sequence[str], None] = 'eb20c1e84a79'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.execute("""
    CREATE TABLE IF NOT EXISTS workshops (
      id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      title          TEXT NOT NULL,
      description    TEXT,
      content_id     UUID NOT NULL REFERENCES content_items(id) ON DELETE CASCADE,
      mode           TEXT NOT NULL DEFAULT 'delivery',
      seat_cap       INTEGER NOT NULL DEFAULT 100,
      payment_status TEXT NOT NULL DEFAULT 'unpaid',
      access_policy  TEXT NOT NULL DEFAULT 'demo',
      status         TEXT NOT NULL DEFAULT 'draft',
      created_by     UUID REFERENCES users(id) ON DELETE SET NULL,
      created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at     TIMESTAMPTZ NOT NULL DEFAULT now()
    );
    """)

    op.execute("""
    CREATE TABLE IF NOT EXISTS workshop_course_admins (
      workshop_id UUID NOT NULL REFERENCES workshops(id) ON DELETE CASCADE,
      user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      PRIMARY KEY (workshop_id, user_id)
    );
    """)

    op.execute("""
    CREATE TABLE IF NOT EXISTS workshop_members (
      workshop_id UUID NOT NULL REFERENCES workshops(id) ON DELETE CASCADE,
      user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      joined_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
      PRIMARY KEY (workshop_id, user_id)
    );
    """)

    op.execute("""
    CREATE TABLE IF NOT EXISTS workshop_invites (
      id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      workshop_id UUID NOT NULL REFERENCES workshops(id) ON DELETE CASCADE,
      code        TEXT NOT NULL UNIQUE,
      max_uses    INTEGER,
      uses_count  INTEGER NOT NULL DEFAULT 0,
      expires_at  TIMESTAMPTZ,
      created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
    );
    """)

    op.execute("""
    CREATE TABLE IF NOT EXISTS cohort_runs (
      id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      workshop_id     UUID NOT NULL REFERENCES workshops(id) ON DELETE CASCADE,
      content_id      UUID NOT NULL REFERENCES content_items(id) ON DELETE CASCADE,
      scheduled_start TIMESTAMPTZ,
      scheduled_end   TIMESTAMPTZ,
      created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
    );
    """)


def downgrade() -> None:
    """Downgrade schema."""
    op.execute("DROP TABLE IF EXISTS cohort_runs;")
    op.execute("DROP TABLE IF EXISTS workshop_invites;")
    op.execute("DROP TABLE IF EXISTS workshop_members;")
    op.execute("DROP TABLE IF EXISTS workshop_course_admins;")
    op.execute("DROP TABLE IF EXISTS workshops;")
