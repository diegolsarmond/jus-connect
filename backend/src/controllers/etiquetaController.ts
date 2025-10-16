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

export const listEtiquetas = async (req: Request, res: Response) => {
  try {
    const auth = getAuthenticatedUser(req, res);
    if (!auth) {
      return;
    }

    const empresaLookup = await fetchAuthenticatedUserEmpresa(auth.userId);

    if (!empresaLookup.success) {
      res.status(empresaLookup.status).json({ error: empresaLookup.message });
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
      'SELECT id, nome, ativo, datacriacao, exibe_pipeline, ordem, id_fluxo_trabalho, idempresa FROM public.etiquetas WHERE idempresa IS NOT DISTINCT FROM $1',
      [empresaId]
    );
    res.json(result.rows);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const listEtiquetasByFluxoTrabalho = async (req: Request, res: Response) => {
  const { id } = req.params;
  try {
    const result = await pool.query(
      'SELECT id, nome FROM public.etiquetas WHERE id_fluxo_trabalho = $1',
      [id]
    );
    res.json(result.rows);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const createEtiqueta = async (req: Request, res: Response) => {
  const { nome, ativo, exibe_pipeline = true, ordem, id_fluxo_trabalho } = req.body;
  try {
    const auth = getAuthenticatedUser(req, res);
    if (!auth) {
      return;
    }

    const empresaLookup = await fetchAuthenticatedUserEmpresa(auth.userId);

    if (!empresaLookup.success) {
      res.status(empresaLookup.status).json({ error: empresaLookup.message });
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
      'INSERT INTO public.etiquetas (nome, ativo, datacriacao, exibe_pipeline, ordem, id_fluxo_trabalho, idempresa) VALUES ($1, $2, NOW(), $3, $4, $5, $6) RETURNING id, nome, ativo, datacriacao, exibe_pipeline, ordem, id_fluxo_trabalho, idempresa',
      [nome, ativo, exibe_pipeline, ordem, id_fluxo_trabalho, empresaId]
    );
    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const updateEtiqueta = async (req: Request, res: Response) => {
  const { id } = req.params;
  const { nome, ativo, exibe_pipeline = true, ordem, id_fluxo_trabalho } = req.body;
  try {
    const result = await pool.query(
      'UPDATE public.etiquetas SET nome = $1, ativo = $2, exibe_pipeline = $3, ordem = $4, id_fluxo_trabalho = $5 WHERE id = $6 RETURNING id, nome, ativo, datacriacao, exibe_pipeline, ordem, id_fluxo_trabalho',
      [nome, ativo, exibe_pipeline, ordem, id_fluxo_trabalho, id]
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

