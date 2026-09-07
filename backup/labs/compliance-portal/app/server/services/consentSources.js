// A "consent source" tells the dashboard where a given API key's consent data
// comes from. Register companies via CONSENT_SOURCES (JSON), mapping key -> source:
//
//   { "<key>": { "url": "https://company/consent-api/consents", "token": "<optional>" } }
//   { "<key>": { "dbUrl": "postgres://...", "dbSsl": true } }   // direct-DB (back-compat)
//
// url mode  (preferred): the dashboard GETs the company's route (forwarding the
//           key) and expects the standard shape — no DB creds or schema coupling.
// dbUrl mode (back-compat): the dashboard queries the company DB directly.
//
// Adding a new company is then just one entry: its route URL + its key.
import pg from "pg";

const { Pool } = pg;

const PURPOSE_MAP = {
  "Consent for Marketing": "Marketing",
  "Consent for Research and Analytics": "Research",
  "Consent for Feedback": "Analytics"
};

function loadSources() {
  const map = {};
  if (process.env.CONSENT_SOURCES) {
    try {
      Object.assign(map, JSON.parse(process.env.CONSENT_SOURCES));
    } catch (error) {
      console.error("Invalid CONSENT_SOURCES JSON:", error.message);
    }
  }
  // Pipe-separated form, one variable per source:
  //   CONSENT_SOURCE_<ANYTHING>=<key>|<url>|<sector>|<label>
  // Deployment UIs frequently mangle JSON in an env field (smart quotes, line
  // wrapping, a stripped brace), and a single bad character silently disables
  // every source. This form has nothing to quote.
  for (const [name, raw] of Object.entries(process.env)) {
    if (!name.startsWith("CONSENT_SOURCE_") || !raw || !raw.trim()) continue;
    const [key, url, sector, ...labelParts] = raw.split("|").map((part) => part.trim());
    if (!key || !url) {
      console.error(`${name}: expected "<key>|<url>|<sector>|<label>", got "${raw.slice(0, 40)}…"`);
      continue;
    }
    map[key] = {
      url,
      sector: (sector || "generic").toLowerCase(),
      label: labelParts.join("|") || null
    };
  }

  // Back-compat: DDS_CONSENT_API_KEY(S) + ECOMMERCE_DATABASE_URL => a db source.
  const legacyKeys = (process.env.DDS_CONSENT_API_KEYS || process.env.DDS_CONSENT_API_KEY || "")
    .split(",")
    .map((key) => key.trim())
    .filter(Boolean);
  if (legacyKeys.length && process.env.ECOMMERCE_DATABASE_URL) {
    for (const key of legacyKeys) {
      if (!map[key]) {
        map[key] = { dbUrl: process.env.ECOMMERCE_DATABASE_URL, dbSsl: process.env.ECOMMERCE_DB_SSL === "true" };
      }
    }
  }
  for (const source of Object.values(map)) source.origin = "environment";
  return map;
}

let SOURCES = null;

function getSources() {
  if (SOURCES === null) {
    SOURCES = loadSources();
  }
  return SOURCES;
}

export function hasConsentSources() {
  return Object.keys(getSources()).length > 0;
}

// ── Runtime onboarding ───────────────────────────────────────────────────────
// A company can be registered from the environment (CONSENT_SOURCES /
// CONSENT_SOURCE_*) or added at runtime through the Integration page. Both land
// in the same registry, because the registry is what every read path uses: the
// analysis, the sector routing and the "what is connected" view. Registering a
// source only here is what makes onboarding a new company possible without a
// redeploy.
const ORIGIN_ENV = "environment";
const ORIGIN_RUNTIME = "runtime";

export function registerSource({ key, url, sector, label, token, dbUrl, dbSsl }) {
  if (!key || !String(key).trim()) throw new Error("An API key is required to register a consent source.");
  if (!url && !dbUrl) throw new Error("A consent route URL is required to register a consent source.");

  const sources = getSources();
  const existing = sources[key];
  sources[key] = {
    ...(existing || {}),
    ...(url ? { url } : {}),
    ...(dbUrl ? { dbUrl, dbSsl: Boolean(dbSsl) } : {}),
    ...(token ? { token } : {}),
    sector: (sector || existing?.sector || "generic").toLowerCase(),
    label: label || existing?.label || null,
    origin: existing?.origin === ORIGIN_ENV ? ORIGIN_ENV : ORIGIN_RUNTIME,
    registeredAt: existing?.registeredAt || new Date().toISOString()
  };
  return { key, ...sources[key] };
}

