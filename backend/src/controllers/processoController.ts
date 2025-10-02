import { Request, Response } from 'express';
import { PoolClient } from 'pg';
import {
  fetchPlanLimitsForCompany,
  countCompanyResource,
} from '../services/planLimitsService';

import pool from '../services/db';
import { createNotification } from '../services/notificationService';
import { Processo } from '../models/processo';
import { fetchAuthenticatedUserEmpresa } from '../utils/authUser';
import { evaluateProcessSyncAvailability } from '../services/processSyncQuotaService';

const normalizeString = (value: unknown): string | null => {
  if (typeof value !== 'string') {
    return null;
  }

  const trimmed = value.trim();
  return trimmed === '' ? null : trimmed;
};

const normalizeUppercase = (value: unknown): string | null => {
  const normalized = normalizeString(value);
  return normalized ? normalized.toUpperCase() : null;
};

const resolveNullablePositiveInteger = (
  value: unknown,
): { ok: true; value: number | null } | { ok: false } => {
  if (value === undefined || value === null) {
    return { ok: true, value: null };
  }

  if (typeof value === 'number') {
    if (Number.isInteger(value) && value > 0) {
      return { ok: true, value };
    }
    return { ok: false };
  }

  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!trimmed) {
      return { ok: true, value: null };
    }

    const parsed = Number.parseInt(trimmed, 10);
    if (Number.isFinite(parsed) && parsed > 0) {
      return { ok: true, value: parsed };
    }

    return { ok: false };
  }

  return { ok: false };
};

const resolveNullableNonNegativeInteger = (
  value: unknown,
): { ok: true; value: number | null } | { ok: false } => {
  if (value === undefined || value === null) {
    return { ok: true, value: null };
  }

  if (typeof value === 'number') {
    if (Number.isInteger(value) && value >= 0) {
      return { ok: true, value };
    }
    return { ok: false };
  }

  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!trimmed) {
      return { ok: true, value: null };
    }

    const parsed = Number.parseInt(trimmed, 10);
    if (Number.isFinite(parsed) && parsed >= 0) {
      return { ok: true, value: parsed };
    }

    return { ok: false };
  }

  return { ok: false };
};

const parseBooleanFlag = (value: unknown): boolean | null => {
  if (typeof value === 'boolean') {
    return value;
  }

  if (typeof value === 'number') {
    if (!Number.isFinite(value)) {
      return null;
    }

    return value !== 0;
  }

  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase();
    if (!normalized) {
      return null;
    }

    if (
      [
        '1',
        'true',
        't',
        'yes',
        'y',
        'sim',
        'on',
        'habilitado',
        'habilitada',
        'ativo',
        'ativa',
      ].includes(normalized)
    ) {
      return true;
    }

    if (
      [
        '0',
        'false',
        'f',
        'no',
        'n',
        'nao',
        'não',
        'off',
        'desabilitado',
        'desabilitada',
        'inativo',
        'inativa',
      ].includes(normalized)
    ) {
      return false;
    }
  }

  return null;
};

const normalizeDate = (value: unknown): string | null => {
  if (value === null || value === undefined) {
    return null;
  }

  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value.toISOString().slice(0, 10);
  }

  if (typeof value === 'number') {
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? null : date.toISOString().slice(0, 10);
  }

  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (trimmed === '') {
      return null;
    }

    const isoCandidate = new Date(trimmed);
    if (!Number.isNaN(isoCandidate.getTime())) {
      return isoCandidate.toISOString().slice(0, 10);
    }

    const brFormatMatch = trimmed.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
    if (brFormatMatch) {
      const [, day, month, year] = brFormatMatch;
      return `${year}-${month}-${day}`;
    }

    const isoFormatMatch = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (isoFormatMatch) {
      return trimmed;
    }
  }

  return null;
};

const normalizeTimestamp = (value: unknown): string | null => {
  if (value === null || value === undefined) {
    return null;
  }

  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value.toISOString();
  }

  if (typeof value === 'number') {
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? null : date.toISOString();
  }

  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!trimmed) {
      return null;
    }

    const parsed = new Date(trimmed);
    if (!Number.isNaN(parsed.getTime())) {
      return parsed.toISOString();
    }

    return trimmed;
  }

  return null;
};

const parseInteger = (value: unknown): number => {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return Math.trunc(value);
  }

  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!trimmed) {
      return 0;
    }

    const parsed = Number.parseInt(trimmed, 10);
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }

  return 0;
};

const parseOptionalInteger = (value: unknown): number | null => {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return Math.trunc(value);
  }

  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!trimmed) {
      return null;
    }

    const parsed = Number.parseInt(trimmed, 10);
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }

  return null;
};

type RawAdvogado = {
  id?: number | string | null;
  nome?: string | null;
  name?: string | null;
};

