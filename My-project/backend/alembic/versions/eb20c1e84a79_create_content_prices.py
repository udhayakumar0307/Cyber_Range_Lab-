"""create_content_prices

Revision ID: eb20c1e84a79
Revises: 845ff9ae46a1
Create Date: 2026-07-07 11:30:15.280273

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'eb20c1e84a79'
down_revision: Union[str, Sequence[str], None] = '845ff9ae46a1'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.execute("""
    CREATE TABLE IF NOT EXISTS content_prices (
      content_id   UUID PRIMARY KEY REFERENCES content_items(id) ON DELETE CASCADE,
      amount_minor INTEGER NOT NULL,
      currency     TEXT NOT NULL DEFAULT 'INR',
      is_active    BOOLEAN NOT NULL DEFAULT TRUE,
      created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at   TIMESTAMPTZ NOT NULL DEFAULT now()
    );
    """)


def downgrade() -> None:
    """Downgrade schema."""
    op.execute("DROP TABLE IF EXISTS content_prices;")
