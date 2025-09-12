import { Request, Response } from 'express';
import pool from '../services/db';

export const listPerfis = async (_req: Request, res: Response) => {
  try {
    const result = await pool.query(
      'SELECT id, nome, ativo, datacriacao FROM public.perfis'
    );
    res.json(result.rows);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const createPerfil = async (req: Request, res: Response) => {
  const { nome, ativo } = req.body;
  try {
    const result = await pool.query(
      'INSERT INTO public.perfis (nome, ativo, datacriacao) VALUES ($1, $2, NOW()) RETURNING id, nome, ativo, datacriacao',
      [nome, ativo]
    );
    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const updatePerfil = async (req: Request, res: Response) => {
  const { id } = req.params;
  const { nome, ativo } = req.body;
  try {
    const result = await pool.query(
      'UPDATE public.perfis SET nome = $1, ativo = $2 WHERE id = $3 RETURNING id, nome, ativo, datacriacao',
      [nome, ativo, id]
    );
    if (result.rowCount === 0) {
      return res.status(404).json({ error: 'Perfil não encontrado' });
    }
    res.json(result.rows[0]);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const deletePerfil = async (req: Request, res: Response) => {
  const { id } = req.params;
  try {
    const result = await pool.query(
      'DELETE FROM public.perfis WHERE id = $1',
      [id]
    );
    if (result.rowCount === 0) {
      return res.status(404).json({ error: 'Perfil não encontrado' });
    }
    res.status(204).send();
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Internal server error' });
  }
};
