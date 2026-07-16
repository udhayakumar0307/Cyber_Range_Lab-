"""
backend/services/subnet_service.py

Per-deployment subnet allocator backed by a subnet_pool free-list table.

Design
------
- subnet_pool holds one row per valid /24 in the 10.20.0.0/16 range
  (octets 2–254). Each row is either 'free' or 'in_use'.
- allocate_subnet() claims the lowest free octet using
  FOR UPDATE SKIP LOCKED — the same pattern as the job queue — so
  concurrent worker processes never race for the same subnet.
- release_subnet() flips the row back to 'free' after a deployment
  is destroyed. The subnet can then be reused by the next deployment.
- The deployment's subnet is stored in lab_deployments.tenant_subnet_cidr
  so it is always recoverable without a join to subnet_pool.

Public API
----------
  allocate_subnet(pg, deployment_id)  -> str   (e.g. "10.20.7.0/24")
  release_subnet(pg, deployment_id)   -> None
"""

import logging
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import text

log = logging.getLogger("subnet_service")


async def allocate_subnet(pg: AsyncSession, deployment_id: str) -> str:
    """
    Claim the lowest free /24 from subnet_pool for the given deployment.

    Writes the allocated CIDR to lab_deployments.tenant_subnet_cidr so it
    survives even if subnet_pool is queried independently.

    Raises RuntimeError if the pool is exhausted.
    """
    # Claim the lowest free octet atomically.
    # FOR UPDATE SKIP LOCKED means two concurrent workers will never pick
    # the same row — the second one skips past any locked row and takes
    # the next free one instead.
    result = await pg.execute(
        text("""
            UPDATE subnet_pool
            SET
                status        = 'in_use',
                deployment_id = :deployment_id,
                allocated_at  = now(),
                freed_at      = NULL
            WHERE octet = (
                SELECT octet
                FROM subnet_pool
                WHERE status = 'free'
                ORDER BY octet
                LIMIT 1
                FOR UPDATE SKIP LOCKED
            )
            RETURNING subnet_cidr
        """),
        {"deployment_id": deployment_id},
    )
    row = result.fetchone()

    if not row:
        raise RuntimeError(
            "Subnet pool exhausted — no free /24 available in 10.20.0.0/16. "
            "Either wait for a deployment to expire or expand the pool."
        )

    subnet_cidr = row.subnet_cidr

    # Mirror the allocation onto the deployment row so it is always
    # readable without joining back to subnet_pool.
    await pg.execute(
        text("""
            UPDATE lab_deployments
            SET tenant_subnet_cidr = :cidr
            WHERE id = :deployment_id
        """),
        {"cidr": subnet_cidr, "deployment_id": deployment_id},
    )

    log.info(
        "Subnet allocated: deployment_id=%s cidr=%s",
        deployment_id, subnet_cidr,
    )
    return subnet_cidr


async def release_subnet(pg: AsyncSession, deployment_id: str) -> None:
    """
    Return the subnet held by a deployment back to the free pool.

    Safe to call even if the deployment never had a subnet allocated
    (e.g. it failed before allocation) — the UPDATE simply matches
    zero rows and logs a warning.

    Called by the cleanup worker after a successful terraform destroy.
    """
    result = await pg.execute(
        text("""
            UPDATE subnet_pool
            SET
                status        = 'free',
                deployment_id = NULL,
                freed_at      = now()
            WHERE deployment_id = :deployment_id
            RETURNING subnet_cidr
        """),
        {"deployment_id": deployment_id},
    )
    row = result.fetchone()

    if row:
        log.info(
            "Subnet released: deployment_id=%s cidr=%s",
            deployment_id, row.subnet_cidr,
        )
    else:
        log.warning(
            "release_subnet called for deployment_id=%s but no in_use row found "
            "in subnet_pool — deployment may have failed before allocation.",
            deployment_id,
        )


# ── Wazuh subnet pool (10.30.0.0/16) ─────────────────────────────────────────
# Mirror of allocate_subnet / release_subnet above, but targets
# wazuh_subnet_pool — a separate free-list seeded with 10.30.1.0/24
# through 10.30.254.0/24. 10.30.0.0/24 is reserved for the shared
# infra subnet (NAT GW) and is never inserted into this table.

