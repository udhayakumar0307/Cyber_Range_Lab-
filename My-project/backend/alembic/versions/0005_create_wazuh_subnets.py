"""create wazuh_subnet_pool and seed 10.30.0.0/16 pool

Revision ID: 0005
Revises: 0004
Create Date: 2026-05-15
"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = "0005"
down_revision = "0004"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # ── Table ─────────────────────────────────────────────────────────────────
    # Mirrors subnet_pool but for the 10.30.0.0/16 Wazuh VPC range.
    # Uses a plain TEXT status column + CHECK constraint (no enum type)
    # so it stays consistent with subnet_pool.
    # 10.30.0.0/24 (octet=0) is reserved for infra (NAT GW) — never inserted.
    op.create_table(
        "wazuh_subnet_pool",
        sa.Column("octet",         sa.Integer(),                  primary_key=True),
        sa.Column("subnet_cidr",   sa.Text(),                     nullable=False, unique=True),
        sa.Column("status",        sa.Text(),                     nullable=False, server_default="free"),
        sa.Column("deployment_id", postgresql.UUID(),             sa.ForeignKey("lab_deployments.id", ondelete="SET NULL"), nullable=True),
        sa.Column("allocated_at",  sa.TIMESTAMP(timezone=True),  nullable=True),
        sa.Column("freed_at",      sa.TIMESTAMP(timezone=True),  nullable=True),
        sa.CheckConstraint("status IN ('free', 'in_use')", name="ck_wazuh_subnet_pool_status"),
    )

    op.create_index("ix_wazuh_subnet_pool_status",        "wazuh_subnet_pool", ["status"])
    op.create_index("ix_wazuh_subnet_pool_deployment_id", "wazuh_subnet_pool", ["deployment_id"])

    # ── Seed the pool: 10.30.1.0/24 → 10.30.254.0/24 ─────────────────────────
    op.bulk_insert(
        sa.table(
            "wazuh_subnet_pool",
            sa.column("octet",       sa.Integer),
            sa.column("subnet_cidr", sa.Text),
            sa.column("status",      sa.Text),
        ),
        [
            {"octet": i, "subnet_cidr": f"10.30.{i}.0/24", "status": "free"}
            for i in range(1, 255)
        ],
    )


def downgrade() -> None:
    op.drop_index("ix_wazuh_subnet_pool_deployment_id", table_name="wazuh_subnet_pool")
    op.drop_index("ix_wazuh_subnet_pool_status",        table_name="wazuh_subnet_pool")
    op.drop_table("wazuh_subnet_pool")