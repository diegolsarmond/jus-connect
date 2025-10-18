import { Request, Response } from 'express';
import pool from '../services/db';

export const listTags = async (_req: Request, res: Response) => {
  try {
    const result = await pool.query('SELECT id, key, label, example, group_name FROM tags ORDER BY group_name, label');
    res.json(result.rows);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const createTag = async (req: Request, res: Response) => {
  const { key, label, example, group_name } = req.body;
  try {
    const result = await pool.query(
      'INSERT INTO tags (key, label, example, group_name) VALUES ($1, $2, $3, $4) RETURNING id, key, label, example, group_name',
      [key, label, example, group_name]
    );
    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const updateTag = async (req: Request, res: Response) => {
  const { id } = req.params;
  const { key, label, example, group_name } = req.body;
  try {
    const result = await pool.query(
      'UPDATE tags SET key = $1, label = $2, example = $3, group_name = $4 WHERE id = $5 RETURNING id, key, label, example, group_name',
      [key, label, example, group_name, id]
    );
    if (result.rowCount === 0) return res.status(404).json({ error: 'Tag not found' });
    res.json(result.rows[0]);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const deleteTag = async (req: Request, res: Response) => {
  const { id } = req.params;
  try {
    const result = await pool.query('DELETE FROM tags WHERE id = $1', [id]);
    if (result.rowCount === 0) return res.status(404).json({ error: 'Tag not found' });
    res.status(204).send();
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Internal server error' });
  }
};
