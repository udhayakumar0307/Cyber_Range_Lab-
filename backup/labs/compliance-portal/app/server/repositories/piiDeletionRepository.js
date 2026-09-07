import { pool, isDatabaseConfigured } from "../config/db.js";

// In-memory fallbacks when running database-less/stateless
const localAuditLogs = [];
const localDeletedRecords = new Set(); // Stores set of '<sector>:<recordId>'

class PiiDeletionRepository {
  /**
   * Log a deletion attempt.
   */
  async logAttempt({
    recordId,
    platform,
    status,
    verificationStatus = "Pending",
    failureReason = null,
    timestamp = new Date().toISOString(),
    completionTimestamp = null,
    sector = null
  }) {
    const entry = {
      recordId,
      platform,
      timestamp,
      status,
      verificationStatus,
      failureReason,
      completionTimestamp
    };

    localAuditLogs.unshift(entry);
    if (localAuditLogs.length > 100) localAuditLogs.length = 100;

    if (status === "Success" || status === "Completed") {
      const targetSector = String(sector || platform).toLowerCase();
      localDeletedRecords.add(`${targetSector}:${recordId}`);
    }

    if (!isDatabaseConfigured()) {
      return entry;
    }

    try {
      const { rows } = await pool.query(
        `INSERT INTO pii_deletion_audit 
         (record_id, platform, status, verification_status, failure_reason, timestamp, completion_timestamp)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         RETURNING *`,
        [
          recordId,
          platform,
          status,
          verificationStatus,
          failureReason,
          new Date(timestamp),
          completionTimestamp ? new Date(completionTimestamp) : null
        ]
      );
      return rows[0];
    } catch (error) {
      console.warn("Could not write PII deletion audit to database:", error.message);
      return entry;
    }
  }

  /**
   * Get all deletion audit records.
   */
  async getAuditLogs() {
    if (!isDatabaseConfigured()) {
      return localAuditLogs;
    }

    try {
      const { rows } = await pool.query(
        "SELECT id, record_id AS \"recordId\", platform, status, verification_status AS \"verificationStatus\", failure_reason AS \"failureReason\", timestamp, completion_timestamp AS \"completionTimestamp\" FROM pii_deletion_audit ORDER BY id DESC LIMIT 100"
      );
      // Synchronize in-memory record tracking
      for (const row of rows) {
        if (row.status === "Success" || row.status === "Completed") {
          const targetSector = String(row.platform).toLowerCase();
          localDeletedRecords.add(`${targetSector}:${row.recordId}`);
        }
      }
      return rows;
    } catch (error) {
      console.warn("Could not read PII deletion audit from database:", error.message);
      return localAuditLogs;
    }
  }

  /**
   * Check if a record is locally deleted.
   */
  isRecordDeleted(sector, recordId) {
    const sec = String(sector).toLowerCase();
    const idStr = String(recordId);
    
    // Check direct match
    if (localDeletedRecords.has(`${sec}:${idStr}`)) return true;
    
    // Check aliases/mappings
    if (sec === "ecommerce" && (localDeletedRecords.has(`evershop:${idStr}`) || localDeletedRecords.has(`evershop demo store:${idStr}`))) return true;
    if (sec === "finance" && localDeletedRecords.has(`finance:${idStr}`)) return true;

    return false;
  }
}

export const piiDeletionRepository = new PiiDeletionRepository();
