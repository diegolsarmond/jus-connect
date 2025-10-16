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

export const listTiposDocumento = async (req: Request, res: Response) => {
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
      'SELECT id, nome, ativo, datacriacao FROM public.tipo_documento WHERE idempresa = $1',
      [empresaId]
    );
    res.json(result.rows);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Erro interno do servidor.' });
  }
};

export const createTipoDocumento = async (req: Request, res: Response) => {
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
      'INSERT INTO public.tipo_documento (nome, ativo, datacriacao, idempresa) VALUES ($1, $2, NOW(), $3) RETURNING id, nome, ativo, datacriacao',
      [nome, ativoValue, empresaId]
    );
    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Erro interno do servidor.' });
  }
};

export const updateTipoDocumento = async (req: Request, res: Response) => {
  const { id } = req.params;
  const { nome, ativo } = req.body;
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
      'UPDATE public.tipo_documento SET nome = $1, ativo = $2 WHERE id = $3 AND idempresa IS NOT DISTINCT FROM $4 RETURNING id, nome, ativo, datacriacao',
      [nome, ativo, id, empresaId]
    );
    if (result.rowCount === 0) {
      res.status(404).json({ error: 'Tipo de documento não encontrado' });
      return;
    }
    res.json(result.rows[0]);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Erro interno do servidor.' });
  }
};

export const deleteTipoDocumento = async (req: Request, res: Response) => {
  const { id } = req.params;
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
      'DELETE FROM public.tipo_documento WHERE id = $1 AND idempresa IS NOT DISTINCT FROM $2',
      [id, empresaId]
    );
    if (result.rowCount === 0) {
      res.status(404).json({ error: 'Tipo de documento não encontrado' });
      return;
    }
    res.status(204).send();
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Erro interno do servidor.' });
  }
};