async def allocate_wazuh_subnet(pg: AsyncSession, deployment_id: str) -> str:
    """
    Claim the lowest free /24 from wazuh_subnet_pool for the given deployment.
    Raises RuntimeError if the pool is exhausted.
    """
    result = await pg.execute(
        text("""
            UPDATE wazuh_subnet_pool
            SET
                status        = 'in_use',
                deployment_id = :deployment_id,
                allocated_at  = now(),
                freed_at      = NULL
            WHERE octet = (
                SELECT octet
                FROM wazuh_subnet_pool
                WHERE status = 'free'
                ORDER BY octet
                LIMIT 1
                FOR UPDATE SKIP LOCKED
            )
            RETURNING subnet_cidr
        """),
        {"deployment_id": deployment_id},
    )
    row = result.fetchone()

    if not row:
        raise RuntimeError(
            "Wazuh subnet pool exhausted — no free /24 available in 10.30.0.0/16. "
            "Either wait for a deployment to expire or expand the pool."
        )

    subnet_cidr = row.subnet_cidr

    # Mirror onto the deployment row so it is readable without a join.
    await pg.execute(
        text("""
            UPDATE lab_deployments
            SET tenant_subnet_cidr = :cidr
            WHERE id = :deployment_id
        """),
        {"cidr": subnet_cidr, "deployment_id": deployment_id},
    )

    log.info(
        "Wazuh subnet allocated: deployment_id=%s cidr=%s",
        deployment_id, subnet_cidr,
    )
    return subnet_cidr


async def release_wazuh_subnet(pg: AsyncSession, deployment_id: str) -> None:
    """
    Return the Wazuh /24 held by a deployment back to the free pool.
    Safe to call even if the deployment never had a subnet allocated.
    """
    result = await pg.execute(
        text("""
            UPDATE wazuh_subnet_pool
            SET
                status        = 'free',
                deployment_id = NULL,
                freed_at      = now()
            WHERE deployment_id = :deployment_id
            RETURNING subnet_cidr
        """),
        {"deployment_id": deployment_id},
    )
    row = result.fetchone()

    if row:
        log.info(
            "Wazuh subnet released: deployment_id=%s cidr=%s",
            deployment_id, row.subnet_cidr,
        )
    else:
        log.warning(
            "release_wazuh_subnet called for deployment_id=%s but no in_use row found "
            "in wazuh_subnet_pool — deployment may have failed before allocation.",
            deployment_id,
        )

# ── C2 subnet pool (10.10.128.0/24 is fixed — it's the one static private subnet)
# C2 is a static range, not a multi-tenant pool like lab-1/wazuh,
# so the "pool" is just a single row acting as a lock.

async def allocate_c2_subnet(pg: AsyncSession, deployment_id: str) -> str:
    result = await pg.execute(
        text("""
            UPDATE c2_subnet_pool
            SET
                status        = 'in_use',
                deployment_id = :deployment_id,
                allocated_at  = now(),
                freed_at      = NULL
            WHERE octet = (
                SELECT octet
                FROM c2_subnet_pool
                WHERE status = 'free'
                ORDER BY octet
                LIMIT 1
                FOR UPDATE SKIP LOCKED
            )
            RETURNING subnet_cidr
        """),
        {"deployment_id": deployment_id},
    )
    row = result.fetchone()
    if not row:
        raise RuntimeError("C2 subnet already in use — only one C2 deployment at a time.")

    subnet_cidr = row.subnet_cidr
    await pg.execute(
        text("""
            UPDATE lab_deployments
            SET tenant_subnet_cidr = :cidr
            WHERE id = :deployment_id
        """),
        {"cidr": subnet_cidr, "deployment_id": deployment_id},
    )
    log.info("C2 subnet allocated: deployment_id=%s cidr=%s", deployment_id, subnet_cidr)
    return subnet_cidr


async def release_c2_subnet(pg: AsyncSession, deployment_id: str) -> None:
    result = await pg.execute(
        text("""
            UPDATE c2_subnet_pool
            SET status        = 'free',
                deployment_id = NULL,
                freed_at      = now()
            WHERE deployment_id = :deployment_id
            RETURNING subnet_cidr
        """),
        {"deployment_id": deployment_id},
    )
    row = result.fetchone()
    if row:
        log.info("C2 subnet released: deployment_id=%s cidr=%s", deployment_id, row.subnet_cidr)
    else:
        log.warning("release_c2_subnet: no in_use row for deployment_id=%s", deployment_id)