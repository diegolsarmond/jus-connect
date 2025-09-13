import { Request, Response } from 'express';
import pool from '../services/db';
import { replaceVariables } from '../services/templateService';

export const generateDocument = async (req: Request, res: Response) => {
  const { templateId, values } = req.body;
  try {
    const result = await pool.query('SELECT content FROM templates WHERE id = $1', [templateId]);
    if (result.rowCount === 0) return res.status(404).json({ error: 'Template not found' });
    const content = result.rows[0].content as string;
    const filled = replaceVariables(content, values || {});
    res.json({ content: filled });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Internal server error' });
  }
};
