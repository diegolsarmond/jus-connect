import { URLSearchParams } from 'url';
import { QueryResultRow } from 'pg';
import pool from './db';

export class ProjudiConfigurationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ProjudiConfigurationError';
  }
}

export class ProjudiAuthenticationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ProjudiAuthenticationError';
  }
}

export class ProjudiRequestError extends Error {
  status?: number;
  responseBody?: unknown;

  constructor(message: string, status?: number, responseBody?: unknown) {
    super(message);
    this.name = 'ProjudiRequestError';
    this.status = status;
    this.responseBody = responseBody;
  }
}

export interface StoredProjudiIntimacao {
  id: number;
  origem: string;
  externalId: string;
  numeroProcesso: string | null;
  orgao: string | null;
  assunto: string | null;
  status: string | null;
  prazo: string | null;
  recebidaEm: string | null;
  fonteCriadaEm: string | null;
  fonteAtualizadaEm: string | null;
  payload: unknown;
  createdAt: string;
  updatedAt: string;
}

export interface StoredProjudiIntimacaoWithOperation extends StoredProjudiIntimacao {
  operation: 'inserted' | 'updated';
}

export interface FetchIntimacoesResult {
  source: 'projudi';
  startedAt: string;
  finishedAt: string;
  requestedFrom: string;
  totalFetched: number;
  totalProcessed: number;
  inserted: number;
  updated: number;
  latestSourceTimestamp: string | null;
  items: StoredProjudiIntimacaoWithOperation[];
}

type Queryable = {
  query: (
    text: string,
    params?: unknown[],
  ) => Promise<{ rows: QueryResultRow[]; rowCount: number }>;
};

interface FetchHeadersLike {
  get(name: string): string | null;
  [key: string]: unknown;
}

interface FetchResponseLike {
  ok: boolean;
  status: number;
  headers: FetchHeadersLike;
  text(): Promise<string>;
}

interface FetchRequestInitLike {
  method?: string;
  headers?: Record<string, string>;
  body?: string;
}

type FetchFunction = (input: string, init?: FetchRequestInitLike) => Promise<FetchResponseLike>;

interface AuthSession {
  token?: string;
  cookie?: string;
  expiresAt?: number;
  obtainedAt: number;
  raw?: unknown;
}

interface NormalizedProjudiIntimacao {
  externalId: string;
  numeroProcesso?: string | null;
  orgao?: string | null;
  assunto?: string | null;
  status?: string | null;
  prazo?: Date | null;
  recebidaEm?: Date | null;
  fonteCriadaEm?: Date | null;
  fonteAtualizadaEm?: Date | null;
  raw: unknown;
}

interface IntimacaoRow extends QueryResultRow {
  id: number;
  origem: string;
  external_id: string;
  numero_processo: string | null;
  orgao: string | null;
  assunto: string | null;
  status: string | null;
  prazo: string | Date | null;
  recebida_em: string | Date | null;
  fonte_criada_em: string | Date | null;
  fonte_atualizada_em: string | Date | null;
  payload: unknown;
  created_at: string | Date;
  updated_at: string | Date;
  inserted_row: boolean;
}

function ensureFetchImplementation(): FetchFunction {
  const globalFetch = (globalThis as { fetch?: (input: string, init?: unknown) => Promise<unknown> }).fetch;
  if (!globalFetch) {
    throw new Error(
      'Global fetch implementation not available. Provide a custom fetch implementation when instantiating ProjudiNotificationService.',
    );
  }

  return async (input: string, init?: FetchRequestInitLike) => {
    const response = (await globalFetch(input, init)) as FetchResponseLike;
    return response;
  };
}

function formatDate(value: string | Date): string {
  if (value instanceof Date) {
    return value.toISOString();
  }
  const parsed = new Date(value);
  return parsed.toISOString();
}

function formatNullableDate(value: string | Date | null): string | null {
  if (!value) {
    return null;
  }
  return formatDate(value);
}

function parseDate(value: unknown): Date | null {
  if (!value && value !== 0) {
    return null;
  }

  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value;
  }

  if (typeof value === 'number') {
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? null : date;
  }

  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!trimmed) {
      return null;
    }

    const normalized = trimmed.replace(/\//g, '-');
    const date = new Date(normalized);
    return Number.isNaN(date.getTime()) ? null : date;
  }

  return null;
}

