import { pool, isDatabaseConfigured } from "../config/db.js";

// Hash audit entries are durable evidence, so they are only meaningful with a
// database. Without one, report an empty trail rather than failing the request
// that happened to touch it.
class HashAuditRepository {
  async getHashes() {
    if (!isDatabaseConfigured()) return [];
    try {
      const { rows } = await pool.query(
        "SELECT id, record_id, sha256_hash, timestamp, destination, purpose, verification_status FROM hash_audit ORDER BY id DESC LIMIT 50"
      );
      return rows;
    } catch (error) {
      console.warn("Hash audit unavailable:", error.message);
      return [];
    }
  }

  async logHash(recordId, hash, destination, purpose) {
    if (!isDatabaseConfigured()) return false;
    try {
      await pool.query(`
        INSERT INTO hash_audit (record_id, sha256_hash, destination, purpose, verification_status, timestamp)
        VALUES ($1, $2, $3, $4, 'Passed', NOW())
      `, [recordId, hash, destination, purpose]);
      return true;
    } catch (error) {
      console.warn("Could not write hash audit:", error.message);
      return false;
    }
  }
}

export const hashAuditRepository = new HashAuditRepository();
