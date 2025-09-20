import { Request, Response } from 'express';
import { DatabaseError, type QueryResult } from 'pg';
import pool from '../services/db';
import { fetchAuthenticatedUserEmpresa } from '../utils/authUser';

const VALID_STATUS_NUMBERS = new Set([0, 1, 2, 3]);

const STATUS_TEXT_TO_NUMBER = new Map<string, number>([
  ['cancelado', 0],
  ['cancelada', 0],
  ['agendado', 1],
  ['agendada', 1],
  ['em_curso', 2],
  ['emcurso', 2],
  ['em_andamento', 2],
  ['emandamento', 2],
  ['concluido', 3],
  ['concluida', 3],
]);

const normalizeAgendaStatus = (value: unknown): number => {
  if (typeof value === 'number' && Number.isFinite(value)) {
    const parsed = Math.trunc(value);
    if (VALID_STATUS_NUMBERS.has(parsed)) {
      return parsed;
    }
  }

  if (typeof value === 'string') {
    const trimmed = value.trim();

    if (trimmed === '') {
      return 1;
    }

    const numeric = Number(trimmed);
    if (Number.isFinite(numeric)) {
      const parsed = Math.trunc(numeric);
      if (VALID_STATUS_NUMBERS.has(parsed)) {
        return parsed;
      }
    }

    const normalized = trimmed
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '_')
      .replace(/^_+|_+$/g, '');

    const mapped =
      STATUS_TEXT_TO_NUMBER.get(normalized) ??
      STATUS_TEXT_TO_NUMBER.get(normalized.replace(/_/g, ''));

    if (mapped !== undefined) {
      return mapped;
    }
  }

  if (typeof value === 'boolean') {
    return value ? 1 : 0;
  }

  return 1;
};

const buildAgendaSelect = (cteName: string): string => `
  SELECT
    ${cteName}.id,
    ${cteName}.titulo,
    ${cteName}.tipo,
    te.nome AS tipo_evento,
    ${cteName}.descricao,
    ${cteName}.data,
    ${cteName}.hora_inicio,
    ${cteName}.hora_fim,
    CASE
      WHEN c.nome IS NOT NULL THEN c.nome
      WHEN ${cteName}.cliente IS NOT NULL THEN ${cteName}.cliente::text
      ELSE NULL
    END AS cliente,
    c.email AS cliente_email,
    c.telefone AS cliente_telefone,
    ${cteName}.tipo_local,
    ${cteName}.local,
    ${cteName}.lembrete,
    ${cteName}.status,
    ${cteName}.datacadastro,
    ${cteName}.dataatualizacao
  FROM ${cteName}
  LEFT JOIN public.tipo_evento te ON te.id = ${cteName}.tipo
  LEFT JOIN public.clientes c ON c.id = ${cteName}.cliente
`;

const buildAgendaFunctionQuery = (
  functionCall: string
): string => `
  WITH agenda_list AS (
    SELECT
      agenda.id,
      agenda.titulo,
      agenda.tipo,
      agenda.descricao,
      agenda.data,
      agenda.hora_inicio,
      agenda.hora_fim,
      agenda.cliente,
      agenda.tipo_local,
      agenda.local,
      agenda.lembrete,
      agenda.status,
      agenda.datacadastro,
      agenda.dataatualizacao
    FROM ${functionCall} AS agenda
  )
  ${buildAgendaSelect('agenda_list')}
  ORDER BY agenda_list.data, agenda_list.hora_inicio
`;

const isUndefinedFunctionError = (error: unknown): error is DatabaseError =>
  error instanceof DatabaseError && error.code === '42883';

