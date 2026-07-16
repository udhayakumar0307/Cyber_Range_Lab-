"""add_challenge_url_to_challenges

Revision ID: d737f9276c3e
Revises: 204638eb9f46
Create Date: 2026-07-07 13:42:54.874731

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'd737f9276c3e'
down_revision: Union[str, Sequence[str], None] = '204638eb9f46'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.add_column("challenges", sa.Column("challenge_url", sa.Text(), nullable=True))


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_column("challenges", "challenge_url")
