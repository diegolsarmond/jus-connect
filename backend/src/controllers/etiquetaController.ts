import { Request, Response } from 'express';
import pool from '../services/db';

export const listEtiquetas = async (_req: Request, res: Response) => {
  try {
    const result = await pool.query(
      'SELECT id, nome, ativo, datacriacao, exibe_pipeline, ordem FROM public.etiquetas'
    );
    res.json(result.rows);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const createEtiqueta = async (req: Request, res: Response) => {
  const { nome, ativo, exibe_pipeline = true, ordem } = req.body;
  try {
    const result = await pool.query(
      'INSERT INTO public.etiquetas (nome, ativo, datacriacao, exibe_pipeline, ordem) VALUES ($1, $2, NOW(), $3, $4) RETURNING id, nome, ativo, datacriacao, exibe_pipeline, ordem',
      [nome, ativo, exibe_pipeline, ordem]
    );
    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const updateEtiqueta = async (req: Request, res: Response) => {
  const { id } = req.params;
  const { nome, ativo, exibe_pipeline = true, ordem } = req.body;
  try {
    const result = await pool.query(
      'UPDATE public.etiquetas SET nome = $1, ativo = $2, exibe_pipeline = $3, ordem = $4 WHERE id = $5 RETURNING id, nome, ativo, datacriacao, exibe_pipeline, ordem',
      [nome, ativo, exibe_pipeline, ordem, id]
    );
    if (result.rowCount === 0) {
      return res.status(404).json({ error: 'Etiqueta não encontrada' });
    }
    res.json(result.rows[0]);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const deleteEtiqueta = async (req: Request, res: Response) => {
  const { id } = req.params;
  try {
    const result = await pool.query(
      'DELETE FROM public.etiquetas WHERE id = $1',
      [id]
    );
    if (result.rowCount === 0) {
      return res.status(404).json({ error: 'Etiqueta não encontrada' });
    }
    res.status(204).send();
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