const parseAdvogados = (value: unknown): Processo['advogados'] => {
  const advogados: Processo['advogados'] = [];

  const processRawItem = (item: unknown) => {
    if (!item || typeof item !== 'object') {
      return;
    }

    const raw = item as RawAdvogado;
    const idCandidate = raw.id ?? null;
    let parsedId: number | null = null;

    if (typeof idCandidate === 'number' && Number.isInteger(idCandidate)) {
      parsedId = idCandidate;
    } else if (typeof idCandidate === 'string') {
      const trimmed = idCandidate.trim();
      if (trimmed) {
        const parsed = Number.parseInt(trimmed, 10);
        if (Number.isFinite(parsed)) {
          parsedId = parsed;
        }
      }
    }

    if (!parsedId || parsedId <= 0) {
      return;
    }

    const nomeValue =
      typeof raw.nome === 'string'
        ? raw.nome
        : typeof raw.name === 'string'
          ? raw.name
          : null;

    advogados.push({ id: parsedId, nome: nomeValue });
  };

  if (Array.isArray(value)) {
    value.forEach(processRawItem);
    return advogados;
  }

  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value);
      if (Array.isArray(parsed)) {
        parsed.forEach(processRawItem);
      } else {
        processRawItem(parsed);
      }
    } catch {
      // ignore invalid JSON
    }

    return advogados;
  }

  if (value && typeof value === 'object' && 'rows' in (value as Record<string, unknown>)) {
    const possibleArray = (value as { rows?: unknown[] }).rows;
    if (Array.isArray(possibleArray)) {
      possibleArray.forEach(processRawItem);
    }
  }

  return advogados;
};

type RawMovimentacao = {
  id?: number | string | null;
  data?: string | null;
  tipo?: string | null;
  tipo_publicacao?: string | null;
  classificacao_predita?: Record<string, unknown> | null;
  conteudo?: string | null;
  texto_categoria?: string | null;
  fonte?: Record<string, unknown> | null;
  criado_em?: string | null;
  atualizado_em?: string | null;
};

const parseMovimentacoes = (value: unknown): Processo['movimentacoes'] => {
  const movimentacoes: Processo['movimentacoes'] = [];

  const processItem = (item: unknown) => {
    if (!item || typeof item !== 'object') {
      return;
    }

    const raw = item as RawMovimentacao;
    const idCandidate = raw.id ?? null;
    let parsedId: string | null = null;

    if (typeof idCandidate === 'number' && Number.isFinite(idCandidate)) {
      parsedId = String(Math.trunc(idCandidate));
    } else if (typeof idCandidate === 'string') {
      const trimmed = idCandidate.trim();
      if (trimmed) {
        parsedId = trimmed;
      }
    }

    if (!parsedId) {
      return;
    }

    movimentacoes.push({
      id: parsedId,
      data: raw.data ?? null,
      tipo: raw.tipo ?? null,
      tipo_publicacao: raw.tipo_publicacao ?? null,
      classificacao_predita: raw.classificacao_predita ?? null,
      conteudo: raw.conteudo ?? null,
      texto_categoria: raw.texto_categoria ?? null,
      fonte: raw.fonte ?? null,
      criado_em: raw.criado_em ?? null,
      atualizado_em: raw.atualizado_em ?? null,
    });
  };

  if (Array.isArray(value)) {
    value.forEach(processItem);
    return movimentacoes;
  }

  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value);
      if (Array.isArray(parsed)) {
        parsed.forEach(processItem);
      } else {
        processItem(parsed);
      }
    } catch {
      // ignore invalid JSON
    }

    return movimentacoes;
  }

  return movimentacoes;
};

const MOVIMENTACOES_DEFAULT_LIMIT = 200;

const MOVIMENTACOES_BASE_QUERY = `
  WITH movimentacoes AS (
    SELECT
      tmp.id_andamento::text AS id,
      tmp.data_andamento AS data,
      NULL::text AS tipo,
      NULL::text AS tipo_publicacao,
      NULL::jsonb AS classificacao_predita,
      NULL::text AS conteudo,
      NULL::text AS texto_categoria,
      NULL::jsonb AS fonte,
      NULL::timestamptz AS criado_em,
      tmp.atualizado_em
    FROM public.trigger_movimentacao_processo tmp
    JOIN public.processos p ON p.numero = tmp.numero_cnj
    WHERE p.id = $1

    UNION ALL

    SELECT
      pm.id::text AS id,
      pm.data,
      pm.tipo,
      pm.tipo_publicacao,
      pm.classificacao_predita,
      pm.conteudo,
      pm.texto_categoria,
      pm.fonte,
      pm.criado_em,
      pm.atualizado_em
    FROM public.processo_movimentacoes pm
    WHERE pm.processo_id = $1
  )
  SELECT
    id,
    data,
    tipo,
    tipo_publicacao,
    classificacao_predita,
    conteudo,
    texto_categoria,
    fonte,
    criado_em,
    atualizado_em
  FROM movimentacoes
  ORDER BY
    data DESC NULLS LAST,
    CASE WHEN id ~ '^[0-9]+$' THEN id::bigint ELSE NULL END DESC NULLS LAST,
    id DESC
`;

