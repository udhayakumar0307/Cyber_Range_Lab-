import express from 'express';
import { pool } from '../config/db.js';
import validate from '../middleware/validate.js';

const router = express.Router();

router.post('/', validate(['principal_id', 'nominee_name', 'nominee_email']), async (req, res, next) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { principal_id, nominee_name, nominee_email, nominee_phone, relationship } = req.body;

    const nomineeRes = await client.query(
      'INSERT INTO nominees (principal_id, nominee_name, nominee_email, nominee_phone, relationship) VALUES ($1, $2, $3, $4, $5) RETURNING id',
      [principal_id, nominee_name, nominee_email, nominee_phone, relationship]
    );
    const nomineeId = nomineeRes.rows[0].id;

    const year = new Date().getFullYear();
    const rand = Math.floor(10000 + Math.random() * 90000);
    const request_number = `DSR-${year}-${rand}`;
    const dueDate = new Date();
    dueDate.setDate(dueDate.getDate() + 30);

    const insertReq = await client.query(
      'INSERT INTO dsr_requests (request_number, principal_id, request_type, due_date, description) VALUES ($1, $2, $3, $4, $5) RETURNING id',
      [request_number, principal_id, 'nomination', dueDate, `Nominee registered: ${nominee_name}`]
    );
    const requestId = insertReq.rows[0].id;

    await client.query(
      'INSERT INTO dsr_activity_log (request_id, action, performed_by, performed_by_role) VALUES ($1, $2, $3, $4)',
      [requestId, 'nominee_registered', nominee_email, 'nominee']
    );
    await client.query('COMMIT');
    res.status(201).json({ nominee_id: nomineeId, request_id: requestId, request_number });
  } catch (err) {
    await client.query('ROLLBACK');
    next(err);
  } finally {
    client.release();
  }
});

router.post('/:nomineeId/submit-dsr', validate(['principal_id', 'request_type', 'description']), async (req, res, next) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { nomineeId } = req.params;
    const { principal_id, request_type, description } = req.body;

    const checkNominee = await client.query(
      'SELECT id FROM nominees WHERE id = $1 AND principal_id = $2 AND is_active = true',
      [nomineeId, principal_id]
    );
    if (checkNominee.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(403).json({ error: 'Invalid or inactive nominee', status: 403 });
    }

    const year = new Date().getFullYear();
    const rand = Math.floor(10000 + Math.random() * 90000);
    const request_number = `DSR-${year}-${rand}`;
    const dueDate = new Date();
    dueDate.setDate(dueDate.getDate() + 30);

    const insertReq = await client.query(
      'INSERT INTO dsr_requests (request_number, principal_id, request_type, due_date, description, submitted_by_nominee_id) VALUES ($1, $2, $3, $4, $5, $6) RETURNING id',
      [request_number, principal_id, request_type, dueDate, description, nomineeId]
    );
    const requestId = insertReq.rows[0].id;

    await client.query(
      'INSERT INTO dsr_activity_log (request_id, action, performed_by, performed_by_role) VALUES ($1, $2, $3, $4)',
      [requestId, 'dsr_submitted_by_nominee', nomineeId, 'nominee']
    );
    await client.query('COMMIT');
    res.status(201).json({ request_id: requestId, request_number });
  } catch (err) {
    await client.query('ROLLBACK');
    next(err);
  } finally {
    client.release();
  }
});

export default router;