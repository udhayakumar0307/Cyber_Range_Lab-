"""Migrate subnet allocation from per-user to per-deployment with a reusable pool.

Changes:
  - Drop subnet_allocations table (per-user, no reclaim)
  - Drop subnet_tracker table (simple counter, no reclaim)
  - Create subnet_pool table (free-list, supports reclaim after destroy)
  - Add tenant_subnet_cidr column to lab_deployments

Revision ID: 0004
Revises: 0003
Create Date: 2026-04-29
"""

from alembic import op
import sqlalchemy as sa

revision = "0004"
down_revision = "0003"
branch_labels = None
depends_on = None

# Octets 2–254 are valid tenant subnets.
# 0 and 1 are reserved (matches the old RESERVED_OCTETS constant).
_MIN_OCTET = 2
_MAX_OCTET = 254
_PREFIX = "10.20"


def upgrade() -> None:
    # ── 1. Add tenant_subnet_cidr to lab_deployments ──────────────────────────
    # Nullable for now — existing rows have no subnet tracked at the DB level.
    # New deployments will always have it set by the worker before Terraform runs.
    op.execute("""
        ALTER TABLE lab_deployments
        ADD COLUMN IF NOT EXISTS tenant_subnet_cidr TEXT
    """)

    # ── 2. Create subnet_pool ─────────────────────────────────────────────────
    op.execute("""
        CREATE TABLE subnet_pool (
            octet         SMALLINT     PRIMARY KEY,
            subnet_cidr   TEXT         NOT NULL UNIQUE,
            status        TEXT         NOT NULL DEFAULT 'free'
                              CHECK (status IN ('free', 'in_use')),
            deployment_id UUID         REFERENCES lab_deployments(id) ON DELETE SET NULL,
            allocated_at  TIMESTAMPTZ,
            freed_at      TIMESTAMPTZ
        )
    """)

    op.execute("""
        CREATE INDEX idx_subnet_pool_status ON subnet_pool (status)
    """)

    # ── 3. Seed all valid octets into the pool ────────────────────────────────
    # Generate one INSERT per octet. Alembic op.execute handles this fine.
    rows = ", ".join(
        f"({octet}, '{_PREFIX}.{octet}.0/24', 'free')"
        for octet in range(_MIN_OCTET, _MAX_OCTET + 1)
    )
    op.execute(f"""
        INSERT INTO subnet_pool (octet, subnet_cidr, status)
        VALUES {rows}
    """)

    # ── 4. Mark octets that are currently in use by live deployments ──────────
    # Any deployment in a non-terminal state still holds its subnet.
    # We do a best-effort match: if the old subnet_allocations row for the
    # owning user maps to a known octet, mark that octet in_use.
    # Deployments that are already expired/failed/destroyed are left free.
    op.execute("""
        UPDATE subnet_pool sp
        SET
            status        = 'in_use',
            deployment_id = ld.id,
            allocated_at  = ld.created_at
        FROM lab_deployments ld
        JOIN subnet_allocations sa ON sa.user_id = ld.user_id
        WHERE sp.subnet_cidr = sa.subnet_cidr
          AND ld.status IN ('queued', 'provisioning', 'running', 'terminating', 'cleanup_failed')
    """)

    # ── 5. Back-fill tenant_subnet_cidr on active deployments ─────────────────
    op.execute("""
        UPDATE lab_deployments ld
        SET tenant_subnet_cidr = sa.subnet_cidr
        FROM subnet_allocations sa
        WHERE sa.user_id = ld.user_id
          AND ld.status IN ('queued', 'provisioning', 'running', 'terminating', 'cleanup_failed')
          AND ld.tenant_subnet_cidr IS NULL
    """)

    # ── 6. Drop old tables ────────────────────────────────────────────────────
    op.execute("DROP TABLE IF EXISTS subnet_allocations")
    op.execute("DROP TABLE IF EXISTS subnet_tracker")


def downgrade() -> None:
    # Restore the old tables (empty — we can't recover the original data).
    op.execute("""
        CREATE TABLE subnet_tracker (
            id                   TEXT PRIMARY KEY,
            last_assigned_octet  SMALLINT NOT NULL DEFAULT 1
        )
    """)
    op.execute("INSERT INTO subnet_tracker (id, last_assigned_octet) VALUES ('counter', 1)")

    op.execute("""
        CREATE TABLE subnet_allocations (
            id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
            user_id     UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            subnet_cidr TEXT        NOT NULL UNIQUE,
            created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
            UNIQUE (user_id)
        )
    """)

    op.execute("DROP INDEX IF EXISTS idx_subnet_pool_status")
    op.execute("DROP TABLE IF EXISTS subnet_pool")

    op.execute("""
        ALTER TABLE lab_deployments
        DROP COLUMN IF EXISTS tenant_subnet_cidr
    """)