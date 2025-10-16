import { Request, Response } from 'express';
import pool from '../services/db';
import { fetchAuthenticatedUserEmpresa } from '../utils/authUser';

type NormalizedAreaAtuacaoId = {
  provided: boolean;
  value: number | null | undefined;
  error: boolean;
};

const normalizeAreaAtuacaoId = (input: unknown): NormalizedAreaAtuacaoId => {
  if (input === undefined) {
    return { provided: false, value: undefined, error: false };
  }
  if (Array.isArray(input)) {
    if (input.length === 0) {
      return { provided: true, value: null, error: false };
    }
    const normalized = normalizeAreaAtuacaoId(input[0]);
    return { provided: true, value: normalized.value, error: normalized.error };
  }
  if (input === null) {
    return { provided: true, value: null, error: false };
  }
  if (typeof input === 'string') {
    const trimmed = input.trim();
    if (trimmed === '' || trimmed.toLowerCase() === 'null') {
      return { provided: true, value: null, error: false };
    }
    const parsed = Number(trimmed);
    if (Number.isInteger(parsed) && parsed > 0) {
      return { provided: true, value: parsed, error: false };
    }
    return { provided: true, value: undefined, error: true };
  }
  if (typeof input === 'number') {
    if (Number.isInteger(input) && input > 0) {
      return { provided: true, value: input, error: false };
    }
    return { provided: true, value: undefined, error: true };
  }
  return { provided: true, value: undefined, error: true };
};

export const listTiposProcesso = async (req: Request, res: Response) => {
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
        .status(403)
        .json({ error: 'Usuário autenticado não possui empresa vinculada.' });
    }

    const areaAtuacao = normalizeAreaAtuacaoId(req.query.area_atuacao_id);

    if (areaAtuacao.error) {
      return res.status(400).json({ error: 'Parâmetro area_atuacao_id inválido.' });
    }

    let query =
      'SELECT id, nome, ativo, datacriacao, idareaatuacao AS area_atuacao_id FROM public.tipo_processo WHERE idempresa = $1';
    const params: Array<number> = [empresaId];

    if (areaAtuacao.provided && typeof areaAtuacao.value === 'number') {
      query += ' AND idareaatuacao = $2';
      params.push(areaAtuacao.value);
    }

    const result = await pool.query(query, params);
    return res.json(result.rows);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Erro interno do servidor.' });
  }
};

export const createTipoProcesso = async (req: Request, res: Response) => {
  const { nome, ativo } = req.body;
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
        .status(403)
        .json({ error: 'Usuário autenticado não possui empresa vinculada.' });
    }

    const areaAtuacao = normalizeAreaAtuacaoId(req.body.area_atuacao_id);

    if (areaAtuacao.error) {
      return res.status(400).json({ error: 'Campo area_atuacao_id inválido.' });
    }

    const areaAtuacaoId =
      areaAtuacao.value === undefined ? null : (areaAtuacao.value as number | null);

    if (areaAtuacao.provided && areaAtuacaoId !== null) {
      const areaLookup = await pool.query(
        'SELECT 1 FROM public.area_atuacao WHERE id = $1 AND idempresa IS NOT DISTINCT FROM $2',
        [areaAtuacaoId, empresaId]
      );

      if (areaLookup.rowCount === 0) {
        return res.status(400).json({ error: 'Área de atuação inválida.' });
      }
    }

    const result = await pool.query(
      'INSERT INTO public.tipo_processo (nome, ativo, datacriacao, idempresa, idareaatuacao) VALUES ($1, COALESCE($2, TRUE), NOW(), $3, $4) RETURNING id, nome, ativo, datacriacao, idareaatuacao AS area_atuacao_id',
      [nome, ativo, empresaId, areaAtuacaoId]
    );
    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Erro interno do servidor.' });
  }
};

export const updateTipoProcesso = async (req: Request, res: Response) => {
  const { id } = req.params;
  const { nome, ativo } = req.body;
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
        .status(403)
        .json({ error: 'Usuário autenticado não possui empresa vinculada.' });
    }

    const areaAtuacao = normalizeAreaAtuacaoId(req.body.area_atuacao_id);

    if (areaAtuacao.error) {
      return res.status(400).json({ error: 'Campo area_atuacao_id inválido.' });
    }

    let areaAtuacaoId: number | null | undefined = undefined;

    if (areaAtuacao.provided) {
      areaAtuacaoId = areaAtuacao.value === undefined ? null : areaAtuacao.value;

      if (areaAtuacaoId !== null) {
        const areaLookup = await pool.query(
          'SELECT 1 FROM public.area_atuacao WHERE id = $1 AND idempresa IS NOT DISTINCT FROM $2',
          [areaAtuacaoId, empresaId]
        );

        if (areaLookup.rowCount === 0) {
          return res.status(400).json({ error: 'Área de atuação inválida.' });
        }
      }
    }

    const params: Array<string | number | boolean | null> = [nome, ativo];
    const setClauses = ['nome = $1', 'ativo = COALESCE($2, TRUE)'];
    let paramIndex = 3;

    if (areaAtuacao.provided) {
      setClauses.push(`idareaatuacao = $${paramIndex}`);
      params.push(areaAtuacaoId as number | null);
      paramIndex += 1;
    }

    params.push(id, empresaId);

    const result = await pool.query(
      `UPDATE public.tipo_processo SET ${setClauses.join(', ')} WHERE id = $${paramIndex} AND idempresa IS NOT DISTINCT FROM $${paramIndex + 1} RETURNING id, nome, ativo, datacriacao, idareaatuacao AS area_atuacao_id`,
      params
    );
    if (result.rowCount === 0) {
      return res.status(404).json({ error: 'Tipo de processo não encontrado' });
    }
    res.json(result.rows[0]);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Erro interno do servidor.' });
  }
};

export const deleteTipoProcesso = async (req: Request, res: Response) => {
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
      'DELETE FROM public.tipo_processo WHERE id = $1 AND idempresa IS NOT DISTINCT FROM $2',
      [id, empresaId]
    );
    if (result.rowCount === 0) {
      return res.status(404).json({ error: 'Tipo de processo não encontrado' });
    }
    res.status(204).send();
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Erro interno do servidor.' });
  }
};

