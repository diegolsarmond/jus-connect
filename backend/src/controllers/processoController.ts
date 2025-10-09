import { randomUUID } from 'crypto';
import { Request, Response } from 'express';
import { PoolClient } from 'pg';
import {
  fetchPlanLimitsForCompany,
  countCompanyResource,
} from '../services/planLimitsService';

import pool from '../services/db';
import { createNotification } from '../services/notificationService';
import { Processo, ProcessoAttachment, ProcessoParticipant } from '../models/processo';
import { fetchAuthenticatedUserEmpresa } from '../utils/authUser';
import { evaluateProcessSyncAvailability } from '../services/processSyncQuotaService';
import executeJuditProcessSync from '../services/juditSyncService';

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

const stripDiacritics = (value: string): string =>
  value.normalize('NFD').replace(/\p{M}/gu, '');

const normalizeParticipantSide = (
  value: unknown,
): 'ativo' | 'passivo' | null => {
  const normalized = normalizeString(value);

  if (!normalized) {
    return null;
  }

  const sanitized = stripDiacritics(normalized)
    .toLowerCase()
    .replace(/[^a-z\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  if (
    [
      'ativo',
      'ativa',
      'autor',
      'autora',
      'reclamante',
      'exequente',
      'agravante',
      'apelante',
      'impetrante',
      'embargante',
      'requerente',
      'demandante',
      'parte ativa',
      'polo ativo',
    ].some((token) => sanitized === token || sanitized.includes(token))
  ) {
    return 'ativo';
  }

  if (
    [
      'passivo',
      'passiva',
      'reu',
      'reus',
      're',
      'reclamado',
      'executado',
      'agravado',
      'apelado',
      'impetrado',
      'embargado',
      'requerido',
      'demandado',
      'parte passiva',
      'polo passivo',
    ].some((token) => sanitized === token || sanitized.includes(token))
  ) {
    return 'passivo';
  }

  return null;
};

const normalizeParticipantDocument = (
  value: unknown,
): { display: string | null; key: string | null } => {
  const normalized = normalizeString(value);

  if (!normalized) {
    return { display: null, key: null };
  }

  const digitsOnly = normalized.replace(/\D+/g, '');
  const key = digitsOnly || stripDiacritics(normalized).toLowerCase();

  return { display: normalized, key };
};

const resolveDocumentKey = (document: string | null): string | null => {
  if (!document) {
    return null;
  }

  const digits = document.replace(/\D+/g, '');

  if (digits.length >= 5) {
    return digits;
  }

  return stripDiacritics(document).toLowerCase();
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
  id_andamento?: number | string | null;
  numero_cnj?: string | null;
  instancia_processo?: string | null;
  tipo?: string | null;
  tipo_andamento?: string | null;
  tipo_publicacao?: string | null;
  classificacao_predita?: Record<string, unknown> | null;
  conteudo?: string | null;
  texto_categoria?: string | null;
  fonte?: Record<string, unknown> | null;
  sigiloso?: boolean | number | string | null;
  crawl_id?: string | null;
  data?: string | null;
  data_andamento?: string | null;
  criado_em?: string | null;
  atualizado_em?: string | null;
  data_cadastro?: string | null;
};

const parseMovimentacoes = (value: unknown): Processo['movimentacoes'] => {
  const movimentacoes: Processo['movimentacoes'] = [];

  const processItem = (item: unknown) => {
    if (!item || typeof item !== 'object') {
      return;
    }

    const raw = item as RawMovimentacao;
    const idCandidate = raw.id_andamento ?? raw.id ?? null;
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

    const dataValue =
      normalizeTimestamp(raw.data_andamento ?? raw.data) ?? raw.data ?? null;

    const tipoValue = raw.tipo_andamento ?? raw.tipo ?? null;
    const numeroCnjValue = normalizeString(raw.numero_cnj);
    const instanciaProcessoValue = normalizeString(raw.instancia_processo);
    const sigilosoValue = parseBooleanFlag(raw.sigiloso);
    const crawlIdValueRaw =
      raw.crawl_id === null || raw.crawl_id === undefined
        ? null
        : typeof raw.crawl_id === 'string'
          ? normalizeString(raw.crawl_id)
          : String(raw.crawl_id);
    const crawlIdValue =
      typeof crawlIdValueRaw === 'string'
        ? crawlIdValueRaw.trim() || null
        : crawlIdValueRaw;
    const dataCadastroValue =
      normalizeTimestamp(raw.data_cadastro) ?? raw.data_cadastro ?? null;

    movimentacoes.push({
      id: parsedId,
      data: dataValue,
      tipo: tipoValue,
      tipo_andamento: raw.tipo_andamento ?? null,
      tipo_publicacao: raw.tipo_publicacao ?? null,
      classificacao_predita: raw.classificacao_predita ?? null,
      conteudo: raw.conteudo ?? null,
      texto_categoria: raw.texto_categoria ?? null,
      fonte: raw.fonte ?? null,
      criado_em: normalizeTimestamp(raw.criado_em) ?? raw.criado_em ?? null,
      atualizado_em:
        normalizeTimestamp(raw.atualizado_em) ?? raw.atualizado_em ?? null,
      numero_cnj: numeroCnjValue,
      instancia_processo: instanciaProcessoValue,
      sigiloso: sigilosoValue ?? null,
      crawl_id: crawlIdValue,
      data_cadastro: dataCadastroValue,
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

type RawAttachment = {
  id?: unknown;
  id_andamento?: unknown;
  id_anexo?: unknown;
  nome?: unknown;
  tipo?: unknown;
  data_cadastro?: unknown;
  data_andamento?: unknown;
  instancia_processo?: unknown;
  crawl_id?: unknown;
  movimentacao_criado_em?: unknown;
  movimentacao_data_andamento?: unknown;
};

const parseAttachments = (value: unknown): Processo['attachments'] => {
  const attachments: ProcessoAttachment[] = [];

  const normalizeIdentifier = (raw: unknown): string | null => {
    if (raw === null || raw === undefined) {
      return null;
    }

    if (typeof raw === 'number' && Number.isFinite(raw)) {
      return String(Math.trunc(raw));
    }

    if (typeof raw === 'string') {
      const trimmed = raw.trim();
      return trimmed ? trimmed : null;
    }

    return null;
  };

  const processItem = (item: unknown) => {
    if (!item || typeof item !== 'object') {
      return;
    }

    const raw = item as RawAttachment;
    const idValue = normalizeIdentifier(raw.id ?? raw.id_anexo);

    if (!idValue) {
      return;
    }

    const attachment: ProcessoAttachment = {
      id: idValue,
      id_andamento: normalizeIdentifier(raw.id_andamento),
      id_anexo: normalizeIdentifier(raw.id_anexo ?? raw.id),
      nome: normalizeString(raw.nome),
      tipo: normalizeString(raw.tipo),
      data_cadastro:
        normalizeTimestamp(raw.movimentacao_criado_em) ??
        normalizeTimestamp(raw.data_cadastro) ??
        normalizeDate(raw.data_cadastro) ??
        null,
      data_andamento:
        normalizeTimestamp(raw.movimentacao_data_andamento) ??
        normalizeTimestamp(raw.data_andamento) ??
        normalizeDate(raw.movimentacao_data_andamento) ??
        normalizeDate(raw.data_andamento) ??
        null,
      instancia_processo:
        normalizeString(raw.instancia_processo) ??
        (typeof raw.instancia_processo === 'number' && Number.isFinite(raw.instancia_processo)
          ? String(Math.trunc(raw.instancia_processo))
          : null),
      crawl_id: normalizeString(raw.crawl_id),
    };

    attachments.push(attachment);
  };

  if (Array.isArray(value)) {
    value.forEach(processItem);
    return attachments;
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
      return attachments;
    }

    return attachments;
  }

  if (value && typeof value === 'object' && 'rows' in (value as Record<string, unknown>)) {
    const possibleArray = (value as { rows?: unknown[] }).rows;
    if (Array.isArray(possibleArray)) {
      possibleArray.forEach(processItem);
    }
  }

  return attachments;
};

const mergeMovimentacoesWithAttachments = (
  movimentacoes: Processo['movimentacoes'],
  attachments: Processo['attachments'],
): Processo['movimentacoes'] => {
  if (!Array.isArray(movimentacoes) || movimentacoes.length === 0) {
    return Array.isArray(movimentacoes) ? movimentacoes : [];
  }

  if (!Array.isArray(attachments) || attachments.length === 0) {
    return movimentacoes;
  }

  const movimentacoesComAnexos = movimentacoes.map((movimentacao) => ({
    ...movimentacao,
    attachments: Array.isArray(movimentacao.attachments)
      ? movimentacao.attachments.slice()
      : [],
  }));

  const movimentacoesPorId = new Map<string, (typeof movimentacoesComAnexos)[number]>();
  const movimentacoesPorTimestamp = new Map<
    string,
    Array<(typeof movimentacoesComAnexos)[number]>
  >();
  const movimentacoesPorDia = new Map<string, Array<(typeof movimentacoesComAnexos)[number]>>();

  movimentacoesComAnexos.forEach((movimentacao) => {
    movimentacoesPorId.set(movimentacao.id, movimentacao);

    const timestamp = normalizeTimestamp(movimentacao.data);

    if (timestamp) {
      const existentesMesmoTimestamp = movimentacoesPorTimestamp.get(timestamp);
      if (existentesMesmoTimestamp) {
        existentesMesmoTimestamp.push(movimentacao);
      } else {
        movimentacoesPorTimestamp.set(timestamp, [movimentacao]);
      }

      const diaChave = timestamp.slice(0, 10);
      if (diaChave) {
        const existentesMesmoDia = movimentacoesPorDia.get(diaChave);
        if (existentesMesmoDia) {
          existentesMesmoDia.push(movimentacao);
        } else {
          movimentacoesPorDia.set(diaChave, [movimentacao]);
        }
      }
    }
  });

  const anexar = (
    destino: (typeof movimentacoesComAnexos)[number] | undefined,
    anexo: ProcessoAttachment,
  ): boolean => {
    if (!destino) {
      return false;
    }

    if (!Array.isArray(destino.attachments)) {
      destino.attachments = [];
    }

    destino.attachments.push(anexo);
    return true;
  };

  attachments.forEach((anexo) => {
    const identificador = anexo.id_andamento;

    if (identificador && movimentacoesPorId.has(identificador)) {
      anexar(movimentacoesPorId.get(identificador), anexo);
      return;
    }

    const timestampAnexo =
      normalizeTimestamp(anexo.data_andamento) ?? normalizeTimestamp(anexo.data_cadastro);

    if (!timestampAnexo) {
      return;
    }

    const candidatosMesmoTimestamp = movimentacoesPorTimestamp.get(timestampAnexo);
    if (candidatosMesmoTimestamp && candidatosMesmoTimestamp.length > 0) {
      anexar(candidatosMesmoTimestamp[0], anexo);
      return;
    }

    const chaveDia = timestampAnexo.slice(0, 10);
    if (!chaveDia) {
      return;
    }

    const candidatosMesmoDia = movimentacoesPorDia.get(chaveDia);
    if (candidatosMesmoDia && candidatosMesmoDia.length > 0) {
      anexar(candidatosMesmoDia[0], anexo);
    }
  });

  return movimentacoesComAnexos;
};

const parseJsonColumn = (value: unknown): unknown => {
  if (value === null || value === undefined) {
    return null;
  }

  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!trimmed) {
      return null;
    }

    try {
      return JSON.parse(trimmed);
    } catch {
      return trimmed;
    }
  }

  if (value instanceof Buffer) {
    const decoded = value.toString('utf-8').trim();
    if (!decoded) {
      return null;
    }

    try {
      return JSON.parse(decoded);
    } catch {
      return decoded;
    }
  }

  return value;
};

const asPlainObject = (value: unknown): Record<string, unknown> | null => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return null;
  }

  return value as Record<string, unknown>;
};

const pickTriggerValue = (
  source: Record<string, unknown> | null,
  keys: string[],
): unknown => {
  if (!source) {
    return null;
  }

  for (const key of keys) {
    if (Object.prototype.hasOwnProperty.call(source, key)) {
      return source[key];
    }
  }

  return null;
};

const toArrayOrNull = (value: unknown): unknown[] | null => {
  if (value === null || value === undefined) {
    return null;
  }

  if (Array.isArray(value)) {
    return value;
  }

  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!trimmed) {
      return null;
    }

    try {
      const parsed = JSON.parse(trimmed);
      if (Array.isArray(parsed)) {
        return parsed;
      }
    } catch {
      return [trimmed];
    }
  }

  if (value && typeof value === 'object' && 'rows' in (value as Record<string, unknown>)) {
    const possible = (value as { rows?: unknown[] }).rows;
    if (Array.isArray(possible)) {
      return possible;
    }
  }

  return null;
};

