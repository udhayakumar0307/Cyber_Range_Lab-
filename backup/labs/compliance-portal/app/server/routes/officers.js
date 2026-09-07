import express from 'express';
import { pool } from '../config/db.js';
import validate from '../middleware/validate.js';

const router = express.Router();

router.post('/', validate(['name', 'email']), async (req, res, next) => {
  try {
    const { name, email, phone, department } = req.body;
    const result = await pool.query(
      'INSERT INTO grievance_officers (name, email, phone, department) VALUES ($1, $2, $3, $4) RETURNING *',
      [name, email, phone, department]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    next(err);
  }
});

router.get('/', async (req, res, next) => {
  try {
    const result = await pool.query('SELECT * FROM grievance_officers ORDER BY appointed_at DESC');
    res.json(result.rows);
  } catch (err) {
    next(err);
  }
});

export default router;