const fetchProcessoMovimentacoes = async (
  processoId: number,
  client?: PoolClient,
  limit: number = MOVIMENTACOES_DEFAULT_LIMIT,
): Promise<Processo['movimentacoes']> => {
  const executor = client ?? pool;
  const trimmedLimit = Number.isFinite(limit) && limit > 0 ? Math.trunc(limit) : 0;
  const query =
    trimmedLimit > 0
      ? `${MOVIMENTACOES_BASE_QUERY}\n  LIMIT $2`
      : MOVIMENTACOES_BASE_QUERY;
  const params = trimmedLimit > 0 ? [processoId, trimmedLimit] : [processoId];
  const result = await executor.query(query, params);
  return parseMovimentacoes(result.rows);
};

const safeJsonStringify = (value: unknown): string | null => {
  if (value === null || value === undefined) {
    return null;
  }

  try {
    return JSON.stringify(value);
  } catch (error) {
    console.error('Erro ao serializar JSON de movimentação', error);
    return null;
  }
};

type PreparedMovimentacaoRecord = {
  id: string;
  data: string | null;
  tipo: string | null;
  tipo_publicacao: string | null;
  classificacao_predita: string | null;
  conteudo: string | null;
  texto_categoria: string | null;
  fonte: string | null;
};

const prepareMovimentacaoRecord = (
  item: unknown
): PreparedMovimentacaoRecord | null => {
  if (!item || typeof item !== 'object') {
    return null;
  }

  const raw = item as Record<string, unknown>;
  const idCandidate = raw.id;
  let id: string | null = null;

  if (typeof idCandidate === 'number' && Number.isFinite(idCandidate)) {
    id = String(Math.trunc(idCandidate));
  } else if (typeof idCandidate === 'string') {
    const trimmed = idCandidate.trim();
    if (trimmed) {
      id = trimmed;
    }
  }

  if (!id) {
    return null;
  }

  const dataValue = normalizeDate(raw.data) ?? normalizeString(raw.data);

  return {
    id,
    data: dataValue,
    tipo: normalizeString(raw.tipo),
    tipo_publicacao: normalizeString(raw.tipo_publicacao),
    classificacao_predita: safeJsonStringify(raw.classificacao_predita),
    conteudo: normalizeString(raw.conteudo),
    texto_categoria: normalizeString(raw.texto_categoria),
    fonte: safeJsonStringify(raw.fonte),
  };
};

const baseProcessoSelect = `
  SELECT DISTINCT
    p.id,
    p.cliente_id,
    p.idempresa,
    p.numero,
    p.uf,
    p.municipio,
    COALESCE(dp.orgao_julgador, p.orgao_julgador) AS orgao_julgador,
    COALESCE(dp.area,p.tipo) as tipo,
    COALESCE(dp.situacao,p.status) as status,
    COALESCE(dp.classificacao_principal_nome, p.classe_judicial) as classe_judicial,
    dp.assunto,
    p.jurisdicao,
    p.oportunidade_id,
    o.sequencial_empresa AS oportunidade_sequencial_empresa,
    o.data_criacao AS oportunidade_data_criacao,
    o.numero_processo_cnj AS oportunidade_numero_processo_cnj,
    o.numero_protocolo AS oportunidade_numero_protocolo,
    o.solicitante_id AS oportunidade_solicitante_id,
    solicitante.nome AS oportunidade_solicitante_nome,
    p.advogado_responsavel,
    COALESCE(dp.data_distribuicao, mp.atualizado_em, p.data_distribuicao) AS data_distribuicao,
    p.criado_em,
    mp.data_andamento as atualizado_em,
    COALESCE(dp.data_distribuicao, mp.atualizado_em) AS ultima_movimentacao,
    p.consultas_api_count,
    c.nome AS cliente_nome,
    c.documento AS cliente_documento,
    c.tipo AS cliente_tipo,
    (
      SELECT COALESCE(
        jsonb_agg(
          jsonb_build_object(
            'id', pa.usuario_id,
            'nome', u.nome_completo
          ) ORDER BY u.nome_completo
        ) FILTER (WHERE pa.usuario_id IS NOT NULL),
        '[]'::jsonb
      )
      FROM public.processo_advogados pa
      LEFT JOIN public.usuarios u ON u.id = pa.usuario_id
      WHERE pa.processo_id = p.id
    ) AS advogados,
    (
      SELECT COUNT(*)::int
      FROM public.trigger_movimentacao_processo tmp
      WHERE tmp.numero_cnj = p.numero
    ) AS movimentacoes_count
FROM public.processos p
LEFT JOIN public.trigger_dados_processo dp ON dp.numero_cnj = p.numero
LEFT JOIN public.trigger_movimentacao_processo mp ON mp.numero_cnj = p.numero and mp.id_andamento = dp.id_ultimo_andamento
LEFT JOIN public.oportunidades o ON o.id = p.oportunidade_id
LEFT JOIN public.clientes c ON c.id = p.cliente_id
LEFT JOIN public.clientes solicitante ON solicitante.id = o.solicitante_id
`;