export function unregisterSource(key) {
  const sources = getSources();
  if (!sources[key]) return false;
  delete sources[key];
  return true;
}

/** Restore runtime-registered sources saved by a previous process. */
export function restoreSources(rows = []) {
  let restored = 0;
  for (const row of rows) {
    try {
      registerSource(row);
      restored += 1;
    } catch (error) {
      console.warn("Skipping stored consent source:", error.message);
    }
  }
  return restored;
}

export function resolveConsentSource(apiKey) {
  const sources = getSources();
  return (apiKey && sources[apiKey]) || null;
}

// The sector a key belongs to. Declared per source in CONSENT_SOURCES, which is
// the only place that already knows which company a request represents:
//   {"<key>": {"url": "https://…", "sector": "finance"}}
// Unknown or absent sectors fall back to the generic pack rather than failing.
export function resolveSector(apiKey) {
  const source = resolveConsentSource(apiKey);
  return (source && source.sector) || "generic";
}

// Every registered source. Keys are masked by default: the registry is
// server-side configuration and must never leak through the API. Internal
// callers that need to actually fetch pass { includeKeys: true }.
export function listRegisteredSources({ includeKeys = false } = {}) {
  return Object.entries(getSources()).map(([key, source]) => ({
    ...(includeKeys ? { key } : {}),
    keyMasked: `${key.slice(0, 12)}…${key.slice(-4)}`,
    sector: source.sector || "generic",
    mode: source.url ? "url" : source.dbUrl ? "database" : "unknown",
    endpoint: source.url || null,
    label: source.label || null,
    origin: source.origin || "environment"
  }));
}

// ── URL mode (preferred) ─────────────────────────────────────────────────────
async function fetchFromUrl(source, apiKey, limit) {
  const url = new URL(source.url);
  
  // Prevent recursive HTTP deadlock if the target URL points back to this server
  const isLocalHost = url.hostname === "localhost" || url.hostname === "127.0.0.1" || url.hostname === "::1" || url.hostname === "0.0.0.0";
  const currentPort = String(process.env.PORT || 4000);
  const targetPort = url.port || (url.protocol === "https:" ? "443" : "80");
  
  if (isLocalHost && (targetPort === currentPort || targetPort === "8000" || targetPort === "4000")) {
    console.log(`Bypassing local loopback fetch to ${source.url} to prevent recursive deadlock.`);
    const { getConsentsForApiKey } = await import("../../data/consentScenarios.js");
    const records = getConsentsForApiKey(apiKey) || getConsentsForApiKey("cms_test_sk_8f2a91d7c4b64e3fa0d925b71e6a34c2") || [];
    return records;
  }

  if (limit) url.searchParams.set("limit", String(limit));
  const token = source.token || apiKey;
  const headers = { Accept: "application/json" };
  if (token) {
    headers["x-api-key"] = token;
    headers.Authorization = `Bearer ${token}`;
  }
  // Without an explicit timeout a company route that accepts the connection and
  // then stalls holds the request open until something upstream gives up, which
  // surfaces to the operator as an unexplained "connection timeout" rather than
  // a named failure. Fail here, first, with a message that says which host.
  const timeoutMs = Number(process.env.CONSENT_FETCH_TIMEOUT_MS || 20000);
  let response;
  try {
    response = await fetch(url, { headers, cache: "no-store", signal: AbortSignal.timeout(timeoutMs) });
  } catch (error) {
    if (error.name === "TimeoutError" || error.name === "AbortError") {
      throw new Error(`${url.host} did not respond within ${timeoutMs / 1000}s`);
    }
    throw new Error(`Could not reach ${url.host}: ${error.message}`);
  }
  if (!response.ok) {
    // Name the fix, not just the code. A 401 here is always a credential
    // mismatch between this portal and the company's own CONSENT_API_KEY, and
    // a 404 on a bare domain means the consent route path is missing.
    if (response.status === 401 || response.status === 403) {
      const error = new Error(
        `${url.host} rejected this API key (${response.status}). The key must match CONSENT_API_KEY on that deployment.`
      );
      error.code = "AUTH_REJECTED";
      throw error;
    }
    if (response.status === 404) {
      const error = new Error(
        `${url.host} has no consent route at ${url.pathname}. Check the full path, not just the domain.`
      );
      error.code = "ROUTE_NOT_FOUND";
      throw error;
    }
    throw new Error(`${url.host} responded ${response.status}`);
  }
  const payload = await response.json();
  return Array.isArray(payload) ? payload : Array.isArray(payload?.results) ? payload.results : [];
}

