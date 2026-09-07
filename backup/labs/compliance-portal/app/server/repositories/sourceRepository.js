import { pool, isDatabaseConfigured } from "../config/db.js";
import { restoreSources } from "../services/consentSources.js";

// Companies onboarded through the Integration page are held in the runtime
// registry. Without a database that registry is process memory, so a redeploy
// loses them — which is why environment-configured sources remain the durable
// way to register a company. When a database is available these are stored, so
// onboarding survives a restart without touching the deployment config.

export async function ensureSourceTable() {
  if (!isDatabaseConfigured()) return;
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS consent_source (
        api_key TEXT PRIMARY KEY,
        url TEXT NOT NULL,
        sector VARCHAR(64) NOT NULL DEFAULT 'generic',
        label VARCHAR(255),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
  } catch (error) {
    console.warn("Could not create consent_source table:", error.message);
  }
}

export async function persistSource({ key, url, sector, label }) {
  if (!isDatabaseConfigured()) return false;
  try {
    await pool.query(
      `INSERT INTO consent_source (api_key, url, sector, label, updated_at)
       VALUES ($1, $2, $3, $4, NOW())
       ON CONFLICT (api_key) DO UPDATE SET
         url = EXCLUDED.url, sector = EXCLUDED.sector,
         label = EXCLUDED.label, updated_at = NOW()`,
      [key, url, sector || "generic", label || null]
    );
    return true;
  } catch (error) {
    console.warn("Could not persist consent source:", error.message);
    return false;
  }
}

export async function deleteSource(key) {
  if (!isDatabaseConfigured()) return false;
  try {
    await pool.query("DELETE FROM consent_source WHERE api_key = $1", [key]);
    return true;
  } catch (error) {
    console.warn("Could not delete consent source:", error.message);
    return false;
  }
}

/** Load stored sources into the registry at boot. */
export async function loadPersistedSources() {
  if (!isDatabaseConfigured()) return 0;
  try {
    const { rows } = await pool.query("SELECT api_key, url, sector, label FROM consent_source");
    const restored = restoreSources(
      rows.map((row) => ({ key: row.api_key, url: row.url, sector: row.sector, label: row.label }))
    );
    if (restored) console.log(`Restored ${restored} onboarded consent source(s) from the database.`);
    return restored;
  } catch (error) {
    console.warn("Could not load stored consent sources:", error.message);
    return 0;
  }
}
