import { Request, Response } from 'express';
import pool from '../services/db';
import { fetchAuthenticatedUserEmpresa } from '../utils/authUser';

export const listTiposEvento = async (req: Request, res: Response) => {
  try {
    if (!req.auth) {
      return res.status(401).json({ error: 'Token inválido.' });
    }

    const empresaLookup = await fetchAuthenticatedUserEmpresa(req.auth.userId);

    if (!empresaLookup.success) {
      return res.status(empresaLookup.status).json({ error: empresaLookup.message });
    }

    const { empresaId } = empresaLookup;

    if (empresaId === null) {
      return res.json([]);
    }

    const result = await pool.query(
      'SELECT id, nome, ativo, datacriacao, agenda, tarefa FROM public.tipo_evento WHERE idempresa IS NOT DISTINCT FROM $1',
      [empresaId]
    );

    return res.json(result.rows);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const createTipoEvento = async (req: Request, res: Response) => {
  const { nome, ativo, agenda = true, tarefa = true } = req.body;
  try {
    if (!req.auth) {
      return res.status(401).json({ error: 'Token inválido.' });
    }

    const empresaLookup = await fetchAuthenticatedUserEmpresa(req.auth.userId);

    if (!empresaLookup.success) {
      return res.status(empresaLookup.status).json({ error: empresaLookup.message });
    }

    const { empresaId } = empresaLookup;

    if (empresaId === null) {
      return res
        .status(400)
        .json({ error: 'Usuário autenticado não possui empresa vinculada.' });
    }

    const result = await pool.query(
      'INSERT INTO public.tipo_evento (nome, ativo, agenda, tarefa, datacriacao, idempresa) VALUES ($1, $2, $3, $4, NOW(), $5) RETURNING id, nome, ativo, agenda, tarefa, datacriacao',
      [nome, ativo, agenda, tarefa, empresaId]
    );
    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const updateTipoEvento = async (req: Request, res: Response) => {
  const { id } = req.params;
  const { nome, ativo, agenda = true, tarefa = true } = req.body;
  try {
    if (!req.auth) {
      return res.status(401).json({ error: 'Token inválido.' });
    }

    const empresaLookup = await fetchAuthenticatedUserEmpresa(req.auth.userId);

    if (!empresaLookup.success) {
      return res.status(empresaLookup.status).json({ error: empresaLookup.message });
    }

    const { empresaId } = empresaLookup;

    if (empresaId === null) {
      return res
        .status(400)
        .json({ error: 'Usuário autenticado não possui empresa vinculada.' });
    }

    const result = await pool.query(
      'UPDATE public.tipo_evento SET nome = $1, ativo = $2, agenda = $3, tarefa = $4 WHERE id = $5 AND idempresa IS NOT DISTINCT FROM $6 RETURNING id, nome, ativo, agenda, tarefa, datacriacao',
      [nome, ativo, agenda, tarefa, id, empresaId]
    );
    if (result.rowCount === 0) {
      return res.status(404).json({ error: 'Tipo de evento não encontrado' });
    }
    res.json(result.rows[0]);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const deleteTipoEvento = async (req: Request, res: Response) => {
  const { id } = req.params;
  try {
    if (!req.auth) {
      return res.status(401).json({ error: 'Token inválido.' });
    }

    const empresaLookup = await fetchAuthenticatedUserEmpresa(req.auth.userId);

    if (!empresaLookup.success) {
      return res.status(empresaLookup.status).json({ error: empresaLookup.message });
    }

    const { empresaId } = empresaLookup;

    if (empresaId === null) {
      return res
        .status(400)
        .json({ error: 'Usuário autenticado não possui empresa vinculada.' });
    }

    const result = await pool.query(
      'DELETE FROM public.tipo_evento WHERE id = $1 AND idempresa IS NOT DISTINCT FROM $2',
      [id, empresaId]
    );
    if (result.rowCount === 0) {
      return res.status(404).json({ error: 'Tipo de evento não encontrado' });
    }
    res.status(204).send();
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