function pickStringField(record: Record<string, unknown>, keys: string[]): string | undefined {
  for (const key of keys) {
    const value = record[key];
    if (typeof value === 'string') {
      const trimmed = value.trim();
      if (trimmed) {
        return trimmed;
      }
    }
    if (typeof value === 'number') {
      return String(value);
    }
  }

  return undefined;
}

function pickDateField(record: Record<string, unknown>, keys: string[]): Date | null | undefined {
  for (const key of keys) {
    const value = record[key];
    const parsed = parseDate(value);
    if (parsed) {
      return parsed;
    }
  }

  return undefined;
}

function extractArray(payload: unknown): unknown[] {
  if (Array.isArray(payload)) {
    return payload;
  }

  if (payload && typeof payload === 'object') {
    const container = payload as Record<string, unknown>;
    const keys = ['items', 'data', 'results', 'intimacoes', 'content'];
    for (const key of keys) {
      const candidate = container[key];
      if (Array.isArray(candidate)) {
        return candidate;
      }
    }
  }

  return [];
}

function extractToken(responseBody: unknown): string | undefined {
  if (!responseBody || typeof responseBody !== 'object') {
    return undefined;
  }

  const body = responseBody as Record<string, unknown>;
  const tokenKeys = ['token', 'accessToken', 'access_token', 'jwt', 'idToken', 'sessionId'];

  for (const key of tokenKeys) {
    const value = body[key];
    if (typeof value === 'string' && value.trim()) {
      return value.trim();
    }
  }

  return undefined;
}

function extractExpiresIn(responseBody: unknown): number | undefined {
  if (!responseBody || typeof responseBody !== 'object') {
    return undefined;
  }

  const body = responseBody as Record<string, unknown>;
  const expiresKeys = ['expires_in', 'expiresIn', 'ttl'];

  for (const key of expiresKeys) {
    const value = body[key];
    if (typeof value === 'number' && Number.isFinite(value)) {
      return value;
    }
    if (typeof value === 'string') {
      const parsed = Number.parseInt(value, 10);
      if (!Number.isNaN(parsed)) {
        return parsed;
      }
    }
  }

  return undefined;
}

function splitSetCookieHeader(rawHeader: string): string[] {
  return rawHeader
    .split(/,(?=[^;,]+=[^;,]+)/)
    .map((value) => value.trim())
    .filter(Boolean);
}

function extractCookies(headers: FetchHeadersLike): string[] {
  const anyHeaders = headers as unknown as {
    getSetCookie?: () => string[];
    raw?: () => Record<string, string[]>;
  };

  if (typeof anyHeaders.getSetCookie === 'function') {
    return anyHeaders.getSetCookie();
  }

  if (typeof anyHeaders.raw === 'function') {
    const raw = anyHeaders.raw();
    const values = raw['set-cookie'] ?? raw['Set-Cookie'];
    if (Array.isArray(values)) {
      return values;
    }
  }

  const header = headers.get('set-cookie');
  if (!header) {
    return [];
  }

  return splitSetCookieHeader(header);
}

function prepareCookiesForHeader(cookies: string[]): string[] {
  const result: string[] = [];
  for (const cookie of cookies) {
    const [nameValue] = cookie.split(';');
    if (nameValue) {
      const trimmed = nameValue.trim();
      if (trimmed) {
        result.push(trimmed);
      }
    }
  }
  return result;
}

function mapRow(row: IntimacaoRow): StoredProjudiIntimacao {
  return {
    id: row.id,
    origem: row.origem,
    externalId: row.external_id,
    numeroProcesso: row.numero_processo,
    orgao: row.orgao,
    assunto: row.assunto,
    status: row.status,
    prazo: formatNullableDate(row.prazo),
    recebidaEm: formatNullableDate(row.recebida_em),
    fonteCriadaEm: formatNullableDate(row.fonte_criada_em),
    fonteAtualizadaEm: formatNullableDate(row.fonte_atualizada_em),
    payload: row.payload ?? null,
    createdAt: formatDate(row.created_at),
    updatedAt: formatDate(row.updated_at),
  };
}

interface ProjudiNotificationServiceOptions {
  baseUrl?: string;
  username?: string;
  password?: string;
  loginPath?: string;
  intimacoesPath?: string;
  fetchImpl?: FetchFunction;
  db?: Queryable;
  sessionTtlMs?: number;
}

const DEFAULT_SESSION_TTL_MS = 30 * 60 * 1000; // 30 minutes