const mapProcessoRow = (row: any): Processo => {
  const oportunidadeId = parseOptionalInteger(row.oportunidade_id);
  const sequencial = parseOptionalInteger(row.oportunidade_sequencial_empresa);
  const solicitanteId = parseOptionalInteger(row.oportunidade_solicitante_id);
  const solicitanteNome = normalizeString(row.oportunidade_solicitante_nome);

  const oportunidade =
    oportunidadeId && oportunidadeId > 0
      ? {
          id: oportunidadeId,
          sequencial_empresa: sequencial ?? null,
          data_criacao: row.oportunidade_data_criacao ?? null,
          numero_processo_cnj: row.oportunidade_numero_processo_cnj ?? null,
          numero_protocolo: row.oportunidade_numero_protocolo ?? null,
          solicitante_id: solicitanteId ?? null,
          solicitante_nome: solicitanteNome,
        }
      : null;

  return {
    id: row.id,
    cliente_id: row.cliente_id,
    idempresa: row.idempresa ?? null,
    numero: row.numero,
    uf: row.uf,
    municipio: row.municipio,
    orgao_julgador: row.orgao_julgador,
    tipo: row.tipo,
    status: row.status,
    classe_judicial: row.classe_judicial,
    assunto: row.assunto,
    jurisdicao: row.jurisdicao,
    oportunidade_id: oportunidade?.id ?? null,
    advogado_responsavel: row.advogado_responsavel,
    data_distribuicao: row.data_distribuicao,
    criado_em: row.criado_em,
    atualizado_em: row.atualizado_em,
    ultima_movimentacao: normalizeTimestamp(row.ultima_movimentacao),
    ultima_sincronizacao: normalizeTimestamp(row.ultima_sincronizacao),
    consultas_api_count: parseInteger(row.consultas_api_count),
    movimentacoes_count: parseInteger(row.movimentacoes_count),
    cliente: row.cliente_id
      ? {
          id: row.cliente_id,
          nome: row.cliente_nome ?? null,
          documento: row.cliente_documento ?? null,
          tipo:
            row.cliente_tipo === null || row.cliente_tipo === undefined
              ? null
              : String(row.cliente_tipo),
        }
      : null,
    oportunidade,
    advogados: parseAdvogados(row.advogados),
    movimentacoes: parseMovimentacoes(row.movimentacoes),
  };
};

export const listProcessos = async (req: Request, res: Response) => {
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
      `${baseProcessoSelect}
       WHERE p.idempresa = $1
       ORDER BY p.criado_em DESC`,
      [empresaId]
    );

    return res.json(result.rows.map(mapProcessoRow));
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const listProcessosByCliente = async (req: Request, res: Response) => {
  const { clienteId } = req.params;
  const parsedClienteId = Number(clienteId);

  if (!Number.isInteger(parsedClienteId) || parsedClienteId <= 0) {
    return res.status(400).json({ error: 'clienteId inválido' });
  }

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
      `${baseProcessoSelect}
       WHERE p.cliente_id = $1
         AND p.idempresa = $2
       ORDER BY p.criado_em DESC`,
      [parsedClienteId, empresaId]
    );

    res.json(result.rows.map(mapProcessoRow));
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const getProcessoById = async (req: Request, res: Response) => {
  const { id } = req.params;
  const parsedId = Number(id);

  if (!Number.isInteger(parsedId) || parsedId <= 0) {
    return res.status(400).json({ error: 'ID inválido' });
  }

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
      return res.status(404).json({ error: 'Processo não encontrado' });
    }

    const result = await pool.query(
      `${baseProcessoSelect}
       WHERE p.id = $1
         AND p.idempresa = $2
       LIMIT 1`,
      [parsedId, empresaId]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({ error: 'Processo não encontrado' });
    }

    const processo = mapProcessoRow(result.rows[0]);

    const movimentacoes = await fetchProcessoMovimentacoes(parsedId);

    processo.movimentacoes = movimentacoes;

    res.json(processo);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

const parseJsonField = (value: string | null): unknown => {
  if (!value) {
    return null;
  }

  try {
    return JSON.parse(value);
  } catch {
    return value;
  }
};

