import { Request, Response } from 'express';
import pool from '../services/db';

export const listAreas = async (_req: Request, res: Response) => {
  try {
    const result = await pool.query(
      'SELECT id, nome, ativo, datacriacao FROM public.area_atuacao'
    );
    res.json(result.rows);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