export class ProjudiNotificationService {
  private readonly baseUrl: string | null;
  private readonly username: string | null;
  private readonly password: string | null;
  private readonly loginPath: string;
  private readonly intimacoesPath: string;
  private readonly fetchImpl: FetchFunction;
  private readonly db: Queryable;
  private readonly sessionTtlMs: number;

  private session: AuthSession | null = null;
  private loginPromise: Promise<AuthSession> | null = null;

  constructor(options: ProjudiNotificationServiceOptions = {}) {
    this.baseUrl = normalizeBaseUrl(options.baseUrl ?? process.env.PROJUDI_BASE_URL ?? null);
    this.username = normalizeValue(options.username ?? process.env.PROJUDI_USER ?? null);
    this.password = normalizeValue(options.password ?? process.env.PROJUDI_PASSWORD ?? null);
    this.loginPath = (options.loginPath ?? process.env.PROJUDI_LOGIN_PATH ?? '/login').trim();
    this.intimacoesPath = (
      options.intimacoesPath ?? process.env.PROJUDI_INTIMACOES_PATH ?? '/intimacoes'
    ).trim();
    this.fetchImpl = options.fetchImpl ?? ensureFetchImplementation();
    this.db = options.db ?? pool;
    this.sessionTtlMs = options.sessionTtlMs ?? DEFAULT_SESSION_TTL_MS;
  }

  hasValidConfiguration(): boolean {
    return Boolean(this.baseUrl && this.username && this.password);
  }

  async login(force = false): Promise<AuthSession> {
    if (!this.hasValidConfiguration()) {
      throw new ProjudiConfigurationError(
        'Configuração do Projudi ausente. Defina PROJUDI_BASE_URL, PROJUDI_USER e PROJUDI_PASSWORD.',
      );
    }

    if (!force && this.session && this.isSessionValid(this.session)) {
      return this.session;
    }

    if (!force && this.loginPromise) {
      return this.loginPromise;
    }

    this.loginPromise = this.performLogin();
    try {
      const session = await this.loginPromise;
      this.session = session;
      return session;
    } finally {
      this.loginPromise = null;
    }
  }

