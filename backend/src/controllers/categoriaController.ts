import { Request, Response } from 'express';
import pool from '../services/db';

const parseAtivo = (value: unknown, fallback = true) => {
  if (typeof value === 'boolean') {
    return value;
  }

  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase();
    if (['true', '1', 'yes', 'sim'].includes(normalized)) {
      return true;
    }
    if (['false', '0', 'no', 'não', 'nao'].includes(normalized)) {
      return false;
    }
  }

  if (typeof value === 'number') {
    return value !== 0;
  }

  return fallback;
};

export const listCategorias = async (_req: Request, res: Response) => {
  try {
    const result = await pool.query(
      'SELECT id, nome, ativo, datacriacao FROM public.categorias ORDER BY nome',
    );
    res.json(result.rows);
  } catch (error) {
    console.error('Failed to list categorias', error);
    res.status(500).json({ error: 'Erro interno do servidor.' });
  }
};

export const createCategoria = async (req: Request, res: Response) => {
  const nome = typeof req.body?.nome === 'string' ? req.body.nome.trim() : '';
  const ativo = parseAtivo(req.body?.ativo, true);

  if (!nome) {
    return res.status(400).json({ error: 'Nome é obrigatório' });
  }

  try {
    const result = await pool.query(
      'INSERT INTO public.categorias (nome, ativo, datacriacao) VALUES ($1, $2, NOW()) RETURNING id, nome, ativo, datacriacao',
      [nome, ativo],
    );

    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Failed to create categoria', error);

    if (
      error &&
      typeof error === 'object' &&
      'code' in error &&
      (error as { code: string }).code === '23505'
    ) {
      return res.status(409).json({ error: 'Categoria já cadastrada' });
    }

    res.status(500).json({ error: 'Erro interno do servidor.' });
  }
};

export const updateCategoria = async (req: Request, res: Response) => {
  const { id } = req.params;
  const nome = typeof req.body?.nome === 'string' ? req.body.nome.trim() : '';
  const ativo = parseAtivo(req.body?.ativo, true);

  if (!nome) {
    return res.status(400).json({ error: 'Nome é obrigatório' });
  }

  try {
    const result = await pool.query(
      'UPDATE public.categorias SET nome = $1, ativo = $2 WHERE id = $3 RETURNING id, nome, ativo, datacriacao',
      [nome, ativo, id],
    );

    if (result.rowCount === 0) {
      return res.status(404).json({ error: 'Categoria não encontrada' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Failed to update categoria', error);

    if (
      error &&
      typeof error === 'object' &&
      'code' in error &&
      (error as { code: string }).code === '23505'
    ) {
      return res.status(409).json({ error: 'Categoria já cadastrada' });
    }

    res.status(500).json({ error: 'Erro interno do servidor.' });
  }
};

export const deleteCategoria = async (req: Request, res: Response) => {
  const { id } = req.params;

  try {
    const result = await pool.query('DELETE FROM public.categorias WHERE id = $1', [id]);

    if (result.rowCount === 0) {
      return res.status(404).json({ error: 'Categoria não encontrada' });
    }

    res.status(204).send();
  } catch (error) {
    console.error('Failed to delete categoria', error);
    res.status(500).json({ error: 'Erro interno do servidor.' });
  }
};

