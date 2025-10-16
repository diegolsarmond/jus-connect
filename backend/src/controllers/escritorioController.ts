import { Request, Response } from 'express';
import pool from '../services/db';
import { fetchAuthenticatedUserEmpresa } from '../utils/authUser';

const getAuthenticatedEmpresaId = async (
  req: Request,
  res: Response
): Promise<number | null | undefined> => {
  if (!req.auth) {
    res.status(401).json({ error: 'Token inválido.' });
    return undefined;
  }

  const empresaLookup = await fetchAuthenticatedUserEmpresa(req.auth.userId);

  if (!empresaLookup.success) {
    res.status(empresaLookup.status).json({ error: empresaLookup.message });
    return undefined;
  }

  return empresaLookup.empresaId;
};

const ensureAuthenticatedEmpresaId = async (
  req: Request,
  res: Response
): Promise<number | undefined> => {
  const empresaId = await getAuthenticatedEmpresaId(req, res);
  if (empresaId === undefined) {
    return undefined;
  }

  if (empresaId === null) {
    res
      .status(403)
      .json({ error: 'Usuário autenticado não possui empresa vinculada.' });
    return undefined;
  }

  return empresaId;
};

export const listEscritorios = async (req: Request, res: Response) => {
  try {
    const empresaId = await getAuthenticatedEmpresaId(req, res);
    if (empresaId === undefined) {
      return;
    }

    if (empresaId === null) {
      res
        .status(403)
        .json({ error: 'Usuário autenticado não possui empresa vinculada.' });
      return;
    }

    const result = await pool.query(
      `SELECT e.id,
              e.nome,
              e.empresa,
              emp.nome_empresa AS empresa_nome,
              e.ativo,
              e.datacriacao
         FROM public.escritorios e
         LEFT JOIN public.empresas emp ON emp.id = e.empresa
        WHERE e.empresa IS NOT DISTINCT FROM $1
         ORDER BY e.nome`,
      [empresaId]
    );
    res.json(result.rows);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const createEscritorio = async (req: Request, res: Response) => {
  const { nome, ativo } = req.body;
  const nomeTrimmed = typeof nome === 'string' ? nome.trim() : '';
  if (!nomeTrimmed) {
    return res.status(400).json({ error: 'Nome é obrigatório' });
  }

  const empresaId = await ensureAuthenticatedEmpresaId(req, res);
  if (empresaId === undefined) {
    return;
  }

  const ativoValue = typeof ativo === 'boolean' ? ativo : true;

  try {
    const result = await pool.query(
      `WITH inserted AS (
         INSERT INTO public.escritorios (nome, empresa, ativo, datacriacao)
         VALUES ($1, $2, $3, NOW())
         RETURNING id, nome, empresa, ativo, datacriacao
       )
       SELECT i.id,
              i.nome,
              i.empresa,
              emp.nome_empresa AS empresa_nome,
              i.ativo,
              i.datacriacao
         FROM inserted i
         LEFT JOIN public.empresas emp ON emp.id = i.empresa`,
      [nomeTrimmed, empresaId, ativoValue]
    );
    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const updateEscritorio = async (req: Request, res: Response) => {
  const { id } = req.params;
  const { nome, ativo } = req.body;
  const nomeTrimmed = typeof nome === 'string' ? nome.trim() : '';
  if (!nomeTrimmed) {
    return res.status(400).json({ error: 'Nome é obrigatório' });
  }

  const empresaId = await ensureAuthenticatedEmpresaId(req, res);
  if (empresaId === undefined) {
    return;
  }

  const ativoValue = typeof ativo === 'boolean' ? ativo : true;

  try {
    const result = await pool.query(
      `WITH updated AS (
         UPDATE public.escritorios
            SET nome = $1,
                empresa = $2,
                ativo = $3
          WHERE id = $4
            AND empresa IS NOT DISTINCT FROM $2
          RETURNING id, nome, empresa, ativo, datacriacao
       )
       SELECT u.id,
              u.nome,
              u.empresa,
              emp.nome_empresa AS empresa_nome,
              u.ativo,
              u.datacriacao
         FROM updated u
         LEFT JOIN public.empresas emp ON emp.id = u.empresa`,
      [nomeTrimmed, empresaId, ativoValue, id]
    );
    if (result.rowCount === 0) {
      return res.status(404).json({ error: 'Setor não encontrado' });
    }
    res.json(result.rows[0]);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const deleteEscritorio = async (req: Request, res: Response) => {
  const { id } = req.params;
  const empresaId = await ensureAuthenticatedEmpresaId(req, res);
  if (empresaId === undefined) {
    return;
  }
  try {
    const result = await pool.query(
      'DELETE FROM public.escritorios WHERE id = $1 AND empresa IS NOT DISTINCT FROM $2',
      [id, empresaId]
    );
    if (result.rowCount === 0) {
      return res.status(404).json({ error: 'Setor não encontrado' });
    }
    res.status(204).send();
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