  async fetchNewIntimacoes(lastCheck: Date): Promise<FetchIntimacoesResult> {
    if (!this.hasValidConfiguration()) {
      throw new ProjudiConfigurationError(
        'Configuração do Projudi ausente. Defina PROJUDI_BASE_URL, PROJUDI_USER e PROJUDI_PASSWORD.',
      );
    }

    const reference = normalizeReferenceDate(lastCheck);
    const startedAt = new Date();

    await this.login();

    const url = this.buildUrl(this.intimacoesPath);
    url.searchParams.set('updatedAfter', reference.toISOString());

    const headers: Record<string, string> = {
      Accept: 'application/json',
    };

    if (this.session?.token) {
      headers.Authorization = `Bearer ${this.session.token}`;
    }

    if (this.session?.cookie) {
      headers.Cookie = this.session.cookie;
    }

    const response = await this.fetchImpl(url.toString(), {
      method: 'GET',
      headers,
    });

    const rawBody = await safeReadResponseBody(response);

    if (!response.ok) {
      if (response.status === 401 || response.status === 403) {
        throw new ProjudiAuthenticationError('Falha ao autenticar na API do Projudi. Verifique as credenciais.');
      }

      throw new ProjudiRequestError(
        `Falha ao consultar intimações do Projudi (status ${response.status}).`,
        response.status,
        rawBody,
      );
    }

    const parsedBody = parseJson(rawBody);
    const items = extractArray(parsedBody);

    const normalizedItems: NormalizedProjudiIntimacao[] = [];
    let latestSourceDate: Date | null = null;

    for (const item of items) {
      const normalized = this.normalizeIntimacao(item);
      if (!normalized) {
        continue;
      }

      normalizedItems.push(normalized);

      const referenceDate =
        normalized.fonteAtualizadaEm
        ?? normalized.fonteCriadaEm
        ?? normalized.recebidaEm
        ?? normalized.prazo
        ?? null;

      if (referenceDate && (!latestSourceDate || referenceDate.getTime() > latestSourceDate.getTime())) {
        latestSourceDate = referenceDate;
      }
    }

    let inserted = 0;
    let updated = 0;
    const stored: StoredProjudiIntimacaoWithOperation[] = [];

    for (const item of normalizedItems) {
      const result = await this.db.query(
        `INSERT INTO intimacoes (
          origem,
          external_id,
          numero_processo,
          orgao,
          assunto,
          status,
          prazo,
          recebida_em,
          fonte_criada_em,
          fonte_atualizada_em,
          payload
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
        ON CONFLICT (origem, external_id)
        DO UPDATE SET
          numero_processo = COALESCE(EXCLUDED.numero_processo, intimacoes.numero_processo),
          orgao = COALESCE(EXCLUDED.orgao, intimacoes.orgao),
          assunto = COALESCE(EXCLUDED.assunto, intimacoes.assunto),
          status = COALESCE(EXCLUDED.status, intimacoes.status),
          prazo = COALESCE(EXCLUDED.prazo, intimacoes.prazo),
          recebida_em = COALESCE(EXCLUDED.recebida_em, intimacoes.recebida_em),
          fonte_criada_em = COALESCE(EXCLUDED.fonte_criada_em, intimacoes.fonte_criada_em),
          fonte_atualizada_em = COALESCE(EXCLUDED.fonte_atualizada_em, intimacoes.fonte_atualizada_em),
          payload = COALESCE(EXCLUDED.payload, intimacoes.payload),
          updated_at = NOW()
        RETURNING
          id,
          origem,
          external_id,
          numero_processo,
          orgao,
          assunto,
          status,
          prazo,
          recebida_em,
          fonte_criada_em,
          fonte_atualizada_em,
          payload,
          created_at,
          updated_at,
          (xmax = 0) AS inserted_row`,
        [
          'projudi',
          item.externalId,
          item.numeroProcesso ?? null,
          item.orgao ?? null,
          item.assunto ?? null,
          item.status ?? null,
          item.prazo ?? null,
          item.recebidaEm ?? null,
          item.fonteCriadaEm ?? null,
          item.fonteAtualizadaEm ?? null,
          item.raw ?? null,
        ],
      );

      const row = result.rows[0] as IntimacaoRow;
      const operation: 'inserted' | 'updated' = row.inserted_row ? 'inserted' : 'updated';
      if (operation === 'inserted') {
        inserted += 1;
      } else {
        updated += 1;
      }

      stored.push({ ...mapRow(row), operation });
    }

    const finishedAt = new Date();

    return {
      source: 'projudi',
      startedAt: startedAt.toISOString(),
      finishedAt: finishedAt.toISOString(),
      requestedFrom: reference.toISOString(),
      totalFetched: items.length,
      totalProcessed: stored.length,
      inserted,
      updated,
      latestSourceTimestamp: latestSourceDate ? latestSourceDate.toISOString() : null,
      items: stored,
    };
  }

  private isSessionValid(session: AuthSession): boolean {
    const now = Date.now();
    if (session.expiresAt && session.expiresAt - now > 60_000) {
      return true;
    }

    if (!session.expiresAt && now - session.obtainedAt < this.sessionTtlMs) {
      return true;
    }

    return false;
  }

  private async performLogin(): Promise<AuthSession> {
    const loginUrl = this.buildUrl(this.loginPath).toString();

    const attempts: Array<{ headers: Record<string, string>; body: string }> = [
      {
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify({
          username: this.username,
          password: this.password,
        }),
      },
      {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          Accept: 'application/json',
        },
        body: new URLSearchParams({
          username: this.username ?? '',
          password: this.password ?? '',
          usuario: this.username ?? '',
          senha: this.password ?? '',
        }).toString(),
      },
    ];

    let lastError: Error | undefined;

    for (const attempt of attempts) {
      try {
        const response = await this.fetchImpl(loginUrl, {
          method: 'POST',
          headers: attempt.headers,
          body: attempt.body,
        });

        const rawBody = await safeReadResponseBody(response);

        if (!response.ok) {
          if (response.status === 401 || response.status === 403) {
            throw new ProjudiAuthenticationError(
              'Credenciais inválidas ao autenticar no Projudi. Verifique usuário e senha configurados.',
            );
          }

          if (response.status >= 400 && response.status < 500) {
            lastError = new ProjudiRequestError(
              `Falha na autenticação do Projudi (status ${response.status}).`,
              response.status,
              rawBody,
            );
            continue;
          }

          throw new ProjudiRequestError(
            `Erro ao autenticar no Projudi (status ${response.status}).`,
            response.status,
            rawBody,
          );
        }

        const parsedBody = parseJson(rawBody);
        const token = extractToken(parsedBody);
        const cookies = extractCookies(response.headers);
        const cookieValues = prepareCookiesForHeader(cookies);
        const expiresIn = extractExpiresIn(parsedBody);

        if (!token && cookieValues.length === 0) {
          throw new ProjudiAuthenticationError(
            'Resposta de autenticação do Projudi não retornou token nem cookies de sessão.',
          );
        }

        const expiresAt = expiresIn ? Date.now() + expiresIn * 1000 : undefined;
        const cookieHeader = cookieValues.length > 0 ? cookieValues.join('; ') : undefined;

        return {
          token,
          cookie: cookieHeader,
          expiresAt,
          obtainedAt: Date.now(),
          raw: parsedBody ?? rawBody,
        };
      } catch (error) {
        if (error instanceof ProjudiAuthenticationError) {
          throw error;
        }
        lastError = error instanceof Error ? error : new Error(String(error));
      }
    }

