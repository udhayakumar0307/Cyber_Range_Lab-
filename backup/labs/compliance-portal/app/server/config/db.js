import pg from "pg";

const { Pool } = pg;

// The database is optional. It stores audit history and integration state; the
// portal's analysis runs entirely off the live consent sources. A deployment
// with no DATABASE_URL is a supported configuration, not a degraded one, so we
// never fall back to a localhost guess that cannot exist inside a container.
const connectionString = process.env.DATABASE_URL || process.env.ECOMMERCE_DATABASE_URL || "";

export function isDatabaseConfigured() {
  return Boolean(connectionString);
}

if (connectionString) {
  console.log(`Database configured: ${connectionString.split("@")[1] || "(local)"}`);
} else {
  console.log("No DATABASE_URL set — running stateless. Audit history and integration state are disabled.");
}

export const pool = connectionString
  ? new Pool({
    connectionString,
    ssl: process.env.ECOMMERCE_DB_SSL === "true" || process.env.DATABASE_SSL === "true"
      ? { rejectUnauthorized: false }
      : false,
    connectionTimeoutMillis: 5000
  })
  // Null-object pool: every query rejects with a predictable error that callers
  // already handle, so no code path has to know whether a database exists.
  : { query: async () => { throw new Error("No database configured"); }, on: () => { }, end: async () => { } };

// An idle client dropping its connection must never take the process down.
pool.on("error", (error) => {
  console.warn("Database client error (ignored, pool will reconnect):", error.message);
});

// Bootstrap CMS specific tables
export async function initializeSchema() {
  if (!isDatabaseConfigured()) return;
  try {
    // 1. integration_config
    await pool.query(`
      CREATE TABLE IF NOT EXISTS integration_config (
        id SERIAL PRIMARY KEY,
        store_name VARCHAR(255),
        store_url VARCHAR(255),
        platform VARCHAR(50),
        encrypted_api_key TEXT,
        encrypted_secret TEXT,
        connection_status VARCHAR(50) DEFAULT 'Disconnected',
        api_version VARCHAR(50),
        webhook_url VARCHAR(255),
        last_sync TIMESTAMP,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // 2. sync_history
    await pool.query(`
      CREATE TABLE IF NOT EXISTS sync_history (
        id SERIAL PRIMARY KEY,
        event VARCHAR(255),
        status VARCHAR(50),
        timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // 3. hash_audit
    await pool.query(`
      CREATE TABLE IF NOT EXISTS hash_audit (
        id SERIAL PRIMARY KEY,
        record_id VARCHAR(255),
        sha256_hash VARCHAR(255),
        timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        destination VARCHAR(255),
        purpose VARCHAR(255),
        verification_status VARCHAR(50) DEFAULT 'Passed'
      );
    `);

    // 4. audit_log
    await pool.query(`
      CREATE TABLE IF NOT EXISTS audit_log (
        id SERIAL PRIMARY KEY,
        event_type VARCHAR(255),
        description TEXT,
        timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // 5. pii_deletion_audit
    await pool.query(`
      CREATE TABLE IF NOT EXISTS pii_deletion_audit (
        id SERIAL PRIMARY KEY,
        record_id VARCHAR(255) NOT NULL,
        platform VARCHAR(255) NOT NULL,
        status VARCHAR(50) NOT NULL,
        verification_status VARCHAR(50) NOT NULL,
        failure_reason TEXT,
        timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        completion_timestamp TIMESTAMP
      );
    `);

    // Seed default integration config if empty
    const { rows } = await pool.query("SELECT COUNT(*) FROM integration_config");
    if (parseInt(rows[0].count) === 0) {
      await pool.query(`
        INSERT INTO integration_config 
        (store_name, store_url, platform, connection_status, api_version, last_sync)
        VALUES 
        ('EverShop Demo Store', 'http://localhost:8088', 'EverShop', 'Connected', 'v2.1.2', NOW());
      `);

      await pool.query(`
        INSERT INTO sync_history (event, status) VALUES
        ('Customer consent synced', 'Success'),
        ('Webhook received (consent.revoked)', 'Success'),
        ('Consent updated in registry', 'Success'),
        ('Full store synchronization completed', 'Success');
      `);
    }

    console.log("CMS Database schema initialized successfully.");
  } catch (error) {
    console.error("Failed to initialize CMS database tables:", error.message);
  }
}