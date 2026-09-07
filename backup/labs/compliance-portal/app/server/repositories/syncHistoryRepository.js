import { pool, isDatabaseConfigured } from "../config/db.js";

// Sync history is useful even without a database — it is how an operator sees
// that the last run worked. Recent runs are kept in memory so a stateless
// deployment still shows them; a database, when present, keeps them across
// restarts as well.
const MAX_IN_MEMORY = 20;
const recentRuns = [];

class SyncHistoryRepository {
  async getHistory() {
    if (isDatabaseConfigured()) {
      try {
        const { rows } = await pool.query(
          "SELECT id, event, status, timestamp FROM sync_history ORDER BY id DESC LIMIT 20"
        );
        if (rows.length) {
          return rows.map((row) => ({ ...row, time: new Date(row.timestamp).toLocaleTimeString() }));
        }
      } catch (error) {
        console.warn("Sync history unavailable from database:", error.message);
      }
    }
    return recentRuns.map((run, index) => ({
      id: recentRuns.length - index,
      event: run.event,
      status: run.status,
      timestamp: run.timestamp,
      time: new Date(run.timestamp).toLocaleTimeString()
    }));
  }

  async logSync(event, status = "Success") {
    recentRuns.unshift({ event, status, timestamp: new Date().toISOString() });
    if (recentRuns.length > MAX_IN_MEMORY) recentRuns.length = MAX_IN_MEMORY;

    if (!isDatabaseConfigured()) return;
    try {
      await pool.query(
        "INSERT INTO sync_history (event, status, timestamp) VALUES ($1, $2, NOW())",
        [event, status]
      );
    } catch (error) {
      console.warn("Could not persist sync history:", error.message);
    }
  }

  async clearHistory() {
    recentRuns.length = 0;
    if (isDatabaseConfigured()) {
      try {
        await pool.query("DELETE FROM sync_history");
      } catch (error) {
        console.warn("Failed to clear sync history from database:", error.message);
      }
    }
  }

  async deleteHistory(timestamps) {
    if (!Array.isArray(timestamps) || timestamps.length === 0) return;

    for (const ts of timestamps) {
      const index = recentRuns.findIndex(r => r.timestamp === ts);
      if (index !== -1) recentRuns.splice(index, 1);
    }

    if (isDatabaseConfigured()) {
      try {
        await pool.query(
          "DELETE FROM sync_history WHERE timestamp = ANY($1)",
          [timestamps]
        );
      } catch (error) {
        console.warn("Failed to delete sync history from database:", error.message);
      }
    }
  }
}

export const syncHistoryRepository = new SyncHistoryRepository();
