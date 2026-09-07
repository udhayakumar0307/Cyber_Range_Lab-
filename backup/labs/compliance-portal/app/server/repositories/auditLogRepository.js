import { pool, isDatabaseConfigured } from "../config/db.js";

// The audit log is a record of what happened, not a precondition for it
// happening. A missing or unreachable database must never turn a successful
// action into a failed request.
const MAX_IN_MEMORY = 50;
const recentEvents = [];

class AuditLogRepository {
  async getLogs() {
    if (isDatabaseConfigured()) {
      try {
        const { rows } = await pool.query(
          "SELECT id, event_type, description, timestamp FROM audit_log ORDER BY id DESC LIMIT 50"
        );
        if (rows.length) return rows;
      } catch (error) {
        console.warn("Audit log unavailable from database:", error.message);
      }
    }
    return recentEvents.map((event, index) => ({
      id: recentEvents.length - index,
      event_type: event.eventType,
      description: event.description,
      timestamp: event.timestamp
    }));
  }

  async logEvent(eventType, description) {
    recentEvents.unshift({ eventType, description, timestamp: new Date().toISOString() });
    if (recentEvents.length > MAX_IN_MEMORY) recentEvents.length = MAX_IN_MEMORY;

    if (!isDatabaseConfigured()) return;
    try {
      await pool.query(
        "INSERT INTO audit_log (event_type, description, timestamp) VALUES ($1, $2, NOW())",
        [eventType, description]
      );
    } catch (error) {
      console.warn("Could not write audit log:", error.message);
    }
  }
}

export const auditLogRepository = new AuditLogRepository();