export const createProcessoMovimentacaoManual = async (
  req: Request,
  res: Response,
) => {
  const { id } = req.params;
  const parsedId = Number(id);

  if (!Number.isInteger(parsedId) || parsedId <= 0) {
    return res.status(400).json({ error: 'ID inválido' });
  }

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
      return res.status(404).json({ error: 'Processo não encontrado' });
    }

    const processoExists = await pool.query(
      'SELECT 1 FROM public.processos WHERE id = $1 AND idempresa IS NOT DISTINCT FROM $2',
      [parsedId, empresaId],
    );

    if (processoExists.rowCount === 0) {
      return res.status(404).json({ error: 'Processo não encontrado' });
    }

    const preparedRecord = prepareMovimentacaoRecord({
      id: 0,
      data: req.body?.data ?? null,
      tipo: req.body?.tipo ?? null,
      tipo_publicacao: req.body?.tipo_publicacao ?? null,
      classificacao_predita: req.body?.classificacao_predita ?? null,
      conteudo: req.body?.conteudo ?? null,
      texto_categoria: req.body?.texto_categoria ?? null,
      fonte: req.body?.fonte ?? null,
    });

    if (!preparedRecord) {
      return res.status(400).json({ error: 'Dados da movimentação inválidos' });
    }

    const insertResult = await pool.query(
      `INSERT INTO public.processo_movimentacoes (
         id,
         processo_id,
         data,
         tipo,
         tipo_publicacao,
         classificacao_predita,
         conteudo,
         texto_categoria,
         fonte
       )
       VALUES (DEFAULT, $1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING id, processo_id, data, tipo, tipo_publicacao, classificacao_predita, conteudo, texto_categoria, fonte, criado_em, atualizado_em`,
      [
        parsedId,
        preparedRecord.data,
        preparedRecord.tipo,
        preparedRecord.tipo_publicacao,
        parseJsonField(preparedRecord.classificacao_predita),
        preparedRecord.conteudo,
        preparedRecord.texto_categoria,
        parseJsonField(preparedRecord.fonte),
      ],
    );

    const insertedRow = insertResult.rows[0];

    if (!insertedRow) {
      throw new Error('Falha ao criar movimentação');
    }

    const movimentacoes = parseMovimentacoes([insertedRow]) ?? [];

    if (movimentacoes.length === 0) {
      throw new Error('Falha ao processar movimentação criada');
    }

    return res.status(201).json(movimentacoes[0]);
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: 'Internal server error' });
  }
};

