import { Request, Response } from 'express';
import pool from '../services/db';

export const listTemplates = async (_req: Request, res: Response) => {
  try {
    const result = await pool.query('SELECT id, title, content FROM templates ORDER BY id');
    res.json(result.rows);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const getTemplate = async (req: Request, res: Response) => {
  const { id } = req.params;
  try {
    const result = await pool.query('SELECT id, title, content FROM templates WHERE id = $1', [id]);
    if (result.rowCount === 0) return res.status(404).json({ error: 'Template not found' });
    res.json(result.rows[0]);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const createTemplate = async (req: Request, res: Response) => {
  const { title, content } = req.body;
  try {
    const result = await pool.query(
      'INSERT INTO templates (title, content) VALUES ($1, $2) RETURNING id, title, content',
      [title, content]
    );
    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const updateTemplate = async (req: Request, res: Response) => {
  const { id } = req.params;
  const { title, content } = req.body;
  try {
    const result = await pool.query(
      'UPDATE templates SET title = $1, content = $2 WHERE id = $3 RETURNING id, title, content',
      [title, content, id]
    );
    if (result.rowCount === 0) return res.status(404).json({ error: 'Template not found' });
    res.json(result.rows[0]);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const deleteTemplate = async (req: Request, res: Response) => {
  const { id } = req.params;
  try {
    const result = await pool.query('DELETE FROM templates WHERE id = $1', [id]);
    if (result.rowCount === 0) return res.status(404).json({ error: 'Template not found' });
    res.status(204).send();
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const generateWithAI = async (_req: Request, res: Response) => {
  res.json({ content: 'Exemplo gerado com IA' });
};
