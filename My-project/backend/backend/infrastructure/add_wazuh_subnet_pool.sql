-- migrations/add_wazuh_subnet_pool.sql
--
-- Creates the wazuh_subnet_pool free-list table, mirroring subnet_pool
-- but for the 10.30.0.0/16 range.
--
-- 10.30.0.0/24  (octet=0) is reserved for infra (NAT GW) — NOT inserted.
-- 10.30.1.0/24  (octet=1) → 10.30.254.0/24 (octet=254) are allocatable.
--
-- Run with:
--   psql $DATABASE_URL -f migrations/add_wazuh_subnet_pool.sql

CREATE TABLE IF NOT EXISTS wazuh_subnet_pool (
    octet         INTEGER PRIMARY KEY,          -- third octet: 1–254
    subnet_cidr   TEXT    NOT NULL UNIQUE,      -- e.g. '10.30.7.0/24'
    status        TEXT    NOT NULL DEFAULT 'free'
                          CHECK (status IN ('free', 'in_use')),
    deployment_id UUID    REFERENCES lab_deployments(id) ON DELETE SET NULL,
    allocated_at  TIMESTAMPTZ,
    freed_at      TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_wazuh_subnet_pool_status
    ON wazuh_subnet_pool (status);

CREATE INDEX IF NOT EXISTS idx_wazuh_subnet_pool_deployment_id
    ON wazuh_subnet_pool (deployment_id)
    WHERE deployment_id IS NOT NULL;

-- Seed rows for octets 1–254
INSERT INTO wazuh_subnet_pool (octet, subnet_cidr, status)
SELECT
    g.octet,
    '10.30.' || g.octet || '.0/24',
    'free'
FROM generate_series(1, 254) AS g(octet)
ON CONFLICT (octet) DO NOTHING;