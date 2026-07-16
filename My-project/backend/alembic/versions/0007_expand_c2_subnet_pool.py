"""expand c2_subnet_pool into a free-list for multiple concurrent C2 deployments

Revision ID: 0007
Revises: 0006
Create Date: 2026-06-12
"""

from alembic import op
import sqlalchemy as sa

revision = "0007"
down_revision = "0006"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # octet=20 (10.10.20.0/24) already exists from 0006 — that's the
    # original/manually-configured private subnet.
    #
    # Seed the rest of the 10.10.0.0/16 range as additional allocatable
    # /24s for future C2 deployments:
    #   10.10.0.0/24   (octet=0)   reserved — VPC infra
    #   10.10.10.0/24  (octet=10)  reserved — public subnet
    #   10.10.20.0/24  (octet=20)  already seeded in 0006
    #   10.10.21.0/24 .. 10.10.254.0/24 (octets 21-254) — newly seeded
    rows = ", ".join(
        f"({octet}, '10.10.{octet}.0/24', 'free')"
        for octet in range(21, 255)
    )
    op.execute(f"""
        INSERT INTO c2_subnet_pool (octet, subnet_cidr, status)
        VALUES {rows}
        ON CONFLICT (octet) DO NOTHING
    """)


def downgrade() -> None:
    op.execute("""
        DELETE FROM c2_subnet_pool
        WHERE octet BETWEEN 21 AND 254
    """)