const normalizeMixedCollection = (
  value: unknown[] | null,
): Array<string | Record<string, unknown> | null> | null => {
  if (!value) {
    return null;
  }

  return value.map((item) => {
    if (item === null || item === undefined) {
      return null;
    }

    if (typeof item === 'string') {
      return item;
    }

    if (typeof item === 'number' || typeof item === 'boolean') {
      return String(item);
    }

    if (typeof item === 'object') {
      return item as Record<string, unknown>;
    }

    return null;
  });
};

const MOVIMENTACOES_DEFAULT_LIMIT = 200;

const MOVIMENTACOES_BASE_QUERY = `
  SELECT
    id,
    id_andamento,
    numero_cnj,
    instancia_processo,
    tipo_andamento,
    conteudo,
    sigiloso,
    data_andamento,
    criado_em,
    atualizado_em,
    crawl_id,
    data_cadastro
  FROM public.trigger_movimentacao_processo
  WHERE numero_cnj = $1
  ORDER BY
    data_andamento DESC NULLS LAST,
    CASE
      WHEN id_andamento::text ~ '^[0-9]+$' THEN (id_andamento::text)::bigint
      ELSE NULL
    END DESC NULLS LAST,
    id_andamento::text DESC
`;

const fetchProcessoMovimentacoes = async (
  numeroCnj: string | null | undefined,
  client?: PoolClient,
  limit: number = MOVIMENTACOES_DEFAULT_LIMIT,
): Promise<Processo['movimentacoes']> => {
  const normalizedNumero = normalizeString(numeroCnj);

  if (!normalizedNumero) {
    return [];
  }

  const executor = client ?? pool;
  const trimmedLimit = Number.isFinite(limit) && limit > 0 ? Math.trunc(limit) : 0;
  const query =
    trimmedLimit > 0
      ? `${MOVIMENTACOES_BASE_QUERY}\n  LIMIT $2`
      : MOVIMENTACOES_BASE_QUERY;
  const params = trimmedLimit > 0 ? [normalizedNumero, trimmedLimit] : [normalizedNumero];
  const result = await executor.query(query, params);
  return parseMovimentacoes(result.rows);
};

const ANEXOS_BASE_QUERY = `
SELECT DISTINCT ON (ap.id_anexo)
  ap.id_anexo,
  ap.id,
  ap.id_andamento,
  ap.nome,
  ap.tipo,
  ap.data_cadastro,
  ap.data_cadastro AS data_andamento,
  ap.instancia_processo,
  ap.crawl_id,
  mp.criado_em AS movimentacao_criado_em,
  mp.data_andamento AS movimentacao_data_andamento
FROM public.trigger_anexos_processo ap
LEFT JOIN public.trigger_movimentacao_processo mp
  ON mp.numero_cnj = ap.numero_cnj
 AND (
       (ap.id_andamento IS NOT NULL AND mp.id_andamento = ap.id_andamento)
    OR (ap.id_andamento IS NULL AND ap.data_cadastro IS NOT NULL AND mp.data_andamento = ap.data_cadastro)
  )
WHERE ap.numero_cnj = $1
ORDER BY ap.id_anexo, mp.data_andamento DESC NULLS LAST, ap.id DESC
`;

const fetchProcessoAnexos = async (
  numeroCnj: string | null | undefined,
  client?: PoolClient,
): Promise<Processo['attachments']> => {
  const normalizedNumero = normalizeString(numeroCnj);

  if (!normalizedNumero) {
    return [];
  }

  const executor = client ?? pool;
  const result = await executor.query(ANEXOS_BASE_QUERY, [normalizedNumero]);
  return parseAttachments(result.rows);
};

type RawCrawlerParticipant = {
  nome?: unknown;
  polo?: unknown;
  tipo_pessoa?: unknown;
  documento_principal?: unknown;
  tipo_documento_principal?: unknown;
  possui_advogados?: unknown;
  data_cadastro?: unknown;
};

