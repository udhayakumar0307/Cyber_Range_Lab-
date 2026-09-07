import express from 'express';
import { pool } from '../config/db.js';
import validate from '../middleware/validate.js';

const router = express.Router();

router.post('/register', validate(['full_name', 'email']), async (req, res, next) => {
  try {
    const { full_name, email, phone } = req.body;
    const result = await pool.query(
      'INSERT INTO data_principals (full_name, email, phone) VALUES ($1, $2, $3) RETURNING *',
      [full_name, email, phone]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    next(err);
  }
});

router.get('/lookup/:email', async (req, res, next) => {
  try {
    const { email } = req.params;
    const result = await pool.query(
      'SELECT * FROM data_principals WHERE email = $1',
      [email]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'No record found for this email', status: 404 });
    }
    res.json(result.rows[0]);
  } catch (err) {
    next(err);
  }
});

router.get('/:id', async (req, res, next) => {
  try {
    const { id } = req.params;
    const result = await pool.query('SELECT * FROM data_principals WHERE id = $1', [id]);
    if (result.rows.length === 0) return res.status(404).json({ error: 'Principal not found', status: 404 });
    res.json(result.rows[0]);
  } catch (err) {
    next(err);
  }
});

export default router;