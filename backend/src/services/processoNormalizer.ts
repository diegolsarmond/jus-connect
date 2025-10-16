import { Processo, ProcessoAttachment, ProcessoParticipant } from '../models/processo';

export const normalizeString = (value: unknown): string | null => {
  const asString =
    typeof value === 'number' && Number.isFinite(value)
      ? String(value)
      : typeof value === 'string'
        ? value
        : null;

  if (asString === null) {
    return null;
  }

  const trimmed = asString.trim();
  return trimmed === '' ? null : trimmed;
};

export const normalizeUppercase = (value: unknown): string | null => {
  const normalized = normalizeString(value);
  return normalized ? normalized.toUpperCase() : null;
};

const stripDiacritics = (value: string): string =>
  value.normalize('NFD').replace(/\p{M}/gu, '');

export const normalizeParticipantSide = (
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

export const normalizeParticipantDocument = (
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

export const resolveDocumentKey = (document: string | null): string | null => {
  if (!document) {
    return null;
  }

  const digits = document.replace(/\D+/g, '');

  if (digits.length >= 5) {
    return digits;
  }

  return stripDiacritics(document).toLowerCase();
};

export const resolveNullablePositiveInteger = (
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

export const resolveNullableNonNegativeInteger = (
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

export const parseBooleanFlag = (value: unknown): boolean | null => {
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

export const parseDiasSemanaArray = (
  value: unknown,
): { ok: true; value: number[] | null } | { ok: false } => {
  if (value === undefined || value === null) {
    return { ok: true, value: null };
  }

  if (!Array.isArray(value)) {
    return { ok: false };
  }

  const set = new Set<number>();

  for (const item of value) {
    let parsed: number | null = null;

    if (typeof item === 'number' && Number.isInteger(item)) {
      parsed = item;
    } else if (typeof item === 'string') {
      const trimmed = item.trim();
      if (trimmed) {
        const candidate = Number.parseInt(trimmed, 10);
        if (Number.isInteger(candidate)) {
          parsed = candidate;
        }
      }
    }

    if (parsed == null || parsed < 1 || parsed > 7) {
      return { ok: false };
    }

    set.add(Math.trunc(parsed));
  }

  if (set.size === 0) {
    return { ok: false };
  }

  const normalized = Array.from(set).sort((a, b) => a - b);
  return { ok: true, value: normalized };
};

export const parsePositiveIntegerQuery = (value: unknown): number | null => {
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
};

export const parseNonNegativeIntegerQuery = (value: unknown): number | null => {
  if (typeof value === 'number' && Number.isInteger(value) && value >= 0) {
    return value;
  }

  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!trimmed) {
      return null;
    }

    const parsed = Number.parseInt(trimmed, 10);
    if (Number.isFinite(parsed) && parsed >= 0) {
      return parsed;
    }
  }

  return null;
};

export const normalizeDate = (value: unknown): string | null => {
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

export const normalizeTimestamp = (value: unknown): string | null => {
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

export const parseInteger = (value: unknown): number => {
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

export const parseOptionalInteger = (value: unknown): number | null => {
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
  oab?: string | null;
};

export const parseAdvogados = (value: unknown): Processo['advogados'] => {
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

    const oabValue = normalizeString(raw.oab);

    advogados.push({ id: parsedId, nome: nomeValue, oab: oabValue });
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
  descricao?: string | null;
  texto_categoria?: string | null;
  fonte?: Record<string, unknown> | null;
  sigiloso?: boolean | number | string | null;
  crawl_id?: string | null;
  data?: string | null;
  data_andamento?: string | null;
  data_movimentacao?: string | null;
  criado_em?: string | null;
  atualizado_em?: string | null;
  data_cadastro?: string | null;
};

export const parseMovimentacoes = (value: unknown): Processo['movimentacoes'] => {
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
      normalizeTimestamp(raw.data_andamento ?? raw.data ?? raw.data_movimentacao) ??
      raw.data ??
      raw.data_movimentacao ??
      null;

    const tipoValue = raw.tipo_andamento ?? raw.tipo ?? null;
    const numeroCnjValue = normalizeString(raw.numero_cnj);
    const instanciaProcessoValue =
      normalizeString(raw.instancia_processo) ??
      (typeof raw.instancia_processo === 'number' && Number.isFinite(raw.instancia_processo)
        ? String(Math.trunc(raw.instancia_processo))
        : null);
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
      conteudo: raw.conteudo ?? raw.descricao ?? null,
      texto_categoria: raw.texto_categoria ?? null,
      fonte: raw.fonte ?? null,
      criado_em:
        normalizeTimestamp(raw.criado_em ?? raw.data_cadastro) ??
        raw.criado_em ??
        raw.data_cadastro ??
        null,
      atualizado_em:
        normalizeTimestamp(raw.atualizado_em ?? raw.data_cadastro) ??
        raw.atualizado_em ??
        raw.data_cadastro ??
        null,
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
  sequencia_anexo?: unknown;
  nome?: unknown;
  tipo?: unknown;
  data_cadastro?: unknown;
  data_andamento?: unknown;
  instancia_processo?: unknown;
  crawl_id?: unknown;
  movimentacao_criado_em?: unknown;
  movimentacao_data_andamento?: unknown;
};

export const parseAttachments = (value: unknown): Processo['attachments'] => {
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
      id_andamento: normalizeIdentifier(raw.id_andamento ?? raw.sequencia_anexo),
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

export const mergeMovimentacoesWithAttachments = (
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

export const parseJsonColumn = (value: unknown): unknown => {
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

export const asPlainObject = (value: unknown): Record<string, unknown> | null => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return null;
  }

  return value as Record<string, unknown>;
};

export const pickTriggerValue = (
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

export const toArrayOrNull = (value: unknown): unknown[] | null => {
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

export const normalizeMixedCollection = (
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

export type PreparedMovimentacaoRecord = {
  data: string | null;
  tipo: string | null;
  tipo_publicacao: string | null;
  classificacao_predita: string | null;
  conteudo: string | null;
  texto_categoria: string | null;
  fonte: string | null;
};

export const prepareMovimentacaoRecord = (
  item: unknown,
): PreparedMovimentacaoRecord | null => {
  if (!item || typeof item !== 'object') {
    return null;
  }

  const raw = item as Record<string, unknown>;

  const dataValue = normalizeDate(raw.data) ?? normalizeString(raw.data);

  return {
    data: dataValue,
    tipo: normalizeString(raw.tipo),
    tipo_publicacao: normalizeString(raw.tipo_publicacao),
    classificacao_predita: safeJsonStringify(raw.classificacao_predita),
    conteudo: normalizeString(raw.conteudo),
    texto_categoria: normalizeString(raw.texto_categoria),
    fonte: safeJsonStringify(raw.fonte),
  };
};

export type RawCrawlerParticipant = {
  nome?: unknown;
  polo?: unknown;
  tipo_pessoa?: unknown;
  documento_principal?: unknown;
  tipo_documento_principal?: unknown;
  data_cadastro?: unknown;
  tipo_parte?: unknown;
};

export type RawOpportunityParticipant = {
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

export const mergeNamedCollections = <
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

export const mergeParticipantData = (
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

export const buildCrawlerParticipant = (
  row: RawCrawlerParticipant,
): ProcessoParticipant | null => {
  const name = normalizeString(row.nome);
  const documentInfo = normalizeParticipantDocument(row.documento_principal);

  if (!name && !documentInfo.display) {
    return null;
  }

  const participant: ProcessoParticipant = {
    name: name ?? null,
    document: documentInfo.display,
    document_type: normalizeUppercase(row.tipo_documento_principal),
    side: normalizeParticipantSide(row.polo),
    type: normalizeString(row.polo),
    person_type: normalizeUppercase(row.tipo_pessoa),
    role: normalizeString(row.tipo_parte),
    party_role: null,
    lawyers: null,
    representatives: null,
    registered_at: normalizeTimestamp(row.data_cadastro),
    source: 'crawler',
  };

  return participant;
};

export const buildOpportunityParticipant = (
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

export const mapProcessoRow = (row: any): Processo => {
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

export const sanitizeCpfDigits = (value: string | null | undefined): string | null => {
  if (!value) {
    return null;
  }

  const digits = value.replace(/\D+/g, '');

  if (digits.length !== 11) {
    return null;
  }

  if (/^(\d)\1{10}$/.test(digits)) {
    return null;
  }

  return digits;
};

