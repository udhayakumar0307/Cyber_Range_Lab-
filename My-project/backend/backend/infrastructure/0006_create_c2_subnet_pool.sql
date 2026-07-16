"""create c2_subnet_pool

Revision ID: 0006
Revises: 0005
Create Date: 2026-05-23
"""
from alembic import op
import sqlalchemy as sa

revision = '0006'
down_revision = '0005'

def upgrade():
    op.execute("""
        CREATE TABLE c2_subnet_pool (
            octet         INTEGER PRIMARY KEY,
            subnet_cidr   TEXT NOT NULL UNIQUE,
            status        TEXT NOT NULL DEFAULT 'free'
                          CHECK (status IN ('free', 'in_use')),
            deployment_id UUID REFERENCES lab_deployments(id) ON DELETE SET NULL,
            allocated_at  TIMESTAMPTZ,
            freed_at      TIMESTAMPTZ
        )
    """)
    # Single row — C2 has one fixed private subnet
    op.execute("""
        INSERT INTO c2_subnet_pool (octet, subnet_cidr, status)
        VALUES (128, '10.10.128.0/24', 'free')
    """)

def downgrade():
    op.execute("DROP TABLE c2_subnet_pool")