import express from 'express';
import { pool } from '../config/db.js';
import validate from '../middleware/validate.js';

const router = express.Router();

router.post('/', validate(['principal_id', 'nominee_name', 'nominee_email']), async (req, res, next) => {
  try {
    const { principal_id, nominee_name, nominee_email, nominee_phone, relationship } = req.body;
    const result = await pool.query(
      'INSERT INTO nominees (principal_id, nominee_name, nominee_email, nominee_phone, relationship) VALUES ($1, $2, $3, $4, $5) RETURNING *',
      [principal_id, nominee_name, nominee_email, nominee_phone, relationship]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    next(err);
  }
});

router.get('/principal/:id', async (req, res, next) => {
  try {
    const { id } = req.params;
    const result = await pool.query('SELECT * FROM nominees WHERE principal_id = $1', [id]);
    res.json(result.rows);
  } catch (err) {
    next(err);
  }
});

router.patch('/:id/deactivate', async (req, res, next) => {
  try {
    const { id } = req.params;
    const result = await pool.query('UPDATE nominees SET is_active = false WHERE id = $1 RETURNING *', [id]);
    if (result.rows.length === 0) return res.status(404).json({ error: 'Nominee not found', status: 404 });
    res.json(result.rows[0]);
  } catch (err) {
    next(err);
  }
});

export default router;