export const createProcesso = async (req: Request, res: Response) => {
  const {
    cliente_id,
    numero,
    uf,
    municipio,
    orgao_julgador,
    tipo,
    status,
    classe_judicial,
    assunto,
    jurisdicao,
    advogado_responsavel,
    data_distribuicao,
    advogados,
  } = req.body;

  const parsedClienteId = Number(cliente_id);

  if (!Number.isInteger(parsedClienteId) || parsedClienteId <= 0) {
    return res.status(400).json({ error: 'cliente_id inválido' });
  }

  const numeroValue = normalizeString(numero);
  const ufValue = normalizeUppercase(uf);
  const municipioValue = normalizeString(municipio);
  const orgaoValue = normalizeString(orgao_julgador);

  if (!numeroValue || !ufValue || !municipioValue) {
    return res.status(400).json({
      error: 'Os campos cliente_id, numero, uf e municipio são obrigatórios',
    });
  }

  const tipoValue = normalizeString(tipo);
  const statusValue = normalizeString(status);
  const classeValue = normalizeString(classe_judicial);
  const assuntoValue = normalizeString(assunto);
  const jurisdicaoValue = normalizeString(jurisdicao);
  const advogadoValue = normalizeString(advogado_responsavel);
  const dataDistribuicaoValue = normalizeDate(data_distribuicao);
  const oportunidadeResolution = resolveNullablePositiveInteger(
    req.body?.oportunidade_id ?? req.body?.proposta_id ?? null,
  );

  if (!oportunidadeResolution.ok) {
    return res.status(400).json({ error: 'oportunidade_id inválido' });
  }

  const oportunidadeIdValue = oportunidadeResolution.value;
  const rawAdvogados = Array.isArray(advogados) ? advogados : [];
  const advogadoIds = Array.from(
    new Set(
      rawAdvogados
        .map((value: unknown) => {
          if (typeof value === 'number' && Number.isInteger(value) && value > 0) {
            return value;
          }

          if (typeof value === 'string') {
            const trimmed = value.trim();
            if (!trimmed) {
              return null;
            }

            const parsed = Number.parseInt(trimmed, 10);
            if (Number.isFinite(parsed) && parsed > 0) {
              return parsed;
            }
          }

          return null;
        })
        .filter((value): value is number => value !== null && Number.isInteger(value) && value > 0)
    )
  );

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

    const planLimits = await fetchPlanLimitsForCompany(empresaId);
    if (planLimits?.limiteProcessos != null) {
      const processosCount = await countCompanyResource(
        empresaId,
        'processos',
      );
      if (processosCount >= planLimits.limiteProcessos) {
        return res
          .status(403)
          .json({ error: 'Limite de processos do plano atingido.' });
      }
    }

    const clienteExists = await pool.query(
      'SELECT 1 FROM public.clientes WHERE id = $1 AND idempresa IS NOT DISTINCT FROM $2',
      [parsedClienteId, empresaId]
    );

    if (clienteExists.rowCount === 0) {
      return res.status(400).json({ error: 'Cliente não encontrado' });
    }

    const oportunidadeResolution = resolveNullablePositiveInteger(
      req.body?.oportunidade_id ?? req.body?.proposta_id ?? null,
    );

    if (!oportunidadeResolution.ok) {
      return res.status(400).json({ error: 'oportunidade_id inválido' });
    }

    const oportunidadeIdValue = oportunidadeResolution.value;

    if (oportunidadeIdValue !== null) {
      const oportunidadeExists = await pool.query(
        'SELECT 1 FROM public.oportunidades WHERE id = $1 AND idempresa IS NOT DISTINCT FROM $2',
        [oportunidadeIdValue, empresaId],
      );

      if (oportunidadeExists.rowCount === 0) {
        return res.status(400).json({ error: 'Proposta não encontrada' });
      }
    }

    let advogadosSelecionados: Array<{ id: number; nome: string | null }> = [];

    if (advogadoIds.length > 0) {
      const advResult = await pool.query(
        `SELECT id, COALESCE(nome_completo, email, '') AS nome
         FROM public.usuarios
         WHERE id = ANY($1::int[])
           AND empresa IS NOT DISTINCT FROM $2`,
        [advogadoIds, empresaId]
      );

      const advogadosMap = new Map<number, string | null>();
      for (const row of advResult.rows) {
        const idValue = Number((row as { id: unknown }).id);
        if (Number.isInteger(idValue)) {
          const nomeValue = (row as { nome?: unknown }).nome;
          advogadosMap.set(
            idValue,
            typeof nomeValue === 'string' ? nomeValue : null
          );
        }
      }

      const missingAdvogados = advogadoIds.filter((id) => !advogadosMap.has(id));

      if (missingAdvogados.length > 0) {
        return res.status(400).json({
          error:
            'Um ou mais advogados informados não pertencem à empresa autenticada.',
        });
      }

      advogadosSelecionados = advogadoIds.map((id) => ({
        id,
        nome: advogadosMap.get(id) ?? null,
      }));
    }

    const advogadoConcatValue = advogadosSelecionados
      .map((item) => (item.nome ? item.nome.trim() : ''))
      .filter((nome) => nome !== '')
      .join(', ');

    const advogadoColumnValue = advogadoConcatValue || advogadoValue;

    const clientDb = await pool.connect();

    try {
      await clientDb.query('BEGIN');

      const insertResult = await clientDb.query(
        `INSERT INTO public.processos (
            cliente_id,
            numero,
            uf,
            municipio,
            orgao_julgador,
            tipo,
            status,
            classe_judicial,
            assunto,
            jurisdicao,
            oportunidade_id,
            advogado_responsavel,
            data_distribuicao,
            idempresa
          )
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
          RETURNING id`,
        [
          parsedClienteId,
          numeroValue,
          ufValue,
          municipioValue,
          orgaoValue,
          tipoValue,
          statusValue,
          classeValue,
          assuntoValue,
          jurisdicaoValue,
          oportunidadeIdValue,
          advogadoColumnValue,
          dataDistribuicaoValue,
          empresaId,
        ]
      );

      const processoIdRow = insertResult.rows[0] as { id: number } | undefined;

      if (!processoIdRow || !processoIdRow.id) {
        throw new Error('Falha ao cadastrar o processo.');
      }

      const processoId = processoIdRow.id;

      if (advogadosSelecionados.length > 0) {
        const values: unknown[] = [];
        const placeholders = advogadosSelecionados
          .map((adv, index) => {
            values.push(processoId, adv.id);
            const baseIndex = index * 2;
            return `($${baseIndex + 1}, $${baseIndex + 2})`;
          })
          .join(', ');

        await clientDb.query(
          `INSERT INTO public.processo_advogados (processo_id, usuario_id)
           VALUES ${placeholders}
           ON CONFLICT (processo_id, usuario_id) DO UPDATE
             SET atualizado_em = NOW()`,
          values
        );
      }

      const finalResult = await clientDb.query(
        `${baseProcessoSelect}
         WHERE p.id = $1
         LIMIT 1`,
        [processoId]
      );

      await clientDb.query('COMMIT');


      if (finalResult.rowCount === 0) {
        throw new Error('Não foi possível localizar o processo recém-criado.');
      }

      const processo = mapProcessoRow(finalResult.rows[0]);

      const recipientIds = new Set<string>();
      recipientIds.add(String(req.auth.userId));
      for (const advogado of advogadosSelecionados) {
        recipientIds.add(String(advogado.id));
      }

      await Promise.all(
        Array.from(recipientIds).map(async (userId) => {
          try {
            await createNotification({
              userId,
              title: `Novo processo cadastrado: ${processo.numero}`,
              message: processo.data_distribuicao
                ? `Processo ${processo.numero} distribuído em ${processo.data_distribuicao}.`
                : `Processo ${processo.numero} foi cadastrado.`,
              category: 'process',
              type: 'info',
              metadata: {
                processId: processo.id,
                clientId: processo.cliente_id,
                status: processo.status,
                opportunityId: processo.oportunidade_id,
                jurisdiction: processo.jurisdicao,
                lawyers: advogadosSelecionados.map((adv) => adv.id),
              },
            });
          } catch (notifyError) {
            console.error('Falha ao enviar notificação de criação de processo', notifyError);
          }
        }),
      );

      res.status(201).json(processo);
    } catch (transactionError) {
      await clientDb.query('ROLLBACK');
      throw transactionError;
    } finally {
      clientDb.release();
    }
  } catch (error: any) {
    console.error(error);

    if (error?.code === '23505') {
      return res.status(409).json({ error: 'Número de processo já cadastrado' });
    }

    res.status(500).json({ error: 'Internal server error' });
  }
};