type RawOpportunityParticipant = {
  id?: unknown;
  oportunidade_id?: unknown;
  nome?: unknown;
  documento?: unknown;
  telefone?: unknown;
  endereco?: unknown;
  relacao?: unknown;
  polo?: unknown;
  tipo_pessoa?: unknown;
  numero_cnj?: unknown;
  party_role?: unknown;
  side?: unknown;
};

const mergeNamedCollections = <
  T extends { name: string | null; document: string | null }
>(
  target: T[] | null | undefined,
  source: T[] | null | undefined,
): T[] | null => {
  if (!Array.isArray(source) || source.length === 0) {
    return target ?? null;
  }

  const base = Array.isArray(target) ? target.slice() : [];
  const seen = new Set(
    base.map((item) =>
      `${normalizeString(item?.name ?? '') ?? ''}|${normalizeString(item?.document ?? '') ?? ''}`,
    ),
  );

  source.forEach((item) => {
    if (!item) {
      return;
    }

    const normalizedName = normalizeString(item.name ?? '');
    const normalizedDocument = normalizeString(item.document ?? '');
    const key = `${normalizedName ?? ''}|${normalizedDocument ?? ''}`;

    if (seen.has(key)) {
      return;
    }

    base.push({
      ...item,
      name: normalizedName,
      document: normalizedDocument,
    });
    seen.add(key);
  });

  return base;
};

const mergeParticipantData = (
  target: ProcessoParticipant,
  source: ProcessoParticipant,
) => {
  if (!target.name && source.name) {
    target.name = source.name;
  }

  if (!target.document && source.document) {
    target.document = source.document;
  }

  if (!target.document_type && source.document_type) {
    target.document_type = source.document_type;
  }

  if (!target.side && source.side) {
    target.side = source.side;
  }

  if (!target.type && source.type) {
    target.type = source.type;
  }

  if (!target.person_type && source.person_type) {
    target.person_type = source.person_type;
  }

  if (!target.role && source.role) {
    target.role = source.role;
  }

  if (!target.party_role && source.party_role) {
    target.party_role = source.party_role;
  }

  if (!target.registered_at && source.registered_at) {
    target.registered_at = source.registered_at;
  }

  if (!target.source && source.source) {
    target.source = source.source;
  }

  target.lawyers = mergeNamedCollections(target.lawyers, source.lawyers);
  target.representatives = mergeNamedCollections(
    target.representatives,
    source.representatives,
  );
};

const buildCrawlerParticipant = (
  row: RawCrawlerParticipant,
): ProcessoParticipant | null => {
  const name = normalizeString(row.nome);
  const documentInfo = normalizeParticipantDocument(row.documento_principal);

  if (!name && !documentInfo.display) {
    return null;
  }

  const hasLawyers = parseBooleanFlag(row.possui_advogados);

  const participant: ProcessoParticipant = {
    name: name ?? null,
    document: documentInfo.display,
    document_type: normalizeUppercase(row.tipo_documento_principal),
    side: normalizeParticipantSide(row.polo),
    type: normalizeString(row.polo),
    person_type: normalizeUppercase(row.tipo_pessoa),
    role: null,
    party_role: null,
    lawyers: hasLawyers === true ? [] : null,
    representatives: null,
    registered_at: normalizeTimestamp(row.data_cadastro),
    source: 'crawler',
  };

  return participant;
};

const buildOpportunityParticipant = (
  row: RawOpportunityParticipant,
): ProcessoParticipant | null => {
  const name = normalizeString(row.nome);
  const documentInfo = normalizeParticipantDocument(row.documento);

  if (!name && !documentInfo.display) {
    return null;
  }

  let idValue: number | string | null = null;

  if (typeof row.id === 'number' && Number.isFinite(row.id)) {
    idValue = Math.trunc(row.id);
  } else if (typeof row.id === 'string') {
    const trimmed = row.id.trim();
    if (trimmed) {
      const parsed = Number.parseInt(trimmed, 10);
      idValue = Number.isFinite(parsed) ? parsed : trimmed;
    }
  }

  const participant: ProcessoParticipant = {
    id: idValue,
    name: name ?? null,
    document: documentInfo.display,
    document_type: null,
    side:
      normalizeParticipantSide(row.side) ??
      normalizeParticipantSide(row.polo) ??
      normalizeParticipantSide(row.relacao),
    type: normalizeString(row.side ?? row.polo),
    person_type: normalizeUppercase(row.tipo_pessoa),
    role: normalizeString(row.relacao),
    party_role: normalizeString(row.party_role),
    lawyers: null,
    representatives: null,
    registered_at: null,
    source: 'opportunity',
  };

  return participant;
};

