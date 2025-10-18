import { Request, Response } from 'express';
import pool from '../services/db';
import { fetchAuthenticatedUserEmpresa } from '../utils/authUser';

const getAuthenticatedUser = (
  req: Request,
  res: Response
): NonNullable<Request['auth']> | null => {
  if (!req.auth) {
    res.status(401).json({ error: 'Token inválido.' });
    return null;
  }

  return req.auth;
};

export const listAreas = async (req: Request, res: Response) => {
  try {
    const auth = getAuthenticatedUser(req, res);
    if (!auth) {
      return;
    }

    const empresaLookup = await fetchAuthenticatedUserEmpresa(auth.userId);

    if (!empresaLookup.success) {
      res
        .status(empresaLookup.status)
        .json({ error: empresaLookup.message });
      return;
    }

    const { empresaId } = empresaLookup;

    if (empresaId === null) {
      res
        .status(403)
        .json({ error: 'Usuário autenticado não possui empresa vinculada.' });
      return;
    }

    const result = await pool.query(
      'SELECT id, nome, ativo, datacriacao FROM public.area_atuacao WHERE idempresa = $1',
      [empresaId]
    );
    res.json(result.rows);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Erro interno do servidor.' });
  }
};

export const getAreaById = async (req: Request, res: Response) => {
  const { id } = req.params;
  try {
    const result = await pool.query(
      'SELECT id, nome, ativo, datacriacao FROM public.area_atuacao WHERE id = $1',
      [id]
    );
    if (result.rowCount === 0) {
      return res.status(404).json({ error: 'Area not found' });
    }
    res.json(result.rows[0]);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Erro interno do servidor.' });
  }
};

export const createArea = async (req: Request, res: Response) => {
  const { nome, ativo } = req.body;
  const ativoValue = typeof ativo === 'boolean' ? ativo : true;
  try {
    const auth = getAuthenticatedUser(req, res);
    if (!auth) {
      return;
    }

    const empresaLookup = await fetchAuthenticatedUserEmpresa(auth.userId);

    if (!empresaLookup.success) {
      res
        .status(empresaLookup.status)
        .json({ error: empresaLookup.message });
      return;
    }

    const { empresaId } = empresaLookup;

    if (empresaId === null) {
      res
        .status(403)
        .json({ error: 'Usuário autenticado não possui empresa vinculada.' });
      return;
    }

    const result = await pool.query(
      'INSERT INTO public.area_atuacao (nome, ativo, datacriacao, idempresa) VALUES ($1, $2, NOW(), $3) RETURNING id, nome, ativo, datacriacao',
      [nome, ativoValue, empresaId]
    );
    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Erro interno do servidor.' });
  }
};

export const updateArea = async (req: Request, res: Response) => {
  const { id } = req.params;
  const { nome, ativo } = req.body;
  try {
    const result = await pool.query(
      'UPDATE public.area_atuacao SET nome = $1, ativo = $2 WHERE id = $3 RETURNING id, nome, ativo, datacriacao',
      [nome, ativo, id]
    );
    if (result.rowCount === 0) {
      return res.status(404).json({ error: 'Area not found' });
    }
    res.json(result.rows[0]);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Erro interno do servidor.' });
  }
};

export const deleteArea = async (req: Request, res: Response) => {
  const { id } = req.params;
  try {
    const result = await pool.query(
      'UPDATE public.area_atuacao SET ativo = FALSE WHERE id = $1',
      [id]
    );
    if (result.rowCount === 0) {
      return res.status(404).json({ error: 'Area not found' });
    }
    res.status(204).send();
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Erro interno do servidor.' });
  }
};