    throw lastError ?? new ProjudiAuthenticationError('Não foi possível autenticar no Projudi.');
  }

  private normalizeIntimacao(item: unknown): NormalizedProjudiIntimacao | null {
    if (!item || typeof item !== 'object') {
      return null;
    }

    const record = item as Record<string, unknown>;

    const externalId =
      pickStringField(record, ['id', 'codigo', 'numero', 'numeroIntimacao', 'guid', 'chave'])
      ?? pickStringField(record, ['intimacaoId', 'idIntimacao', 'id_intimacao']);

    if (!externalId) {
      return null;
    }

    const numeroProcesso =
      pickStringField(record, ['numeroProcesso', 'processo', 'processNumber', 'processoNumero'])
      ?? null;
    const orgao = pickStringField(record, ['orgao', 'orgaoJulgador', 'vara', 'comarca']) ?? null;
    const assunto = pickStringField(record, ['assunto', 'descricao', 'descricaoIntimacao', 'detalhes']) ?? null;
    const status = pickStringField(record, ['status', 'situacao', 'situacaoIntimacao']) ?? null;
    const prazo = pickDateField(record, ['prazo', 'dataPrazo', 'prazoLimite', 'deadline']);
    const recebidaEm = pickDateField(record, ['recebidaEm', 'dataRecebimento', 'dataDisponibilizacao']);
    const fonteCriadaEm = pickDateField(record, ['criadoEm', 'dataCriacao', 'createdAt', 'dataEnvio']);
    const fonteAtualizadaEm = pickDateField(record, ['atualizadoEm', 'dataAtualizacao', 'updatedAt']);

    return {
      externalId,
      numeroProcesso: numeroProcesso ?? undefined,
      orgao: orgao ?? undefined,
      assunto: assunto ?? undefined,
      status: status ?? undefined,
      prazo: prazo ?? undefined,
      recebidaEm: recebidaEm ?? undefined,
      fonteCriadaEm: fonteCriadaEm ?? undefined,
      fonteAtualizadaEm: fonteAtualizadaEm ?? undefined,
      raw: item,
    };
  }

  private buildUrl(pathname: string): URL {
    if (!this.baseUrl) {
      throw new ProjudiConfigurationError('URL base do Projudi não configurada.');
    }

    const base = this.baseUrl.endsWith('/') ? this.baseUrl : `${this.baseUrl}/`;
    const cleanedPath = pathname.startsWith('/') ? pathname.slice(1) : pathname;
    return new URL(cleanedPath, base);
  }
}

function normalizeBaseUrl(value: string | null): string | null {
  if (!value) {
    return null;
  }
  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }
  return trimmed.replace(/\/$/, '');
}

function normalizeValue(value: string | null): string | null {
  if (!value) {
    return null;
  }
  const trimmed = value.trim();
  return trimmed || null;
}

function parseJson(body: string | null): unknown {
  if (!body) {
    return null;
  }

  try {
    return JSON.parse(body);
  } catch (error) {
    console.warn('[ProjudiNotificationService] Falha ao interpretar JSON da resposta.', error);
    return null;
  }
}

async function safeReadResponseBody(response: FetchResponseLike): Promise<string | null> {
  try {
    return await response.text();
  } catch (error) {
    console.warn('[ProjudiNotificationService] Falha ao ler corpo da resposta.', error);
    return null;
  }
}

function normalizeReferenceDate(date: Date): Date {
  if (date instanceof Date && !Number.isNaN(date.getTime())) {
    return date;
  }

  const now = new Date();
  now.setHours(now.getHours() - 24);
  return now;
}

export default new ProjudiNotificationService();
