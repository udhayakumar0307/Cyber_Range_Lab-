import express from 'express';
import { pool } from '../config/db.js';
import validate from '../middleware/validate.js';

const router = express.Router({ mergeParams: true });

router.post('/:requestId/apply', validate(['action_type']), async (req, res, next) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { requestId } = req.params;
    const { action_type, performed_by, fields_to_correct, erasure_scope, erasure_reason } = req.body;

    let updateField = '';
    let logAction = '';
    if (action_type === 'correction') {
      updateField = 'correction_applied = true';
      logAction = 'correction_applied';
    } else if (action_type === 'erasure') {
      updateField = 'erasure_confirmed = true';
      logAction = 'erasure_confirmed';
    } else {
      return res.status(400).json({ error: 'Invalid action_type. Use correction or erasure', status: 400 });
    }

    const updateRes = await client.query(
      `UPDATE dsr_correction_erasure_details 
       SET ${updateField}, actioned_at = NOW(), fields_to_correct = $2, erasure_scope = $3, erasure_reason = $4
       WHERE request_id = $1 RETURNING *`,
      [requestId, fields_to_correct ? JSON.stringify(fields_to_correct) : null, erasure_scope || null, erasure_reason || null]
    );

    if (updateRes.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Correction/Erasure details not found for this request', status: 404 });
    }

    await client.query(
      'INSERT INTO dsr_activity_log (request_id, action, performed_by, performed_by_role) VALUES ($1, $2, $3, $4)',
      [requestId, logAction, performed_by || 'system', 'admin']
    );

    await client.query(
      'UPDATE dsr_requests SET status = $1, resolved_at = NOW() WHERE id = $2',
      ['resolved', requestId]
    );

    await client.query('COMMIT');
    res.json({ message: `${action_type} applied successfully` });
  } catch (err) {
    await client.query('ROLLBACK');
    next(err);
  } finally {
    client.release();
  }
});

export default router;