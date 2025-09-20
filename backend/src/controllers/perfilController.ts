import { Request, Response } from 'express';
import pool from '../services/db';
import {
  SYSTEM_MODULES,
  sanitizeModuleIds,
  sortModules,
} from '../constants/modules';
import { fetchAuthenticatedUserEmpresa } from '../utils/authUser';

const formatPerfilRow = (row: {
  id: number;
  nome: string;
  ativo: boolean;
  datacriacao: Date;
  modulos?: string[] | null;
}) => ({
  id: row.id,
  nome: row.nome,
  ativo: row.ativo,
  datacriacao: row.datacriacao,
  modulos: row.modulos ? sortModules(row.modulos) : [],
});

const parseModules = (value: unknown): { ok: true; modules: string[] } | { ok: false; error: string } => {
  try {
    const modules = sortModules(sanitizeModuleIds(value));
    return { ok: true, modules };
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'Não foi possível processar os módulos informados';
    return { ok: false, error: message };
  }
};

const parsePerfilId = (value: string): number | null => {
  const id = Number(value);
  if (!Number.isInteger(id) || id <= 0) {
    return null;
  }
  return id;
};

export const listPerfis = async (req: Request, res: Response) => {
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
      `SELECT p.id,
              p.nome,
              p.ativo,
              p.datacriacao,
              COALESCE(
                array_agg(pm.modulo ORDER BY pm.modulo) FILTER (WHERE pm.modulo IS NOT NULL),
                '{}'
              ) AS modulos
         FROM public.perfis p
    LEFT JOIN public.perfil_modulos pm ON pm.perfil_id = p.id
        WHERE p.idempresa IS NOT DISTINCT FROM $1
     GROUP BY p.id, p.nome, p.ativo, p.datacriacao
     ORDER BY p.nome`,
      [empresaId]
    );
    res.json(result.rows.map(formatPerfilRow));
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const listPerfilModules = async (_req: Request, res: Response) => {
  res.json(SYSTEM_MODULES);
};

export const createPerfil = async (req: Request, res: Response) => {
  const nomeValue = typeof req.body?.nome === 'string' ? req.body.nome.trim() : '';
  const ativoValue = typeof req.body?.ativo === 'boolean' ? req.body.ativo : true;
  const parsedModules = parseModules(req.body?.modulos);

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

  if (!nomeValue) {
    return res.status(400).json({ error: 'O nome do perfil é obrigatório' });
  }

  if (!parsedModules.ok) {
    return res.status(400).json({ error: parsedModules.error });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const result = await client.query(
      'INSERT INTO public.perfis (nome, ativo, datacriacao, idempresa) VALUES ($1, $2, NOW(), $3) RETURNING id, nome, ativo, datacriacao',
      [nomeValue, ativoValue, empresaId]
    );

    const perfil = result.rows[0];

    if (parsedModules.modules.length > 0) {
      await client.query(
        'INSERT INTO public.perfil_modulos (perfil_id, modulo) SELECT $1, unnest($2::text[])',
        [perfil.id, parsedModules.modules]
      );
    }

    await client.query('COMMIT');

    res.status(201).json({
      ...perfil,
      modulos: parsedModules.modules,
    });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error(error);
    res.status(500).json({ error: 'Internal server error' });
  } finally {
    client.release();
  }
};

export const updatePerfil = async (req: Request, res: Response) => {
  const parsedId = parsePerfilId(req.params.id);
  if (parsedId == null) {
    return res.status(400).json({ error: 'ID de perfil inválido' });
  }

  const nomeValue = typeof req.body?.nome === 'string' ? req.body.nome.trim() : '';
  const ativoValue = typeof req.body?.ativo === 'boolean' ? req.body.ativo : true;
  const parsedModules = parseModules(req.body?.modulos);

  if (!nomeValue) {
    return res.status(400).json({ error: 'O nome do perfil é obrigatório' });
  }

  if (!parsedModules.ok) {
    return res.status(400).json({ error: parsedModules.error });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const result = await client.query(
      'UPDATE public.perfis SET nome = $1, ativo = $2 WHERE id = $3 RETURNING id, nome, ativo, datacriacao',
      [nomeValue, ativoValue, parsedId]
    );

    if (result.rowCount === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Perfil não encontrado' });
    }

    await client.query('DELETE FROM public.perfil_modulos WHERE perfil_id = $1', [parsedId]);

    if (parsedModules.modules.length > 0) {
      await client.query(
        'INSERT INTO public.perfil_modulos (perfil_id, modulo) SELECT $1, unnest($2::text[])',
        [parsedId, parsedModules.modules]
      );
    }

    await client.query('COMMIT');

    res.json({
      ...result.rows[0],
      modulos: parsedModules.modules,
    });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error(error);
    res.status(500).json({ error: 'Internal server error' });
  } finally {
    client.release();
  }
};

export const deletePerfil = async (req: Request, res: Response) => {
  const parsedId = parsePerfilId(req.params.id);
  if (parsedId == null) {
    return res.status(400).json({ error: 'ID de perfil inválido' });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const exists = await client.query('SELECT 1 FROM public.perfis WHERE id = $1', [parsedId]);
    if (exists.rowCount === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Perfil não encontrado' });
    }

    await client.query('DELETE FROM public.perfil_modulos WHERE perfil_id = $1', [parsedId]);
    await client.query('DELETE FROM public.perfis WHERE id = $1', [parsedId]);

    await client.query('COMMIT');

    res.status(204).send();
  } catch (error) {
    await client.query('ROLLBACK');
    console.error(error);
    res.status(500).json({ error: 'Internal server error' });
  } finally {
    client.release();
  }
};