const fetchProcessParticipants = async (
  numeroCnj: string | null | undefined,
  oportunidadeId: number | null | undefined,
  client?: PoolClient,
): Promise<ProcessoParticipant[]> => {
  const normalizedNumero = normalizeString(numeroCnj);
  const executor = client ?? pool;

  let crawlerRows: RawCrawlerParticipant[] = [];

  if (normalizedNumero) {
    const crawlerResult = await executor.query(
      `SELECT
          nome,
          CASE
            WHEN polo = 'Passive' THEN 'Passivo'
            WHEN polo = 'Active' THEN 'Ativo'
            ELSE polo
          END AS polo,
          tipo_pessoa,
          documento_principal,
          tipo_documento_principal,
          possui_advogados,
          data_cadastro
        FROM public.trigger_envolvidos_processo
       WHERE numero_cnj = $1`,
      [normalizedNumero],
    );

    crawlerRows = Array.isArray(crawlerResult.rows)
      ? (crawlerResult.rows as RawCrawlerParticipant[])
      : [];
  }

  let oportunidadeRows: RawOpportunityParticipant[] = [];

  const opportunityConditions: string[] = [];
  const opportunityParams: Array<string | number> = [];

  if (
    typeof oportunidadeId === 'number' &&
    Number.isInteger(oportunidadeId) &&
    oportunidadeId > 0
  ) {
    opportunityParams.push(oportunidadeId);
    const index = opportunityParams.length;
    opportunityConditions.push(`oportunidade_id = $${index}`);
  }

  if (normalizedNumero) {
    opportunityParams.push(normalizedNumero);
    const numeroIndex = opportunityParams.length;
    opportunityConditions.push(
      `(
        to_jsonb(oe)->>'numero_cnj' = $${numeroIndex}
        OR to_jsonb(oe)->>'numero_processo_cnj' = $${numeroIndex}
      )`,
    );
  }

  if (opportunityConditions.length > 0) {
    const whereClause = opportunityConditions
      .map((condition) => `(${condition})`)
      .join(' OR ');

    const oportunidadeResult = await executor.query(
      `SELECT
         id,
         oportunidade_id,
         nome,
         documento,
         telefone,
         endereco,
         relacao,
         to_jsonb(oe)->>'polo' AS polo,
         to_jsonb(oe)->>'tipo_pessoa' AS tipo_pessoa,
         to_jsonb(oe)->>'numero_cnj' AS numero_cnj,
         to_jsonb(oe)->>'party_role' AS party_role,
         to_jsonb(oe)->>'side' AS side
       FROM public.oportunidade_envolvidos oe
       WHERE ${whereClause}`,
      opportunityParams,
    );

    oportunidadeRows = Array.isArray(oportunidadeResult.rows)
      ? (oportunidadeResult.rows as RawOpportunityParticipant[])
      : [];
  }

  const participants: ProcessoParticipant[] = [];
  const participantsByDocument = new Map<string, ProcessoParticipant>();

  const registerParticipant = (participant: ProcessoParticipant | null) => {
    if (!participant) {
      return;
    }

    const documentKey = resolveDocumentKey(participant.document ?? null);

    if (documentKey) {
      const existing = participantsByDocument.get(documentKey);

      if (existing) {
        if (!existing.side && participant.side) {
          existing.side = participant.side;
        } else if (!participant.side && existing.side) {
          participant.side = existing.side;
        }

        mergeParticipantData(existing, participant);
        return;
      }

      participantsByDocument.set(documentKey, participant);
    }

    participants.push(participant);
  };

  crawlerRows.forEach((row) => {
    registerParticipant(buildCrawlerParticipant(row));
  });

  oportunidadeRows.forEach((row) => {
    registerParticipant(buildOpportunityParticipant(row));
  });

  return participants.map((participant) => {
    const normalizedName = normalizeString(participant.name);
    const normalizedDocument = normalizeString(participant.document);
    const normalizedType = normalizeString(participant.type);
    const normalizedRole = normalizeString(participant.role);
    const normalizedPartyRole = normalizeString(participant.party_role);
    const normalizedPersonType = normalizeUppercase(participant.person_type);
    const normalizedDocumentType = normalizeUppercase(participant.document_type);
    const normalizedRegisteredAt = normalizeTimestamp(participant.registered_at);

    const resolvedSide =
      participant.side ??
      normalizeParticipantSide(normalizedType) ??
      normalizeParticipantSide(normalizedRole) ??
      normalizeParticipantSide(normalizedPartyRole);

    const normalizedLawyers = Array.isArray(participant.lawyers)
      ? participant.lawyers
          .map((lawyer) => ({
            name: normalizeString(lawyer?.name ?? ''),
            document: normalizeString(lawyer?.document ?? ''),
          }))
          .filter(
            (lawyer): lawyer is { name: string | null; document: string | null } =>
              Boolean(lawyer.name) || Boolean(lawyer.document),
          )
      : null;

    const normalizedRepresentatives = Array.isArray(participant.representatives)
      ? participant.representatives
          .map((rep) => ({
            name: normalizeString(rep?.name ?? ''),
            document: normalizeString(rep?.document ?? ''),
          }))
          .filter(
            (rep): rep is { name: string | null; document: string | null } =>
              Boolean(rep.name) || Boolean(rep.document),
          )
      : null;

    return {
      ...participant,
      name: normalizedName,
      document: normalizedDocument,
      document_type: normalizedDocumentType,
      side: resolvedSide,
      type: normalizedType,
      role: normalizedRole,
      party_role: normalizedPartyRole,
      person_type: normalizedPersonType,
      registered_at: normalizedRegisteredAt,
      lawyers: normalizedLawyers,
      representatives: normalizedRepresentatives,
    };
  });
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

const listProcessoSelect = `
  SELECT DISTINCT
    p.id,
    p.cliente_id,
    p.idempresa,
    p.numero_cnj AS numero,
    p.uf,
    p.municipio,
    COALESCE(dp.orgao_julgador, p.orgao_julgador) AS orgao_julgador,
    COALESCE(dp.area, tp.nome) AS tipo,
    COALESCE(dp.situacao, sp.nome) AS status,
    COALESCE(dp.classificacao_principal_nome, p.classe_judicial) AS classe_judicial,
    COALESCE(dp.assunto, p.assunto) AS assunto,
    p.jurisdicao,
    p.grau,
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
    mp.data_andamento AS atualizado_em,
    p.atualizado_em AS ultima_sincronizacao,
    COALESCE(dp.data_distribuicao, mp.atualizado_em) AS ultima_movimentacao,
    (
      SELECT COUNT(*)::int
      FROM public.processo_consultas_api pc
      WHERE pc.processo_id = p.id
    ) AS consultas_api_count,
    p.situacao_processo_id,
    p.tipo_processo_id,
    p.area_atuacao_id,
    p.instancia,
    p.sistema_cnj_id,
    p.monitorar_processo,
    p.envolvidos_id,
    p.descricao,
    p.setor_id,
    p.data_citacao,
    p.data_recebimento,
    p.data_arquivamento,
    p.data_encerramento,
    p.justica_gratuita,
    p.liminar,
    p.nivel_sigilo,
    p.tramitacaoatual,
    p.permite_peticionar,
    (
      SELECT COUNT(*)::int
      FROM public.trigger_movimentacao_processo tmp
      WHERE tmp.numero_cnj = p.numero_cnj
    ) AS movimentacoes_count,
    sp.nome AS situacao_processo_nome,
    tp.nome AS tipo_processo_nome,
    aa.nome AS area_atuacao_nome,
    setor.nome AS setor_nome,
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
    ) AS advogados
FROM public.processos p
LEFT JOIN public.tipo_processo tp ON tp.id = p.tipo_processo_id
LEFT JOIN public.situacao_processo sp ON sp.id = p.situacao_processo_id
LEFT JOIN public.area_atuacao aa ON aa.id = p.area_atuacao_id
LEFT JOIN public.escritorios setor ON setor.id = p.setor_id
LEFT JOIN public.trigger_dados_processo dp ON dp.numero_cnj = p.numero_cnj
LEFT JOIN public.trigger_movimentacao_processo mp ON mp.numero_cnj = p.numero_cnj and mp.id_andamento = dp.id_ultimo_andamento
LEFT JOIN public.oportunidades o ON o.id = p.oportunidade_id
LEFT JOIN public.clientes c ON c.id = p.cliente_id
LEFT JOIN public.clientes solicitante ON solicitante.id = o.solicitante_id
`;

const baseProcessoSelect = `
  SELECT DISTINCT
    p.id,
    p.cliente_id,
    p.idempresa,
    p.numero_cnj AS numero,
    p.uf,
    p.municipio,
    COALESCE(dp.orgao_julgador, p.orgao_julgador) AS orgao_julgador,
    COALESCE(dp.area, tp.nome) AS tipo,
    COALESCE(dp.situacao, sp.nome) AS status,
    COALESCE(dp.classificacao_principal_nome, p.classe_judicial) AS classe_judicial,
    COALESCE(dp.assunto, p.assunto) AS assunto,
    p.jurisdicao,
    p.grau,
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
    mp.data_andamento AS atualizado_em,
    p.atualizado_em AS ultima_sincronizacao,
    COALESCE(dp.data_distribuicao, mp.atualizado_em) AS ultima_movimentacao,
    (
      SELECT COUNT(*)::int
      FROM public.processo_consultas_api pc
      WHERE pc.processo_id = p.id
    ) AS consultas_api_count,
    p.situacao_processo_id,
    p.tipo_processo_id,
    p.area_atuacao_id,
    p.instancia,
    p.sistema_cnj_id,
    p.monitorar_processo,
    p.envolvidos_id,
    p.descricao,
    p.setor_id,
    p.data_citacao,
    p.data_recebimento,
    p.data_arquivamento,
    p.data_encerramento,
    p.justica_gratuita,
    p.liminar,
    p.nivel_sigilo,
    p.tramitacaoatual,
    p.permite_peticionar,
    sp.nome AS situacao_processo_nome,
    tp.nome AS tipo_processo_nome,
    aa.nome AS area_atuacao_nome,
    setor.nome AS setor_nome,
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
      WHERE tmp.numero_cnj = p.numero_cnj
    ) AS movimentacoes_count,
    to_jsonb(dp) AS trigger_dados_processo
FROM public.processos p
LEFT JOIN public.tipo_processo tp ON tp.id = p.tipo_processo_id
LEFT JOIN public.situacao_processo sp ON sp.id = p.situacao_processo_id
LEFT JOIN public.area_atuacao aa ON aa.id = p.area_atuacao_id
LEFT JOIN public.escritorios setor ON setor.id = p.setor_id
LEFT JOIN public.trigger_dados_processo dp ON dp.numero_cnj = p.numero_cnj
LEFT JOIN public.trigger_movimentacao_processo mp ON mp.numero_cnj = p.numero_cnj and mp.id_andamento = dp.id_ultimo_andamento
LEFT JOIN public.oportunidades o ON o.id = p.oportunidade_id
LEFT JOIN public.clientes c ON c.id = p.cliente_id
LEFT JOIN public.clientes solicitante ON solicitante.id = o.solicitante_id
`;

const mapProcessoListRow = (row: any): Processo => {
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

  const dataDistribuicao =
    normalizeTimestamp(row.data_distribuicao) ??
    normalizeDate(row.data_distribuicao) ??
    (typeof row.data_distribuicao === 'string' ? row.data_distribuicao : null);

  const ultimaSincronizacao =
    normalizeTimestamp(row.ultima_sincronizacao) ?? row.ultima_sincronizacao ?? null;

  const ultimaMovimentacao = normalizeTimestamp(row.ultima_movimentacao);
  const grauValue = typeof row.grau === 'string' ? row.grau : null;
  const justicaGratuitaValue = parseBooleanFlag(row.justica_gratuita);
  const liminarValue = parseBooleanFlag(row.liminar);
  const nivelSigiloValue = parseOptionalInteger(row.nivel_sigilo);
  const tramitacaoAtualValue = normalizeString(row.tramitacaoatual);
  const permitePeticionarValue =
    parseBooleanFlag(row.permite_peticionar) ?? true;

  const clienteResumo = row.cliente_id
    ? {
        id: row.cliente_id,
        nome: row.cliente_nome ?? null,
        documento: row.cliente_documento ?? null,
        tipo:
          row.cliente_tipo === null || row.cliente_tipo === undefined
            ? null
            : String(row.cliente_tipo),
      }
    : null;

  return {
    id: row.id,
    cliente_id: row.cliente_id,
    idempresa: row.idempresa ?? null,
    numero: row.numero,
    grau: grauValue ?? '',
    uf: row.uf ?? null,
    municipio: row.municipio ?? null,
    orgao_julgador: row.orgao_julgador ?? null,
    tipo: row.tipo ?? null,
    status: row.status ?? null,
    classe_judicial: row.classe_judicial ?? null,
    assunto: row.assunto ?? null,
    jurisdicao: row.jurisdicao ?? null,
    oportunidade_id: oportunidade?.id ?? null,
    advogado_responsavel: row.advogado_responsavel ?? null,
    data_distribuicao: dataDistribuicao,
    criado_em: row.criado_em,
    atualizado_em: row.atualizado_em,
    ultima_sincronizacao: ultimaSincronizacao,
    ultima_movimentacao: ultimaMovimentacao,
    consultas_api_count: parseInteger(row.consultas_api_count),
    situacao_processo_id: parseOptionalInteger(row.situacao_processo_id),
    situacao_processo_nome: normalizeString(row.situacao_processo_nome),
    tipo_processo_id: parseOptionalInteger(row.tipo_processo_id),
    tipo_processo_nome: normalizeString(row.tipo_processo_nome),
    area_atuacao_id: parseOptionalInteger(row.area_atuacao_id),
    area_atuacao_nome: normalizeString(row.area_atuacao_nome),
    instancia: normalizeString(row.instancia),
    sistema_cnj_id: parseOptionalInteger(row.sistema_cnj_id),
    monitorar_processo: parseBooleanFlag(row.monitorar_processo) ?? false,
    justica_gratuita: justicaGratuitaValue,
    liminar: liminarValue,
    nivel_sigilo: nivelSigiloValue,
    tramitacao_atual: tramitacaoAtualValue,
    permite_peticionar: permitePeticionarValue,
    envolvidos_id: parseOptionalInteger(row.envolvidos_id),
    descricao: normalizeString(row.descricao),
    setor_id: parseOptionalInteger(row.setor_id),
    setor_nome: normalizeString(row.setor_nome),
    data_citacao: normalizeDate(row.data_citacao),
    data_recebimento: normalizeDate(row.data_recebimento),
    data_arquivamento: normalizeDate(row.data_arquivamento),
    data_encerramento: normalizeDate(row.data_encerramento),
    movimentacoes_count: parseInteger(row.movimentacoes_count),
    cliente: clienteResumo,
    oportunidade,
    advogados: parseAdvogados(row.advogados),
  };
};

const mapProcessoRow = (row: any): Processo => {
  const oportunidadeId = parseOptionalInteger(row.oportunidade_id);
  const sequencial = parseOptionalInteger(row.oportunidade_sequencial_empresa);
  const solicitanteId = parseOptionalInteger(row.oportunidade_solicitante_id);
  const solicitanteNome = normalizeString(row.oportunidade_solicitante_nome);

  const triggerDados = asPlainObject(parseJsonColumn(row.trigger_dados_processo));
  const getTriggerValue = (keys: string[]): unknown => pickTriggerValue(triggerDados, keys);
  const getTriggerString = (keys: string[]): string | null => {
    const value = getTriggerValue(keys);
    if (typeof value === 'string') {
      return normalizeString(value);
    }

    if (typeof value === 'number' || typeof value === 'boolean') {
      return String(value);
    }

    return null;
  };
  const getTriggerTimestamp = (keys: string[]): string | null => {
    const raw = getTriggerValue(keys);
    return normalizeTimestamp(raw) ?? normalizeDate(raw);
  };
  const getTriggerJson = (keys: string[]): unknown => parseJsonColumn(getTriggerValue(keys));
  const indicadoresDados = asPlainObject(getTriggerJson(['indicadores']));
  const getIndicatorRaw = (keys: string[]): unknown => {
    const primary = getTriggerValue(keys);
    if (primary !== null && primary !== undefined) {
      return primary;
    }

    if (indicadoresDados) {
      const nested = pickTriggerValue(indicadoresDados, keys);
      if (nested !== null && nested !== undefined) {
        return nested;
      }
    }

    return null;
  };
  const getIndicatorValue = (keys: string[]): boolean | string | null => {
    const parsed = parseJsonColumn(getIndicatorRaw(keys));
    const booleanCandidate = parseBooleanFlag(parsed);
    if (booleanCandidate !== null) {
      return booleanCandidate;
    }

    if (parsed === null || parsed === undefined) {
      return null;
    }

    if (typeof parsed === 'string') {
      return normalizeString(parsed);
    }

    if (typeof parsed === 'number') {
      return parsed === 0 ? false : true;
    }

    if (typeof parsed === 'boolean') {
      return parsed;
    }

    return null;
  };
  const getIndicatorString = (keys: string[]): string | null => {
    const parsed = parseJsonColumn(getIndicatorRaw(keys));

    if (parsed === null || parsed === undefined) {
      return null;
    }

    if (typeof parsed === 'string') {
      return normalizeString(parsed);
    }

    if (typeof parsed === 'number' || typeof parsed === 'boolean') {
      return String(parsed);
    }

    return null;
  };

  const tribunalAcronym = getTriggerString([
    'tribunal_acronym',
    'tribunal_sigla',
    'tribunalAcronym',
    'tribunalSigla',
  ]);
  const tribunalName =
    getTriggerString(['tribunal_name', 'tribunal_nome', 'tribunalName', 'nome_tribunal']) ?? null;
  const tribunalDescricao =
    getTriggerString(['tribunal', 'tribunal_descricao', 'nome_tribunal']) ?? tribunalName;
  const justiceDescription =
    getTriggerString(['justice_description', 'justica_descricao', 'descricao_justica', 'justica']) ??
    null;
  const countyRaw = getTriggerJson(['county', 'comarca', 'localidade']);
  let county: Processo['county'] = null;
  if (typeof countyRaw === 'string') {
    county = normalizeString(countyRaw);
  } else if (countyRaw && typeof countyRaw === 'object') {
    county = countyRaw as Record<string, unknown>;
  }

  const amountRaw = getTriggerJson(['amount', 'valor_causa', 'valor_da_causa']);
  let amount: Processo['amount'] = null;
  if (typeof amountRaw === 'number' && Number.isFinite(amountRaw)) {
    amount = amountRaw;
  } else if (typeof amountRaw === 'string') {
    const trimmed = amountRaw.trim();
    amount = trimmed ? trimmed : null;
  }

  const distributionDate =
    getTriggerTimestamp(['distribution_date', 'data_distribuicao']) ?? normalizeTimestamp(row.data_distribuicao);
  const subjectsRaw = getTriggerJson(['subjects', 'assuntos']);
  const classificationsRaw = getTriggerJson(['classifications', 'classificacoes']);
  const tagsRaw = getTriggerJson(['tags']);
  const precatory = getIndicatorValue(['precatory', 'precatorio']);
  const freeJustice = getIndicatorValue(['free_justice', 'justica_gratuita', 'gratuidade_justica']);
  const secrecyLevel =
    getIndicatorString(['secrecy_level', 'nivel_sigilo', 'nivel_de_sigilo']) ??
    getTriggerString(['secrecy', 'sigilo']);

  const parseSubjects = toArrayOrNull(subjectsRaw);
  const parseClassifications = toArrayOrNull(classificationsRaw);
  const normalizedSubjects = normalizeMixedCollection(parseSubjects);
  const normalizedClassifications = normalizeMixedCollection(parseClassifications);
  const subjectsList =
    normalizedSubjects ??
    (subjectsRaw && typeof subjectsRaw === 'object' && !Array.isArray(subjectsRaw)
      ? [subjectsRaw as Record<string, unknown>]
      : null);
  const classificationsList =
    normalizedClassifications ??
    (classificationsRaw && typeof classificationsRaw === 'object' && !Array.isArray(classificationsRaw)
      ? [classificationsRaw as Record<string, unknown>]
      : null);
  let tags: Processo['tags'] = null;

  if (Array.isArray(tagsRaw)) {
    tags = tagsRaw;
  } else if (tagsRaw && typeof tagsRaw === 'object') {
    tags = tagsRaw as Record<string, unknown>;
  } else if (typeof tagsRaw === 'string') {
    tags = normalizeString(tagsRaw);
  }

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
  const grauValue = typeof row.grau === 'string' ? row.grau : null;
  const justicaGratuitaValue = parseBooleanFlag(row.justica_gratuita);
  const liminarValue = parseBooleanFlag(row.liminar);
  const nivelSigiloValue = parseOptionalInteger(row.nivel_sigilo);
  const tramitacaoAtualValue = normalizeString(row.tramitacaoatual);
  const permitePeticionarValue =
    parseBooleanFlag(row.permite_peticionar) ?? true;

  return {
    id: row.id,
    cliente_id: row.cliente_id,
    idempresa: row.idempresa ?? null,
    numero: row.numero,
    grau: grauValue ?? '',
    uf: row.uf,
    municipio: row.municipio,
    orgao_julgador: row.orgao_julgador,
    tipo: row.tipo,
    status: row.status,
    classe_judicial: row.classe_judicial,
    assunto: row.assunto,
    jurisdicao: row.jurisdicao,
    tribunal_acronym: tribunalAcronym,
    tribunal: tribunalDescricao ?? tribunalAcronym,
    tribunal_name: tribunalName ?? tribunalDescricao ?? tribunalAcronym,
    justice_description: justiceDescription,
    county,
    amount,
    distribution_date: distributionDate,
    subjects: subjectsList,
    classifications: classificationsList,
    tags,
    precatory,
    free_justice: freeJustice,
    secrecy_level: secrecyLevel,
    oportunidade_id: oportunidade?.id ?? null,
    advogado_responsavel: row.advogado_responsavel,
    data_distribuicao: row.data_distribuicao,
    criado_em: row.criado_em,
    atualizado_em: row.atualizado_em,
    ultima_movimentacao: normalizeTimestamp(row.ultima_movimentacao),
    ultima_sincronizacao: normalizeTimestamp(row.ultima_sincronizacao),
    consultas_api_count: parseInteger(row.consultas_api_count),
    situacao_processo_id: parseOptionalInteger(row.situacao_processo_id),
    situacao_processo_nome: normalizeString(row.situacao_processo_nome),
    tipo_processo_id: parseOptionalInteger(row.tipo_processo_id),
    tipo_processo_nome: normalizeString(row.tipo_processo_nome),
    area_atuacao_id: parseOptionalInteger(row.area_atuacao_id),
    area_atuacao_nome: normalizeString(row.area_atuacao_nome),
    instancia: normalizeString(row.instancia),
    sistema_cnj_id: parseOptionalInteger(row.sistema_cnj_id),
    monitorar_processo: parseBooleanFlag(row.monitorar_processo) ?? false,
    justica_gratuita: justicaGratuitaValue,
    liminar: liminarValue,
    nivel_sigilo: nivelSigiloValue,
    tramitacao_atual: tramitacaoAtualValue,
    permite_peticionar: permitePeticionarValue,
    envolvidos_id: parseOptionalInteger(row.envolvidos_id),
    descricao: normalizeString(row.descricao),
    setor_id: parseOptionalInteger(row.setor_id),
    setor_nome: normalizeString(row.setor_nome),
    data_citacao: normalizeDate(row.data_citacao),
    data_recebimento: normalizeDate(row.data_recebimento),
    data_arquivamento: normalizeDate(row.data_arquivamento),
    data_encerramento: normalizeDate(row.data_encerramento),
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
    attachments: parseAttachments(row.attachments),
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
      `${listProcessoSelect}
       WHERE p.idempresa = $1
       ORDER BY p.criado_em DESC`,
      [empresaId]
    );

    return res.json(result.rows.map(mapProcessoListRow));
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
      `${listProcessoSelect}
       WHERE p.cliente_id = $1
         AND p.idempresa = $2
       ORDER BY p.criado_em DESC`,
      [parsedClienteId, empresaId]
    );

    res.json(result.rows.map(mapProcessoListRow));
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

    const [participants, movimentacoes, attachments] = await Promise.all([
      fetchProcessParticipants(processo.numero, processo.oportunidade_id),
      fetchProcessoMovimentacoes(processo.numero),
      fetchProcessoAnexos(processo.numero),
    ]);

    processo.movimentacoes = mergeMovimentacoesWithAttachments(
      movimentacoes,
      attachments,
    );
    processo.attachments = attachments;
    processo.participants = participants.length > 0 ? participants : [];

    res.json(processo);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Internal server error' });
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

    const processoResult = await pool.query(
      'SELECT numero_cnj, instancia FROM public.processos WHERE id = $1 AND idempresa IS NOT DISTINCT FROM $2',
      [parsedId, empresaId],
    );

    if (processoResult.rowCount === 0) {
      return res.status(404).json({ error: 'Processo não encontrado' });
    }

    const processoData = processoResult.rows[0];
    const numeroCnj = normalizeString(processoData?.numero_cnj);
    const instanciaProcesso = normalizeString(processoData?.instancia);

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

    const sigilosoValue = parseBooleanFlag(req.body?.sigiloso) ?? false;
    const insertResult = await pool.query(
      `INSERT INTO public.trigger_movimentacao_processo (
         id_andamento,
         numero_cnj,
         instancia_processo,
         tipo_andamento,
         conteudo,
         sigiloso,
         data_andamento,
         criado_em,
         atualizado_em,
         crawl_id
       )
       VALUES ($1, $2, $3, $4, $5, $6, $7, NOW(), NOW(), NULL)
       RETURNING
         id,
         id_andamento,
         numero_cnj,
         instancia_processo,
         tipo_andamento,
         conteudo,
         sigiloso,
         data_andamento,
         criado_em,
         atualizado_em,
         crawl_id,
         data_cadastro`,
      [
        randomUUID(),
        numeroCnj,
        instanciaProcesso,
        preparedRecord.tipo,
        preparedRecord.conteudo,
        sigilosoValue,
        preparedRecord.data,
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

export const syncProcessoWithJudit = async (req: Request, res: Response) => {
  const { id } = req.params;
  const parsedId = Number(id);

  if (!Number.isInteger(parsedId) || parsedId <= 0) {
    return res.status(400).json({ error: 'ID inválido' });
  }

  const withAttachments = req.body?.withAttachments === true;
  const onDemand = req.body?.onDemand === true;

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

    const processoResult = await pool.query(
      'SELECT numero_cnj, instancia FROM public.processos WHERE id = $1 AND idempresa IS NOT DISTINCT FROM $2 LIMIT 1',
      [parsedId, empresaId],
    );

    if (processoResult.rowCount === 0) {
      return res.status(404).json({ error: 'Processo não encontrado' });
    }

    const processoData = processoResult.rows[0] as {
      numero_cnj?: unknown;
      instancia?: unknown;
    };
    const numeroCnj = normalizeString(processoData?.numero_cnj);

    if (!numeroCnj) {
      return res.status(400).json({ error: 'Processo sem número CNJ cadastrado' });
    }

    const instanciaAtual = normalizeString(processoData?.instancia);

    const availability = await evaluateProcessSyncAvailability(empresaId);

    if (!availability.allowed) {
      if (availability.reason === 'disabled') {
        return res
          .status(403)
          .json({ error: 'Sincronização de processos não habilitada no plano atual.' });
      }

      if (availability.reason === 'quota_exceeded') {
        return res
          .status(429)
          .json({ error: 'Limite de sincronizações atingido no plano atual.' });
      }

      return res.status(403).json({ error: 'Sincronização indisponível para o plano atual.' });
    }

    const result = await executeJuditProcessSync({
      processId: parsedId,
      empresaId,
      numeroCnj,
      instanciaAtual,
      requestedByUserId: req.auth.userId ?? null,
      withAttachments,
      onDemand,
    });

    return res.json({
      message: 'Processo sincronizado com sucesso',
      requestId: result.requestId,
      summary: result.summary,
    });
  } catch (error) {
    console.error(error);
    const message =
      error instanceof Error
        ? error.message
        : 'Erro ao sincronizar processo com a Judit';
    const statusCode = message.includes('Integração') ? 400 : 500;
    return res.status(statusCode).json({ error: message });
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
    situacao_processo_id,
    tipo_processo_id,
    area_atuacao_id,
    instancia,
    sistema_cnj_id,
    monitorar_processo,
    envolvidos_id,
    descricao,
    setor_id,
    data_citacao,
    data_recebimento,
    data_arquivamento,
    data_encerramento,
  } = req.body;

  const parsedClienteId = Number(cliente_id);

  if (!Number.isInteger(parsedClienteId) || parsedClienteId <= 0) {
    return res.status(400).json({ error: 'cliente_id inválido' });
  }

  const numeroValue = normalizeString(numero);
  const ufValue = normalizeUppercase(uf);
  const municipioValue = normalizeString(municipio);
  const orgaoValue = normalizeString(orgao_julgador);
  const grauValue = normalizeString(req.body?.grau);

  if (!numeroValue || !ufValue || !municipioValue || !grauValue) {
    return res.status(400).json({
      error:
        'Os campos cliente_id, numero, uf, municipio e grau são obrigatórios',
    });
  }

  const tipoValue = normalizeString(tipo);
  const statusValue = normalizeString(status);
  const classeValue = normalizeString(classe_judicial);
  const assuntoValue = normalizeString(assunto);
  const jurisdicaoValue = normalizeString(jurisdicao);
  const advogadoValue = normalizeString(advogado_responsavel);
  const dataDistribuicaoValue = normalizeDate(data_distribuicao);
  const justicaGratuitaFlag = parseBooleanFlag(req.body?.justica_gratuita);
  const liminarFlag = parseBooleanFlag(req.body?.liminar);
  const permitePeticionarFlag = parseBooleanFlag(req.body?.permite_peticionar);
  const nivelSigiloValue = parseOptionalInteger(req.body?.nivel_sigilo);

  if (nivelSigiloValue !== null && nivelSigiloValue < 0) {
    return res.status(400).json({ error: 'nivel_sigilo inválido' });
  }

  const tramitacaoAtualValue = normalizeString(
    req.body?.tramitacao_atual ?? req.body?.tramitacaoatual,
  );
  const oportunidadeResolution = resolveNullablePositiveInteger(
    req.body?.oportunidade_id ?? req.body?.proposta_id ?? null,
  );

  if (!oportunidadeResolution.ok) {
    return res.status(400).json({ error: 'oportunidade_id inválido' });
  }

  const oportunidadeIdValue = oportunidadeResolution.value;
  const situacaoProcessoResolution = resolveNullablePositiveInteger(
    situacao_processo_id,
  );

  if (!situacaoProcessoResolution.ok) {
    return res.status(400).json({ error: 'situacao_processo_id inválido' });
  }

  let situacaoProcessoIdValue = situacaoProcessoResolution.value;

  const tipoProcessoResolution = resolveNullablePositiveInteger(
    tipo_processo_id,
  );

  if (!tipoProcessoResolution.ok) {
    return res.status(400).json({ error: 'tipo_processo_id inválido' });
  }

  let tipoProcessoIdValue = tipoProcessoResolution.value;

  const areaAtuacaoResolution = resolveNullablePositiveInteger(
    area_atuacao_id,
  );

  if (!areaAtuacaoResolution.ok) {
    return res.status(400).json({ error: 'area_atuacao_id inválido' });
  }

  const areaAtuacaoIdValue = areaAtuacaoResolution.value;

  const sistemaCnjResolution = resolveNullablePositiveInteger(sistema_cnj_id);

  if (!sistemaCnjResolution.ok) {
    return res.status(400).json({ error: 'sistema_cnj_id inválido' });
  }

  const sistemaCnjIdValue = sistemaCnjResolution.value;

  const envolvidosResolution = resolveNullablePositiveInteger(envolvidos_id);

  if (!envolvidosResolution.ok) {
    return res.status(400).json({ error: 'envolvidos_id inválido' });
  }

  const envolvidosIdValue = envolvidosResolution.value;

  const setorResolution = resolveNullablePositiveInteger(setor_id);

  if (!setorResolution.ok) {
    return res.status(400).json({ error: 'setor_id inválido' });
  }

  const setorIdValue = setorResolution.value;
  const instanciaValue = normalizeString(instancia);
  const descricaoValue = normalizeString(descricao);
  const monitorarProcessoFlag = parseBooleanFlag(monitorar_processo);
  let monitorarProcessoValue = monitorarProcessoFlag;
  const dataCitacaoValue = normalizeDate(data_citacao);
  const dataRecebimentoValue = normalizeDate(data_recebimento);
  const dataArquivamentoValue = normalizeDate(data_arquivamento);
  const dataEncerramentoValue = normalizeDate(data_encerramento);
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

    if (tipoProcessoIdValue === null && tipoValue && empresaId !== null) {
      const tipoLookup = await pool.query(
        'SELECT id FROM public.tipo_processo WHERE idempresa IS NOT DISTINCT FROM $1 AND LOWER(nome) = LOWER($2) LIMIT 1',
        [empresaId, tipoValue],
      );

      if ((tipoLookup.rowCount ?? 0) > 0) {
        const resolvedId = parseOptionalInteger(tipoLookup.rows[0]?.id);
        if (resolvedId) {
          tipoProcessoIdValue = resolvedId;
        }
      }
    }

    if (situacaoProcessoIdValue === null && statusValue) {
      const situacaoLookup = await pool.query(
        'SELECT id FROM public.situacao_processo WHERE LOWER(nome) = LOWER($1) LIMIT 1',
        [statusValue],
      );

      if ((situacaoLookup.rowCount ?? 0) > 0) {
        const resolvedSituacaoId = parseOptionalInteger(
          situacaoLookup.rows[0]?.id,
        );
        if (resolvedSituacaoId) {
          situacaoProcessoIdValue = resolvedSituacaoId;
        }
      }
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
    const finalMonitorarProcesso = monitorarProcessoValue ?? false;
    const finalPermitePeticionar = permitePeticionarFlag ?? true;

    const clientDb = await pool.connect();

    try {
      await clientDb.query('BEGIN');

      const insertResult = await clientDb.query(
        `INSERT INTO public.processos (
            cliente_id,
            numero_cnj,
            uf,
            municipio,
            orgao_julgador,
            situacao_processo_id,
            classe_judicial,
            assunto,
            jurisdicao,
            oportunidade_id,
            advogado_responsavel,
            data_distribuicao,
            idempresa,
            area_atuacao_id,
            tipo_processo_id,
            instancia,
            sistema_cnj_id,
            monitorar_processo,
            envolvidos_id,
            descricao,
            setor_id,
            data_citacao,
            data_recebimento,
            data_arquivamento,
            data_encerramento,
            grau,
            justica_gratuita,
            liminar,
            nivel_sigilo,
            tramitacaoatual,
            permite_peticionar
          )
          VALUES (
            $1,
            $2,
            $3,
            $4,
            $5,
            $6,
            $7,
            $8,
            $9,
            $10,
            $11,
            $12,
            $13,
            $14,
            $15,
            $16,
            $17,
            $18,
            $19,
            $20,
            $21,
            $22,
            $23,
            $24,
            $25,
            $26,
            $27,
            $28,
            $29,
            $30,
            $31
          )
          RETURNING id`,
        [
          parsedClienteId,
          numeroValue,
          ufValue,
          municipioValue,
          orgaoValue,
          situacaoProcessoIdValue,
          classeValue,
          assuntoValue,
          jurisdicaoValue,
          oportunidadeIdValue,
          advogadoColumnValue,
          dataDistribuicaoValue,
          empresaId,
          areaAtuacaoIdValue,
          tipoProcessoIdValue,
          instanciaValue,
          sistemaCnjIdValue,
          finalMonitorarProcesso,
          envolvidosIdValue,
          descricaoValue,
          setorIdValue,
          dataCitacaoValue,
          dataRecebimentoValue,
          dataArquivamentoValue,
          dataEncerramentoValue,
          grauValue,
          justicaGratuitaFlag,
          liminarFlag,
          nivelSigiloValue,
          tramitacaoAtualValue,
          finalPermitePeticionar,
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
    situacao_processo_id,
    tipo_processo_id,
    area_atuacao_id,
    instancia,
    sistema_cnj_id,
    monitorar_processo,
    envolvidos_id,
    descricao,
    setor_id,
    data_citacao,
    data_recebimento,
    data_arquivamento,
    data_encerramento,
  } = req.body;

  const parsedClienteId = Number(cliente_id);

  if (!Number.isInteger(parsedClienteId) || parsedClienteId <= 0) {
    return res.status(400).json({ error: 'cliente_id inválido' });
  }

  const numeroValue = normalizeString(numero);
  const ufValue = normalizeUppercase(uf);
  const municipioValue = normalizeString(municipio);
  const orgaoValue = normalizeString(orgao_julgador);
  const grauValue = normalizeString(req.body?.grau);

  if (!numeroValue || !ufValue || !municipioValue || !grauValue) {
    return res.status(400).json({
      error:
        'Os campos cliente_id, numero, uf, municipio e grau são obrigatórios',
    });
  }

  const tipoValue = normalizeString(tipo);
  const statusValue = normalizeString(status);
  const classeValue = normalizeString(classe_judicial);
  const assuntoValue = normalizeString(assunto);
  const jurisdicaoValue = normalizeString(jurisdicao);
  const advogadoValue = normalizeString(advogado_responsavel);
  const dataDistribuicaoValue = normalizeDate(data_distribuicao);
  const justicaGratuitaFlag = parseBooleanFlag(req.body?.justica_gratuita);
  const liminarFlag = parseBooleanFlag(req.body?.liminar);
  const permitePeticionarFlag = parseBooleanFlag(req.body?.permite_peticionar);
  const nivelSigiloValue = parseOptionalInteger(req.body?.nivel_sigilo);

  if (nivelSigiloValue !== null && nivelSigiloValue < 0) {
    return res.status(400).json({ error: 'nivel_sigilo inválido' });
  }

  const tramitacaoAtualValue = normalizeString(
    req.body?.tramitacao_atual ?? req.body?.tramitacaoatual,
  );
  const oportunidadeResolution = resolveNullablePositiveInteger(
    req.body?.oportunidade_id ?? req.body?.proposta_id ?? null,
  );

  if (!oportunidadeResolution.ok) {
    return res.status(400).json({ error: 'oportunidade_id inválido' });
  }

  const oportunidadeIdValue = oportunidadeResolution.value;
  const situacaoProcessoResolution = resolveNullablePositiveInteger(
    situacao_processo_id,
  );

  if (!situacaoProcessoResolution.ok) {
    return res.status(400).json({ error: 'situacao_processo_id inválido' });
  }

  let situacaoProcessoIdValue = situacaoProcessoResolution.value;

  const tipoProcessoResolution = resolveNullablePositiveInteger(
    tipo_processo_id,
  );

  if (!tipoProcessoResolution.ok) {
    return res.status(400).json({ error: 'tipo_processo_id inválido' });
  }

  let tipoProcessoIdValue = tipoProcessoResolution.value;

  const areaAtuacaoResolution = resolveNullablePositiveInteger(
    area_atuacao_id,
  );

  if (!areaAtuacaoResolution.ok) {
    return res.status(400).json({ error: 'area_atuacao_id inválido' });
  }

  const areaAtuacaoIdValue = areaAtuacaoResolution.value;

  const sistemaCnjResolution = resolveNullablePositiveInteger(sistema_cnj_id);

  if (!sistemaCnjResolution.ok) {
    return res.status(400).json({ error: 'sistema_cnj_id inválido' });
  }

  const sistemaCnjIdValue = sistemaCnjResolution.value;

  const envolvidosResolution = resolveNullablePositiveInteger(envolvidos_id);

  if (!envolvidosResolution.ok) {
    return res.status(400).json({ error: 'envolvidos_id inválido' });
  }

  const envolvidosIdValue = envolvidosResolution.value;

  const setorResolution = resolveNullablePositiveInteger(setor_id);

  if (!setorResolution.ok) {
    return res.status(400).json({ error: 'setor_id inválido' });
  }

  const setorIdValue = setorResolution.value;
  const instanciaValue = normalizeString(instancia);
  const descricaoValue = normalizeString(descricao);
  const monitorarProcessoFlag = parseBooleanFlag(monitorar_processo);
  let monitorarProcessoValue = monitorarProcessoFlag;
  const dataCitacaoValue = normalizeDate(data_citacao);
  const dataRecebimentoValue = normalizeDate(data_recebimento);
  const dataArquivamentoValue = normalizeDate(data_arquivamento);
  const dataEncerramentoValue = normalizeDate(data_encerramento);
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
      'SELECT monitorar_processo FROM public.processos WHERE id = $1 AND idempresa IS NOT DISTINCT FROM $2',
      [parsedId, empresaId]
    );

    if (existingProcess.rowCount === 0) {
      return res.status(404).json({ error: 'Processo não encontrado' });
    }

    if (monitorarProcessoValue === null) {
      monitorarProcessoValue =
        existingProcess.rows[0]?.monitorar_processo === true;
    }

    const clienteExists = await pool.query(
      'SELECT 1 FROM public.clientes WHERE id = $1 AND idempresa IS NOT DISTINCT FROM $2',
      [parsedClienteId, empresaId]
    );

    if (clienteExists.rowCount === 0) {
      return res.status(400).json({ error: 'Cliente não encontrado' });
    }

    if (tipoProcessoIdValue === null && tipoValue && empresaId !== null) {
      const tipoLookup = await pool.query(
        'SELECT id FROM public.tipo_processo WHERE idempresa IS NOT DISTINCT FROM $1 AND LOWER(nome) = LOWER($2) LIMIT 1',
        [empresaId, tipoValue],
      );

      if ((tipoLookup.rowCount ?? 0) > 0) {
        const resolvedId = parseOptionalInteger(tipoLookup.rows[0]?.id);
        if (resolvedId) {
          tipoProcessoIdValue = resolvedId;
        }
      }
    }

    if (situacaoProcessoIdValue === null && statusValue) {
      const situacaoLookup = await pool.query(
        'SELECT id FROM public.situacao_processo WHERE LOWER(nome) = LOWER($1) LIMIT 1',
        [statusValue],
      );

      if ((situacaoLookup.rowCount ?? 0) > 0) {
        const resolvedSituacaoId = parseOptionalInteger(
          situacaoLookup.rows[0]?.id,
        );
        if (resolvedSituacaoId) {
          situacaoProcessoIdValue = resolvedSituacaoId;
        }
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
    const finalMonitorarProcesso = monitorarProcessoValue ?? false;
    const finalPermitePeticionar = permitePeticionarFlag ?? true;

    const clientDb = await pool.connect();

    try {
      await clientDb.query('BEGIN');

      const updateResult = await clientDb.query(
        `UPDATE public.processos
            SET cliente_id = $1,
                numero_cnj = $2,
                uf = $3,
                municipio = $4,
                orgao_julgador = $5,
                situacao_processo_id = $6,
                classe_judicial = $7,
                assunto = $8,
                jurisdicao = $9,
                oportunidade_id = $10,
                advogado_responsavel = $11,
                data_distribuicao = $12,
                area_atuacao_id = $13,
                tipo_processo_id = $14,
                instancia = $15,
                sistema_cnj_id = $16,
                monitorar_processo = $17,
                envolvidos_id = $18,
                descricao = $19,
                setor_id = $20,
                data_citacao = $21,
                data_recebimento = $22,
                data_arquivamento = $23,
                data_encerramento = $24,
                grau = $25,
                justica_gratuita = $26,
                liminar = $27,
                nivel_sigilo = $28,
                tramitacaoatual = $29,
                permite_peticionar = $30,
                atualizado_em = NOW()
          WHERE id = $31
            AND idempresa IS NOT DISTINCT FROM $32
          RETURNING id`,
        [
          parsedClienteId,
          numeroValue,
          ufValue,
          municipioValue,
          orgaoValue,
          situacaoProcessoIdValue,
          classeValue,
          assuntoValue,
          jurisdicaoValue,
          oportunidadeIdValue,
          advogadoColumnValue,
          dataDistribuicaoValue,
          areaAtuacaoIdValue,
          tipoProcessoIdValue,
          instanciaValue,
          sistemaCnjIdValue,
          finalMonitorarProcesso,
          envolvidosIdValue,
          descricaoValue,
          setorIdValue,
          dataCitacaoValue,
          dataRecebimentoValue,
          dataArquivamentoValue,
          dataEncerramentoValue,
          grauValue,
          justicaGratuitaFlag,
          liminarFlag,
          nivelSigiloValue,
          tramitacaoAtualValue,
          finalPermitePeticionar,
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
