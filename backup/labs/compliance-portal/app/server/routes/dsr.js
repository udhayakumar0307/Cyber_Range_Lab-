import express from 'express';
import { pool } from '../config/db.js';
import validate from '../middleware/validate.js';

const router = express.Router();

router.post('/', validate(['principal_id', 'request_type', 'description']), async (req, res, next) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { principal_id, request_type, description, data_categories } = req.body;

    const year = new Date().getFullYear();
    const rand = Math.floor(10000 + Math.random() * 90000);
    const request_number = `DSR-${year}-${rand}`;

    const dueDate = new Date();
    dueDate.setDate(dueDate.getDate() + 30);

    const insertReq = await client.query(
      'INSERT INTO dsr_requests (request_number, principal_id, request_type, due_date, description, data_categories) VALUES ($1, $2, $3, $4, $5, $6) RETURNING id',
      [request_number, principal_id, request_type, dueDate, description, data_categories || []]
    );
    const requestId = insertReq.rows[0].id;

    if (request_type === 'access') {
      await client.query(
        'INSERT INTO dsr_access_details (request_id) VALUES ($1)',
        [requestId]
      );
    } else if (request_type === 'correction' || request_type === 'erasure') {
      await client.query(
        'INSERT INTO dsr_correction_erasure_details (request_id, action_type) VALUES ($1, $2)',
        [requestId, request_type]
      );
    } else if (request_type === 'grievance') {
      await client.query(
        'INSERT INTO dsr_grievance_details (request_id, grievance_reason) VALUES ($1, $2)',
        [requestId, description]
      );
    }

    await client.query(
      'INSERT INTO dsr_activity_log (request_id, action, performed_by, performed_by_role) VALUES ($1, $2, $3, $4)',
      [requestId, 'request_created', principal_id, 'principal']
    );

    await client.query('COMMIT');
    res.status(201).json({ id: requestId, request_number, due_date: dueDate });
  } catch (err) {
    await client.query('ROLLBACK');
    next(err);
  } finally {
    client.release();
  }
});

router.get('/', async (req, res, next) => {
  try {
    const { status, type, page = 1, limit = 20 } = req.query;
    const offset = (page - 1) * limit;

    let query = 'SELECT * FROM dsr_requests WHERE 1=1';
    const params = [];
    let paramIndex = 1;

    if (status) {
      query += ` AND status = $${paramIndex++}`;
      params.push(status);
    }
    if (type) {
      query += ` AND request_type = $${paramIndex++}`;
      params.push(type);
    }

    query += ` ORDER BY created_at DESC LIMIT $${paramIndex++} OFFSET $${paramIndex++}`;
    params.push(limit, offset);

    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (err) {
    next(err);
  }
});

router.get('/:id', async (req, res, next) => {
  try {
    const { id } = req.params;
    const result = await pool.query('SELECT * FROM dsr_requests WHERE id = $1', [id]);
    if (result.rows.length === 0) return res.status(404).json({ error: 'Request not found', status: 404 });

    const request = result.rows[0];
    let details = null;

    if (request.request_type === 'access') {
      const detailRes = await pool.query('SELECT * FROM dsr_access_details WHERE request_id = $1', [id]);
      details = detailRes.rows[0];
    } else if (request.request_type === 'correction' || request.request_type === 'erasure') {
      const detailRes = await pool.query('SELECT * FROM dsr_correction_erasure_details WHERE request_id = $1', [id]);
      details = detailRes.rows[0];
    } else if (request.request_type === 'grievance') {
      const detailRes = await pool.query('SELECT * FROM dsr_grievance_details WHERE request_id = $1', [id]);
      details = detailRes.rows[0];
    }

    const logRes = await pool.query('SELECT * FROM dsr_activity_log WHERE request_id = $1 ORDER BY created_at DESC', [id]);
    res.json({ ...request, details, activity_log: logRes.rows });
  } catch (err) {
    next(err);
  }
});

router.patch('/:id/status', validate(['status']), async (req, res, next) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { id } = req.params;
    const { status, performed_by } = req.body;

    let updateQuery = 'UPDATE dsr_requests SET status = $1';
    if (status === 'resolved') updateQuery += ', resolved_at = NOW()';
    updateQuery += ' WHERE id = $2 RETURNING *';

    const updateRes = await client.query(updateQuery, [status, id]);
    if (updateRes.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Request not found', status: 404 });
    }

    await client.query(
      'INSERT INTO dsr_activity_log (request_id, action, performed_by, performed_by_role) VALUES ($1, $2, $3, $4)',
      [id, `status_changed_to_${status}`, performed_by || 'system', 'system']
    );

    if (status === 'escalated') {
      const checkGrievance = await client.query('SELECT id FROM dsr_grievance_details WHERE request_id = $1', [id]);
      if (checkGrievance.rows.length === 0) {
        await client.query(
          'INSERT INTO dsr_grievance_details (request_id, grievance_reason, escalated_at) VALUES ($1, $2, NOW())',
          [id, 'Escalated via status update']
        );
      }
    }

    await client.query('COMMIT');
    res.json(updateRes.rows[0]);
  } catch (err) {
    await client.query('ROLLBACK');
    next(err);
  } finally {
    client.release();
  }
});

router.get('/:id/activity', async (req, res, next) => {
  try {
    const { id } = req.params;
    const result = await pool.query(
      'SELECT * FROM dsr_activity_log WHERE request_id = $1 ORDER BY created_at DESC',
      [id]
    );
    res.json(result.rows);
  } catch (err) {
    next(err);
  }
});

export default router;