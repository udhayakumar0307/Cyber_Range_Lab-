import pg from "pg";
import { pool } from "../config/db.js";
import { resolveConsentSource } from "./consentSources.js";

const tempPools = new Map();

export async function getDatabaseColumns(apiKey) {
  const source = resolveConsentSource(apiKey);
  let activePool = null;

  if (source && source.dbUrl) {
    if (!tempPools.has(source.dbUrl)) {
      tempPools.set(source.dbUrl, new pg.Pool({
        connectionString: source.dbUrl,
        ssl: source.dbSsl ? { rejectUnauthorized: false } : false
      }));
    }
    activePool = tempPools.get(source.dbUrl);
  } else if (process.env.DATABASE_URL) {
    activePool = pool;
  }

  if (activePool && typeof activePool.query === 'function') {
    try {
      const res = await activePool.query(
        "SELECT table_name, column_name FROM information_schema.columns WHERE table_schema = 'public'"
      );
      return res.rows;
    } catch (err) {
      console.warn("Could not query database schema:", err.message);
    }
  }
  return null;
}