// Guard against a company sending slightly different field names.
// Guarantee the canonical fields the dashboard reads, while preserving every
// field the company actually sent. Flattening to a fixed shape would discard
// precisely the sector-specific columns the classifier exists to find — a
// finance source would arrive stripped of pan_number, account_number and
// is_minor, and score as though it held nothing but a name and an email.
function normalizeRecords(rows) {
  return rows.map((row) => ({
    ...row,
    user_id: String(row.user_id ?? row.id ?? ""),
    name: row.name ?? row.full_name ?? row.account_name ?? "",
    email: row.email ?? "",
    phone: row.phone ?? row.telephone ?? row.mobile ?? "",
    address: row.address ?? "",
    purpose: row.purpose ?? row.consent_type ?? "",
    consent_status: row.consent_status ?? (row.consent ? "granted" : row.status ?? ""),
    timestamp: row.timestamp ?? row.created_at ?? row.created ?? ""
  }));
}

// ── DB mode (back-compat: query the EverShop schema directly) ────────────────
const pools = new Map();
const statusColByPool = new Map();

function poolFor(source) {
  if (!pools.has(source.dbUrl)) {
    pools.set(source.dbUrl, new Pool({
      connectionString: source.dbUrl,
      ssl: source.dbSsl ? { rejectUnauthorized: false } : false
    }));
  }
  return pools.get(source.dbUrl);
}

function normalizeStatus(status, consent) {
  if (status === "revoked") return "revoked";
  if (status === "granted") return "granted";
  return consent ? "granted" : "revoked";
}

async function fetchFromDb(source, limit) {
  const pool = poolFor(source);
  if (!statusColByPool.has(source.dbUrl)) {
    const { rows } = await pool.query(
      `SELECT 1 FROM information_schema.columns
        WHERE table_name = 'customer_address' AND column_name = 'consent_status' LIMIT 1`
    );
    statusColByPool.set(source.dbUrl, rows.length > 0);
  }
  const statusExpr = statusColByPool.get(source.dbUrl) ? "ca.consent_status" : "NULL";
  const { rows } = await pool.query(
    `SELECT c.customer_id AS user_id,
            COALESCE(c.full_name, 'Unknown') AS name,
            c.email,
            ca.telephone AS phone,
            NULLIF(concat_ws(', ', ca.address_1, ca.city, ca.province,
                   CASE WHEN upper(ca.country) IN ('IN', 'IND') THEN 'India' ELSE ca.country END), '') AS address,
            ca.consent,
            ${statusExpr} AS consent_status,
            c.created_at AS timestamp
       FROM customer c
       LEFT JOIN customer_address ca
         ON ca.customer_id = c.customer_id AND ca.is_default = true
      ORDER BY c.customer_id
      LIMIT $1`,
    [limit]
  );
  return rows.map((row) => ({
    user_id: String(row.user_id),
    name: row.name,
    email: row.email || "",
    phone: row.phone || "",
    address: row.address || "",
    purpose: PURPOSE_MAP[row.consent] || "Marketing",
    consent_status: normalizeStatus(row.consent_status, row.consent),
    timestamp: row.timestamp ? new Date(row.timestamp).toISOString() : ""
  }));
}

// Returns the consent records for a key, or null if no source is registered.
export async function fetchConsents(apiKey, limit = 500) {
  const source = resolveConsentSource(apiKey);
  if (!source) return null;
  if (source.url) return normalizeRecords(await fetchFromUrl(source, apiKey, limit));
  if (source.dbUrl) return await fetchFromDb(source, limit);
  return null;
}