export const updateProcesso = async (req: Request, res: Response) => {
  const { id } = req.params;
  const parsedId = Number(id);

  if (!Number.isInteger(parsedId) || parsedId <= 0) {
    return res.status(400).json({ error: 'ID inválido' });
  }

  const {
    cliente_id,
    numero,
    uf,
    municipio,
    orgao_julgador,
    tipo,
    status,
    classe_judicial,
    assunto,
    jurisdicao,
    advogado_responsavel,
    data_distribuicao,
    advogados,
  } = req.body;

  const parsedClienteId = Number(cliente_id);

  if (!Number.isInteger(parsedClienteId) || parsedClienteId <= 0) {
    return res.status(400).json({ error: 'cliente_id inválido' });
  }

  const numeroValue = normalizeString(numero);
  const ufValue = normalizeUppercase(uf);
  const municipioValue = normalizeString(municipio);
  const orgaoValue = normalizeString(orgao_julgador);

  if (!numeroValue || !ufValue || !municipioValue) {
    return res.status(400).json({
      error: 'Os campos cliente_id, numero, uf e municipio são obrigatórios',
    });
  }

  const tipoValue = normalizeString(tipo);
  const statusValue = normalizeString(status);
  const classeValue = normalizeString(classe_judicial);
  const assuntoValue = normalizeString(assunto);
  const jurisdicaoValue = normalizeString(jurisdicao);
  const advogadoValue = normalizeString(advogado_responsavel);
  const dataDistribuicaoValue = normalizeDate(data_distribuicao);
  const oportunidadeResolution = resolveNullablePositiveInteger(
    req.body?.oportunidade_id ?? req.body?.proposta_id ?? null,
  );

  if (!oportunidadeResolution.ok) {
    return res.status(400).json({ error: 'oportunidade_id inválido' });
  }

  const oportunidadeIdValue = oportunidadeResolution.value;
  const rawAdvogados = Array.isArray(advogados) ? advogados : [];
  const advogadoIds = Array.from(
    new Set(
      rawAdvogados
        .map((value: unknown) => {
          if (typeof value === 'number' && Number.isInteger(value) && value > 0) {
            return value;
          }

          if (typeof value === 'string') {
            const trimmed = value.trim();
            if (!trimmed) {
              return null;
            }

            const parsed = Number.parseInt(trimmed, 10);
            if (Number.isFinite(parsed) && parsed > 0) {
              return parsed;
            }
          }

          return null;
        })
        .filter((value): value is number => value !== null && Number.isInteger(value) && value > 0)
    )
  );

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

    if (oportunidadeIdValue !== null) {
      const oportunidadeExists = await pool.query(
        'SELECT 1 FROM public.oportunidades WHERE id = $1 AND idempresa IS NOT DISTINCT FROM $2',
        [oportunidadeIdValue, empresaId],
      );

      if (oportunidadeExists.rowCount === 0) {
        return res.status(400).json({ error: 'Proposta não encontrada' });
      }
    }

    const existingProcess = await pool.query(
      'SELECT id FROM public.processos WHERE id = $1 AND idempresa IS NOT DISTINCT FROM $2',
      [parsedId, empresaId]
    );

    if (existingProcess.rowCount === 0) {
      return res.status(404).json({ error: 'Processo não encontrado' });
    }

    const clienteExists = await pool.query(
      'SELECT 1 FROM public.clientes WHERE id = $1 AND idempresa IS NOT DISTINCT FROM $2',
      [parsedClienteId, empresaId]
    );

    if (clienteExists.rowCount === 0) {
      return res.status(400).json({ error: 'Cliente não encontrado' });
    }

    let advogadosSelecionados: Array<{ id: number; nome: string | null }> = [];

    if (advogadoIds.length > 0) {
      const advResult = await pool.query(
        `SELECT id, COALESCE(nome_completo, email, '') AS nome
         FROM public.usuarios
         WHERE id = ANY($1::int[])
           AND empresa IS NOT DISTINCT FROM $2`,
        [advogadoIds, empresaId]
      );

      const advogadosMap = new Map<number, string | null>();
      for (const row of advResult.rows) {
        const idValue = Number((row as { id: unknown }).id);
        if (Number.isInteger(idValue)) {
          const nomeValue = (row as { nome?: unknown }).nome;
          advogadosMap.set(
            idValue,
            typeof nomeValue === 'string' ? nomeValue : null
          );
        }
      }

      const missingAdvogados = advogadoIds.filter((id) => !advogadosMap.has(id));

      if (missingAdvogados.length > 0) {
        return res.status(400).json({
          error:
            'Um ou mais advogados informados não pertencem à empresa autenticada.',
        });
      }

      advogadosSelecionados = advogadoIds.map((id) => ({
        id,
        nome: advogadosMap.get(id) ?? null,
      }));
    }

    const advogadoConcatValue = advogadosSelecionados
      .map((item) => (item.nome ? item.nome.trim() : ''))
      .filter((nome) => nome !== '')
      .join(', ');

    const advogadoColumnValue = advogadoConcatValue || advogadoValue;

    const clientDb = await pool.connect();

    try {
      await clientDb.query('BEGIN');

      const updateResult = await clientDb.query(
        `UPDATE public.processos
            SET cliente_id = $1,
                numero = $2,
                uf = $3,
                municipio = $4,
                orgao_julgador = $5,
                tipo = $6,
                status = $7,
                classe_judicial = $8,
                assunto = $9,
                jurisdicao = $10,
                oportunidade_id = $11,
                advogado_responsavel = $12,
                data_distribuicao = $13,
                atualizado_em = NOW()
          WHERE id = $14
            AND idempresa IS NOT DISTINCT FROM $15
          RETURNING id`,
        [
          parsedClienteId,
          numeroValue,
          ufValue,
          municipioValue,
          orgaoValue,
          tipoValue,
          statusValue,
          classeValue,
          assuntoValue,
          jurisdicaoValue,
          oportunidadeIdValue,
          advogadoColumnValue,
          dataDistribuicaoValue,
          parsedId,
          empresaId,
        ]
      );

      if (updateResult.rowCount === 0) {
        await clientDb.query('ROLLBACK');
        return res.status(404).json({ error: 'Processo não encontrado' });
      }

      await clientDb.query('DELETE FROM public.processo_advogados WHERE processo_id = $1', [
        parsedId,
      ]);

      if (advogadosSelecionados.length > 0) {
        const values: unknown[] = [];
        const placeholders = advogadosSelecionados
          .map((adv, index) => {
            values.push(parsedId, adv.id);
            const baseIndex = index * 2;
            return `($${baseIndex + 1}, $${baseIndex + 2})`;
          })
          .join(', ');

        await clientDb.query(
          `INSERT INTO public.processo_advogados (processo_id, usuario_id)
           VALUES ${placeholders}
           ON CONFLICT (processo_id, usuario_id) DO UPDATE
             SET atualizado_em = NOW()`,
          values
        );
      }

      const finalResult = await clientDb.query(
        `${baseProcessoSelect}
         WHERE p.id = $1
         LIMIT 1`,
        [parsedId]
      );

      await clientDb.query('COMMIT');

      if (finalResult.rowCount === 0) {
        return res.status(404).json({ error: 'Processo não encontrado' });
      }

      const processo = mapProcessoRow(finalResult.rows[0]);

      const recipientIds = new Set<string>();
      if (req.auth?.userId) {
        recipientIds.add(String(req.auth.userId));
      }
      for (const advogado of advogadosSelecionados) {
        recipientIds.add(String(advogado.id));
      }

      await Promise.all(
        Array.from(recipientIds).map(async (userId) => {
          try {
            await createNotification({
              userId,
              title: `Processo atualizado: ${processo.numero}`,
              message: processo.data_distribuicao
                ? `Atualizações no processo ${processo.numero} distribuído em ${processo.data_distribuicao}.`
                : `O processo ${processo.numero} foi atualizado.`,
              category: 'process',
              type: 'info',
              metadata: {
                processId: processo.id,
                clientId: processo.cliente_id,
                status: processo.status,
                opportunityId: processo.oportunidade_id,
                jurisdiction: processo.jurisdicao,
                lawyers: advogadosSelecionados.map((adv) => adv.id),
              },
            });
          } catch (notifyError) {
            console.error('Falha ao enviar notificação de atualização de processo', notifyError);
          }
        }),
      );

      res.json(processo);
    } catch (transactionError) {
      await clientDb.query('ROLLBACK');
      throw transactionError;
    } finally {
      clientDb.release();
    }
  } catch (error: any) {
    console.error(error);

    if (error?.code === '23505') {
      return res.status(409).json({ error: 'Número de processo já cadastrado' });
    }

    res.status(500).json({ error: 'Internal server error' });
  }
};

export const deleteProcesso = async (req: Request, res: Response) => {
  const { id } = req.params;
  const parsedId = Number(id);

  if (!Number.isInteger(parsedId) || parsedId <= 0) {
    return res.status(400).json({ error: 'ID inválido' });
  }

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

    const existingProcess = await pool.query(
      'SELECT 1 FROM public.processos WHERE id = $1 AND idempresa IS NOT DISTINCT FROM $2',
      [parsedId, empresaId]
    );

    if (existingProcess.rowCount === 0) {
      return res.status(404).json({ error: 'Processo não encontrado' });
    }

    const result = await pool.query(
      'DELETE FROM public.processos WHERE id = $1 AND idempresa IS NOT DISTINCT FROM $2',
      [parsedId, empresaId]
    );

    if (result.rowCount === 0) {
      const processStillExists = await pool.query(
        'SELECT 1 FROM public.processos WHERE id = $1 AND idempresa IS NOT DISTINCT FROM $2',
        [parsedId, empresaId]
      );

      if (processStillExists.rowCount === 0) {
        return res.status(404).json({ error: 'Processo não encontrado' });
      }
    }

    res.status(204).send();
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Internal server error' });
  }
};
