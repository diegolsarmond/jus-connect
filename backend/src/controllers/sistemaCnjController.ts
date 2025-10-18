import { Request, Response } from 'express';
import pool from '../services/db';

export const listSistemasCnj = async (_req: Request, res: Response) => {
  try {
    const result = await pool.query('SELECT id, nome FROM public.sistema_cnj ORDER BY id asc');
    res.json(result.rows);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Internal server error' });
  }
};