export const listAgendas = async (req: Request, res: Response) => {
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

    const functionAttempts: Array<{ functionCall: string; params: Array<number | null> }> = [
      {
        functionCall: 'public.get_api_agendas($1, $2)',
        params: [empresaId, req.auth.userId],
      },
      {
        functionCall: 'public.get_api_agendas($1, $2)',
        params: [req.auth.userId, empresaId],
      },
      {
        functionCall: 'public.get_api_agendas($1)',
        params: [empresaId],
      },
      {
        functionCall: 'public.get_api_agendas($1)',
        params: [req.auth.userId],
      },
    ];

    let queryResult: QueryResult | undefined;
    for (const attempt of functionAttempts) {
      try {
        queryResult = await pool.query(
          buildAgendaFunctionQuery(attempt.functionCall),
          attempt.params
        );
        break;
      } catch (error) {
        if (isUndefinedFunctionError(error)) {
          continue;
        }

        throw error;
      }
    }

    if (!queryResult) {
      console.warn(
        'public.get_api_agendas não está disponível com as assinaturas esperadas. Utilizando consulta direta na tabela agenda.'
      );

      queryResult = await pool.query(
        `SELECT a.id,
                a.titulo,
                a.tipo,
                te.nome AS tipo_evento,
                a.descricao,
                a.data,
                a.hora_inicio,
                a.hora_fim,
                CASE
                  WHEN c.nome IS NOT NULL THEN c.nome
                  WHEN a.cliente IS NOT NULL THEN a.cliente::text
                  ELSE NULL
                END AS cliente,
                c.email AS cliente_email,
                c.telefone AS cliente_telefone,
                a.tipo_local,
                a.local,
                a.lembrete,
                a.status,
                a.datacadastro,
                a.dataatualizacao
           FROM public.agenda a
           LEFT JOIN public.tipo_evento te ON te.id = a.tipo
           LEFT JOIN public.clientes c ON c.id = a.cliente
          WHERE a.idempresa IS NOT DISTINCT FROM $1
            AND a.idusuario = $2
          ORDER BY a.data, a.hora_inicio`,
        [empresaId, req.auth.userId]
      );
    }

    res.json(queryResult.rows);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const listAgendasByEmpresa = async (req: Request, res: Response) => {
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
      `SELECT a.id,
              a.titulo,
              a.tipo,
              te.nome AS tipo_evento,
              a.descricao,
              a.data,
              a.hora_inicio,
              a.hora_fim,
              CASE
                WHEN c.nome IS NOT NULL THEN c.nome
                WHEN a.cliente IS NOT NULL THEN a.cliente::text
                ELSE NULL
              END AS cliente,
              c.email AS cliente_email,
              c.telefone AS cliente_telefone,
              a.tipo_local,
              a.local,
              a.lembrete,
              a.status,
              a.datacadastro,
              a.dataatualizacao
         FROM public.agenda a
         LEFT JOIN public.tipo_evento te ON te.id = a.tipo
         LEFT JOIN public.clientes c ON c.id = a.cliente
        WHERE a.idempresa IS NOT DISTINCT FROM $1
        ORDER BY a.data, a.hora_inicio`,
      [empresaId]
    );

    res.json(result.rows);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const getTotalCompromissosHoje = async (req: Request, res: Response) => {
  try {
    if (!req.auth) {
      return res.status(401).json({ error: 'Token inválido.' });
    }

    const result = await pool.query(
      `SELECT COUNT(*) AS total_compromissos_hoje
         FROM public.agenda
        WHERE "data" = CURRENT_DATE
          AND status <> 0
          AND idusuario = $1`,
      [req.auth.userId]
    );

    res.json({
      total_compromissos_hoje: Number.parseInt(result.rows[0].total_compromissos_hoje, 10),
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const createAgenda = async (req: Request, res: Response) => {
  const {
    titulo,
    tipo,
    descricao,
    data,
    hora_inicio,
    hora_fim,
    cliente,
    tipo_local,
    local,
    lembrete,
    status,
  } = req.body;

  const normalizedStatus = normalizeAgendaStatus(status);

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
      `WITH inserted AS (
         INSERT INTO public.agenda (
           titulo,
           tipo,
           descricao,
           data,
           hora_inicio,
           hora_fim,
           cliente,
           tipo_local,
           local,
           lembrete,
           status,
           datacadastro,
           idempresa,
           idusuario
         )
         VALUES (
           $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, NOW(), $12, $13
         )
         RETURNING id, titulo, tipo, descricao, data, hora_inicio, hora_fim, cliente, tipo_local, local, lembrete, status, datacadastro, idempresa, idusuario, dataatualizacao
       )
       ${buildAgendaSelect('inserted')}
       WHERE inserted.idempresa IS NOT DISTINCT FROM $12
         AND inserted.idusuario = $13`,
      [
        titulo,
        tipo,
        descricao,
        data,
        hora_inicio,
        hora_fim,
        cliente,
        tipo_local,
        local,
        lembrete,
        normalizedStatus,
        empresaId,
        req.auth.userId,
      ]
    );

    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const updateAgenda = async (req: Request, res: Response) => {
  const { id } = req.params;
  const {
    titulo,
    tipo,
    descricao,
    data,
    hora_inicio,
    hora_fim,
    cliente,
    tipo_local,
    local,
    lembrete,
    status,
  } = req.body;

  const normalizedStatus = normalizeAgendaStatus(status);

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
      return res.status(404).json({ error: 'Agenda não encontrada' });
    }

    const result = await pool.query(
      `WITH updated AS (
         UPDATE public.agenda
            SET titulo = $1,
                tipo = $2,
                descricao = $3,
                data = $4,
                hora_inicio = $5,
                hora_fim = $6,
                cliente = $7,
                tipo_local = $8,
                local = $9,
                lembrete = $10,
                status = $11,
                dataatualizacao = NOW()
          WHERE id = $12
            AND idempresa IS NOT DISTINCT FROM $13
            AND idusuario = $14
          RETURNING id, titulo, tipo, descricao, data, hora_inicio, hora_fim, cliente, tipo_local, local, lembrete, status, datacadastro, idempresa, idusuario, dataatualizacao
       )
       ${buildAgendaSelect('updated')}
       WHERE updated.idempresa IS NOT DISTINCT FROM $13
         AND updated.idusuario = $14`,
      [
        titulo,
        tipo,
        descricao,
        data,
        hora_inicio,
        hora_fim,
        cliente,
        tipo_local,
        local,
        lembrete,
        normalizedStatus,
        id,
        empresaId,
        req.auth.userId,
      ]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({ error: 'Agenda não encontrada' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const deleteAgenda = async (req: Request, res: Response) => {
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
      return res.status(404).json({ error: 'Agenda não encontrada' });
    }

    const result = await pool.query(
      'DELETE FROM public.agenda WHERE id = $1 AND idempresa IS NOT DISTINCT FROM $2 AND idusuario = $3',
      [id, empresaId, req.auth.userId]
    );
    if (result.rowCount === 0) {
      return res.status(404).json({ error: 'Agenda não encontrada' });
    }
    res.status(204).send();
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

