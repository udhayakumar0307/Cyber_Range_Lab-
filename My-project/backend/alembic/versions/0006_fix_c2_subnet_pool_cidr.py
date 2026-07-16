"""create c2_subnet_pool, seeded for new account's private subnet (10.10.20.0/24)

Revision ID: 0006
Revises: 0005
Create Date: 2026-06-12
"""

from alembic import op

revision = "0006"
down_revision = "0005"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute("""
        CREATE TABLE IF NOT EXISTS c2_subnet_pool (
            octet         INTEGER PRIMARY KEY,
            subnet_cidr   TEXT NOT NULL UNIQUE,
            status        TEXT NOT NULL DEFAULT 'free'
                          CHECK (status IN ('free', 'in_use')),
            deployment_id UUID REFERENCES lab_deployments(id) ON DELETE SET NULL,
            allocated_at  TIMESTAMPTZ,
            freed_at      TIMESTAMPTZ
        )
    """)

    # Single row — C2 has one fixed private subnet.
    # This matches the new AWS account's private subnet: 10.10.20.0/24.
    op.execute("""
        INSERT INTO c2_subnet_pool (octet, subnet_cidr, status)
        VALUES (20, '10.10.20.0/24', 'free')
        ON CONFLICT (octet) DO NOTHING
    """)


def downgrade() -> None:
    op.execute("DROP TABLE IF EXISTS c2_subnet_pool")