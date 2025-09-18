import { Request, Response } from 'express';
import pool from '../services/db';

export const listSituacoesProposta = async (_req: Request, res: Response) => {
  try {
    const result = await pool.query(
      'SELECT id, nome, ativo, datacriacao FROM public.situacao_proposta ORDER BY nome ASC'

    );
    res.json(result.rows);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const createSituacaoProposta = async (req: Request, res: Response) => {
  const { nome, ativo } = req.body;
  try {
    const result = await pool.query(
      'INSERT INTO public.situacao_proposta (nome, ativo, datacriacao) VALUES ($1, $2, NOW()) RETURNING id, nome, ativo, datacriacao',
      [nome, ativo]
    );
    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const updateSituacaoProposta = async (req: Request, res: Response) => {
  const { id } = req.params;
  const { nome, ativo } = req.body;
  try {
    const result = await pool.query(
      'UPDATE public.situacao_proposta SET nome = $1, ativo = $2 WHERE id = $3 RETURNING id, nome, ativo, datacriacao',
      [nome, ativo, id]
    );
    if (result.rowCount === 0) {
      return res.status(404).json({ error: 'Situação de proposta não encontrada' });
    }
    res.json(result.rows[0]);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const deleteSituacaoProposta = async (req: Request, res: Response) => {
  const { id } = req.params;
  try {
    const result = await pool.query(
      'DELETE FROM public.situacao_proposta WHERE id = $1',
      [id]
    );
    if (result.rowCount === 0) {
      return res.status(404).json({ error: 'Situação de proposta não encontrada' });
    }
    res.status(204).send();
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export default {
  listSituacoesProposta,
  createSituacaoProposta,
  updateSituacaoProposta,
  deleteSituacaoProposta,
};
