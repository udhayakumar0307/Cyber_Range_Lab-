"""create_cms_tables

Revision ID: e202ddba0302
Revises: 91c11be73d86
Create Date: 2026-07-07 11:36:55.790126

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'e202ddba0302'
down_revision: Union[str, Sequence[str], None] = '91c11be73d86'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.execute("""
    CREATE TABLE IF NOT EXISTS content_pages (
      id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      slug         TEXT NOT NULL UNIQUE,
      title        TEXT NOT NULL,
      content      TEXT,
      is_published BOOLEAN NOT NULL DEFAULT FALSE,
      created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at   TIMESTAMPTZ NOT NULL DEFAULT now()
    );
    """)

    op.execute("""
    CREATE TABLE IF NOT EXISTS content_page_revisions (
      id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      page_id    UUID NOT NULL REFERENCES content_pages(id) ON DELETE CASCADE,
      content    TEXT,
      created_by UUID REFERENCES users(id) ON DELETE SET NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
    """)

    op.execute("""
    CREATE TABLE IF NOT EXISTS content_sections (
      id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      page_id    UUID NOT NULL REFERENCES content_pages(id) ON DELETE CASCADE,
      title      TEXT NOT NULL,
      sort_order INTEGER NOT NULL DEFAULT 0,
      config     JSONB
    );
    """)


def downgrade() -> None:
    """Downgrade schema."""
    op.execute("DROP TABLE IF EXISTS content_sections;")
    op.execute("DROP TABLE IF EXISTS content_page_revisions;")
    op.execute("DROP TABLE IF EXISTS content_pages;")
