import { pool, isDatabaseConfigured } from "../config/db.js";
import { resolveConsentSource } from "./consentSources.js";
import { normaliseProcessor } from "../privacy/processors.js";

// Where a company's processor list comes from, in order of authority:
//
//   1. The company's own API — a `/processors` route alongside its consent
//      route, or an explicit processorsUrl on the source. This is the best
//      source because it stays current without anyone maintaining it here.
//   2. Registered through the portal by an operator, for companies that cannot
//      change their API.
//
// Nothing is assumed. A company with no declared processors has an empty
// registry, and an empty registry is reported as "not declared" rather than as
// "no third parties" — those are different claims.

const runtime = new Map();     // sector -> processor[]
const fetchFailures = new Map();

/** Derive the conventional processors route from a consent route. */
function derivedUrl(consentUrl) {
  try {
    const url = new URL(consentUrl);
    url.pathname = url.pathname.replace(/\/[^/]*$/, "/processors");
    return url.toString();
  } catch {
    return null;
  }
}

export async function fetchDeclaredProcessors(apiKey) {
  const source = resolveConsentSource(apiKey);
  if (!source || !source.url) return null;

  const target = source.processorsUrl || derivedUrl(source.url);
  if (!target) return null;

  const token = source.token || apiKey;
  try {
    const response = await fetch(target, {
      headers: { Accept: "application/json", "x-api-key": token, Authorization: `Bearer ${token}` },
      cache: "no-store",
      signal: AbortSignal.timeout(Number(process.env.CONSENT_FETCH_TIMEOUT_MS || 20000))
    });
    // A company that has not implemented the optional route is not an error.
    if (response.status === 404) return null;
    if (!response.ok) throw new Error(`responded ${response.status}`);

    const payload = await response.json();
    const list = Array.isArray(payload) ? payload
      : Array.isArray(payload?.processors) ? payload.processors
      : Array.isArray(payload?.results) ? payload.results
      : [];
    fetchFailures.delete(apiKey);
    return list.map((entry, index) => ({ ...normaliseProcessor(entry, index), source: "declared" }));
  } catch (error) {
    if (fetchFailures.get(apiKey) !== error.message) {
      console.warn(`Processor route for ${target}: ${error.message}`);
      fetchFailures.set(apiKey, error.message);
    }
    return null;
  }
}

export function listRuntimeProcessors(sector) {
  return runtime.get(sector) || [];
}

export function addRuntimeProcessor(sector, raw) {
  const existing = runtime.get(sector) || [];
  const processor = { ...normaliseProcessor(raw, existing.length), source: "registered" };
  if (!raw.name && !raw.processor && !raw.vendor) {
    throw new Error("A processor name is required.");
  }
  runtime.set(sector, [...existing.filter((entry) => entry.name !== processor.name), processor]);
  return processor;
}

export function removeRuntimeProcessor(sector, id) {
  const existing = runtime.get(sector) || [];
  const next = existing.filter((entry) => entry.id !== id && entry.name !== id);
  runtime.set(sector, next);
  return next.length !== existing.length;
}

/** Everything known for a sector: declared by the company, plus registered. */
export async function processorsFor(sector, apiKey) {
  const declared = apiKey ? await fetchDeclaredProcessors(apiKey) : null;
  const registered = listRuntimeProcessors(sector);
  // A company's own declaration wins over a manually registered duplicate.
  const names = new Set((declared || []).map((entry) => entry.name.toLowerCase()));
  return [...(declared || []), ...registered.filter((entry) => !names.has(entry.name.toLowerCase()))];
}

// ── persistence (optional, same contract as consent sources) ─────────────────

export async function ensureProcessorTable() {
  if (!isDatabaseConfigured()) return;
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS consent_processor (
        id SERIAL PRIMARY KEY,
        sector VARCHAR(64) NOT NULL,
        name VARCHAR(255) NOT NULL,
        purpose VARCHAR(255),
        data_categories TEXT,
        location VARCHAR(128),
        cross_border BOOLEAN DEFAULT FALSE,
        dpa_signed BOOLEAN DEFAULT FALSE,
        dpa_expiry TIMESTAMP,
        sharing_medium VARCHAR(64),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE (sector, name)
      );
    `);
  } catch (error) {
    console.warn("Could not create consent_processor table:", error.message);
  }
}

export async function persistProcessor(sector, processor) {
  if (!isDatabaseConfigured()) return false;
  try {
    await pool.query(
      `INSERT INTO consent_processor
         (sector, name, purpose, data_categories, location, cross_border, dpa_signed, dpa_expiry, sharing_medium)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
       ON CONFLICT (sector, name) DO UPDATE SET
         purpose = EXCLUDED.purpose, data_categories = EXCLUDED.data_categories,
         location = EXCLUDED.location, cross_border = EXCLUDED.cross_border,
         dpa_signed = EXCLUDED.dpa_signed, dpa_expiry = EXCLUDED.dpa_expiry,
         sharing_medium = EXCLUDED.sharing_medium`,
      [sector, processor.name, processor.purpose, processor.dataCategories.join(","),
       processor.location, processor.crossBorder, processor.dpaSigned,
       processor.dpaExpiry, processor.sharingMedium]
    );
    return true;
  } catch (error) {
    console.warn("Could not persist processor:", error.message);
    return false;
  }
}

export async function deletePersistedProcessor(sector, name) {
  if (!isDatabaseConfigured()) return false;
  try {
    await pool.query("DELETE FROM consent_processor WHERE sector = $1 AND name = $2", [sector, name]);
    return true;
  } catch (error) {
    console.warn("Could not delete processor:", error.message);
    return false;
  }
}

export async function loadPersistedProcessors() {
  if (!isDatabaseConfigured()) return 0;
  try {
    const { rows } = await pool.query(
      "SELECT sector, name, purpose, data_categories, location, cross_border, dpa_signed, dpa_expiry, sharing_medium FROM consent_processor"
    );
    for (const row of rows) {
      addRuntimeProcessor(row.sector, {
        name: row.name, purpose: row.purpose, dataCategories: row.data_categories,
        location: row.location, crossBorder: row.cross_border, dpaSigned: row.dpa_signed,
        dpaExpiry: row.dpa_expiry, sharingMedium: row.sharing_medium
      });
    }
    if (rows.length) console.log(`Restored ${rows.length} declared processor(s) from the database.`);
    return rows.length;
  } catch (error) {
    console.warn("Could not load processors:", error.message);
    return 0;
  }
}
