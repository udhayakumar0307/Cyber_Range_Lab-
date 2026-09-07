import express from 'express';
import { pool } from '../config/db.js';
import validate from '../middleware/validate.js';

const router = express.Router({ mergeParams: true });

router.post('/:requestId/escalate', validate(['grievance_reason']), async (req, res, next) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { requestId } = req.params;
    const { grievance_reason, performed_by } = req.body;

    // Get active grievance officer automatically
    const officerRes = await client.query(
      'SELECT * FROM grievance_officers WHERE is_active = true LIMIT 1'
    );
    if (officerRes.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'No active grievance officer found. Add one via POST /api/officers', status: 404 });
    }
    const officer = officerRes.rows[0];

    // Update or insert grievance details
    const updateRes = await client.query(
      `UPDATE dsr_grievance_details 
       SET escalated_to_officer = true, officer_name = $1, officer_email = $2, escalated_at = NOW()
       WHERE request_id = $3 RETURNING *`,
      [officer.name, officer.email, requestId]
    );

    if (updateRes.rows.length === 0) {
      await client.query(
        `INSERT INTO dsr_grievance_details 
         (request_id, grievance_reason, escalated_to_officer, officer_name, officer_email, escalated_at)
         VALUES ($1, $2, true, $3, $4, NOW())`,
        [requestId, grievance_reason, officer.name, officer.email]
      );
    }

    await client.query(
      'UPDATE dsr_requests SET status = $1 WHERE id = $2',
      ['escalated', requestId]
    );

    await client.query(
      'INSERT INTO dsr_activity_log (request_id, action, performed_by, performed_by_role) VALUES ($1, $2, $3, $4)',
      [requestId, 'escalated_to_officer', performed_by || 'system', 'principal']
    );

    await client.query('COMMIT');
    res.json({
      message: 'Request escalated successfully',
      assigned_officer: { name: officer.name, email: officer.email }
    });
  } catch (err) {
    await client.query('ROLLBACK');
    next(err);
  } finally {
    client.release();
  }
});

router.post('/:requestId/officer-response', validate(['officer_response']), async (req, res, next) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { requestId } = req.params;
    const { officer_response, performed_by } = req.body;

    const updateRes = await client.query(
      `UPDATE dsr_grievance_details 
       SET officer_response = $1, officer_responded_at = NOW() 
       WHERE request_id = $2 RETURNING *`,
      [officer_response, requestId]
    );

    if (updateRes.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Grievance details not found', status: 404 });
    }

    await client.query(
      'UPDATE dsr_requests SET status = $1, resolved_at = NOW() WHERE id = $2',
      ['resolved', requestId]
    );

    await client.query(
      'INSERT INTO dsr_activity_log (request_id, action, performed_by, performed_by_role) VALUES ($1, $2, $3, $4)',
      [requestId, 'officer_responded', performed_by || 'system', 'grievance_officer']
    );

    await client.query('COMMIT');
    res.json({ message: 'Officer response recorded successfully' });
  } catch (err) {
    await client.query('ROLLBACK');
    next(err);
  } finally {
    client.release();
  }
});

export default router;