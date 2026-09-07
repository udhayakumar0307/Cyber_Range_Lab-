import express from 'express';
import { pool } from '../config/db.js';
import validate from '../middleware/validate.js';

const router = express.Router({ mergeParams: true });

router.post('/:requestId/respond', validate(['response_data']), async (req, res, next) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { requestId } = req.params;
    const { response_data, performed_by } = req.body;

    // Try to update existing row first
    const result = await client.query(
      'UPDATE dsr_access_details SET response_data = $1, responded_at = NOW() WHERE request_id = $2 RETURNING *',
      [JSON.stringify(response_data), requestId]
    );

    // If no row exists yet, insert one
    if (result.rows.length === 0) {
      await client.query(
        'INSERT INTO dsr_access_details (request_id, response_data, responded_at) VALUES ($1, $2, NOW())',
        [requestId, JSON.stringify(response_data)]
      );
    }

    await client.query(
      'INSERT INTO dsr_activity_log (request_id, action, performed_by, performed_by_role) VALUES ($1, $2, $3, $4)',
      [requestId, 'data_returned', performed_by || 'system', 'admin']
    );

    // Also update the parent request status to resolved
    await client.query(
      'UPDATE dsr_requests SET status = $1, resolved_at = NOW() WHERE id = $2',
      ['resolved', requestId]
    );

    await client.query('COMMIT');
    res.json({ message: 'Response data saved successfully' });
  } catch (err) {
    await client.query('ROLLBACK');
    next(err);
  } finally {
    client.release();
  }
});

export default router;