import { pool, isDatabaseConfigured } from "../config/db.js";
import { listRegisteredSources } from "../services/consentSources.js";
import { loadSectorPack } from "../privacy/classifier.js";
import { cacheManager } from "../cache/cacheManager.js";

// What counts as a "connected platform" is the set of consent sources in the
// environment, not a database row. That is the configuration the portal
// actually reads, it survives a redeploy, and it cannot drift from what is
// really being analysed. A database, when present, only carries the display
// values an operator typed into the Integration form.
function fromRegistry() {
  return listRegisteredSources().map((source) => {
    const pack = loadSectorPack(source.sector);
    const analysis = cacheManager.get(`sector:${source.sector}`);
    return {
      storeName: source.label || pack.label,
      storeUrl: source.endpoint,
      platform: source.mode === "url" ? "Custom REST" : "Direct Database",
      sector: source.sector,
      sectorLabel: pack.label,
      regulator: pack.regulator,
      // Connected means the source answered and was analysed — not that a form
      // was submitted.
      connectionStatus: analysis ? "Connected" : "Registered",
      apiVersion: "v1.0",
      apiKeyMasked: source.keyMasked,
      lastSync: analysis ? analysis.syncedAt : null,
      recordsAnalysed: analysis ? analysis.records : 0,
      origin: source.origin
    };
  });
}

const EMPTY_CONFIG = {
  storeName: "",
  storeUrl: "",
  platform: "Custom REST",
  sector: null,
  connectionStatus: "Disconnected",
  apiVersion: "v1.0",
  apiKeyMasked: "",
  lastSync: null,
  recordsAnalysed: 0
};

class IntegrationRepository {
  /** Every configured platform. */
  async listPlatforms() {
    return fromRegistry();
  }

  /**
   * The primary platform, in the shape the Integration page reads. Returns an
   * explicit empty config rather than throwing when nothing is configured, so
   * the page renders its empty state instead of failing to load entirely.
   */
  async getConfig() {
    const platforms = fromRegistry();
    const primary = platforms[0] || EMPTY_CONFIG;

    if (isDatabaseConfigured()) {
      try {
        const { rows } = await pool.query(
          "SELECT store_name, store_url, platform, webhook_url FROM integration_config LIMIT 1"
        );
        if (rows[0]) {
          return {
            ...primary,
            storeName: rows[0].store_name || primary.storeName,
            storeUrl: rows[0].store_url || primary.storeUrl,
            platform: rows[0].platform || primary.platform,
            webhookUrl: rows[0].webhook_url || null,
            // Registry state still wins: it reflects what actually answered.
            connectionStatus: primary.connectionStatus,
            platforms
          };
        }
      } catch (error) {
        console.warn("Integration config unavailable from database:", error.message);
      }
    }

    return { ...primary, platforms };
  }

  async updateConfig(storeName, storeUrl, platform, apiKey, secret, connectionStatus = "Connected") {
    if (!isDatabaseConfigured()) return;
    const encKey = `aes256_enc_${Buffer.from(apiKey || "").toString("base64")}`;
    const encSec = `aes256_enc_${Buffer.from(secret || "").toString("base64")}`;
    try {
      await pool.query(`
        UPDATE integration_config SET
          store_name = $1, store_url = $2, platform = $3,
          encrypted_api_key = $4, encrypted_secret = $5,
          connection_status = $6, updated_at = NOW()
        WHERE id = 1
      `, [storeName, storeUrl, platform, encKey, encSec, connectionStatus]);
    } catch (error) {
      console.warn("Could not persist integration config:", error.message);
    }
  }

  async disconnect() {
    if (!isDatabaseConfigured()) return;
    try {
      await pool.query(
        "UPDATE integration_config SET connection_status = 'Disconnected', updated_at = NOW() WHERE id = 1"
      );
    } catch (error) {
      console.warn("Could not persist disconnect:", error.message);
    }
  }
}

export const integrationRepository = new IntegrationRepository();
