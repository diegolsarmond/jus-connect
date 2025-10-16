import { Request, Response } from 'express';
import pool from '../services/db';

export const listTiposEnvolvimento = async (req: Request, res: Response) => {
  try {
    if (!req.auth) {
      res.status(401).json({ error: 'Token inválido.' });
      return;
    }

    const result = await pool.query(
      'SELECT id, descricao FROM public.tipo_envolvimento ORDER BY descricao'
    );

    res.json(result.rows);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Erro interno do servidor.' });
  }
};
