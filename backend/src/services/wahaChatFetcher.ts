import { setTimeout as delay } from 'node:timers/promises';

export interface WahaConversationRow {
  conversation_id: string;
  contact_name: string;
  photo_url: string | null;
}

export class WahaRequestError extends Error {
  constructor(
    message: string,
    public readonly status?: number,
    public readonly responseBody?: string,
  ) {
    super(message);
    this.name = 'WahaRequestError';
  }
}

interface FetchOptions {
  headers: Record<string, string>;
  timeoutMs: number;
}

type Logger = Pick<Console, 'log' | 'error' | 'warn'>;

type MinimalFetchResponse = {
  ok: boolean;
  status: number;
  text(): Promise<string>;
};

const DEFAULT_TIMEOUT_MS = 15_000;
const MAX_ATTEMPTS = 3;
const RETRYABLE_STATUS = new Set([429]);

const BASE_URL_SUFFIXES_TO_REMOVE = [
  /\/v\d+\/messages$/i,
  /\/v\d+$/i,
  /\/api\/send[a-z]+$/i,
  /\/api$/i,
];

const DEFAULT_SESSION_FALLBACKS = Object.freeze(['default']);

type EndpointCandidate = {
  url: string;
  sessionId?: string;
};

type WahaConfigModule = typeof import('./wahaConfigService');
type WahaConfigServiceInstance = InstanceType<WahaConfigModule['default']>;
type ConfigValidationErrorConstructor = WahaConfigModule['ValidationError'];

let configModulePromise: Promise<WahaConfigModule | null> | undefined;
let cachedConfigService: WahaConfigServiceInstance | undefined;

const isMissingDatabaseError = (error: unknown): boolean =>
  error instanceof Error &&
  error.message.includes('Database connection string not provided');

const loadConfigModule = async (): Promise<WahaConfigModule | null> => {
  if (!configModulePromise) {
    configModulePromise = import('./wahaConfigService')
      .then((module) => module)
      .catch((error) => {
        if (isMissingDatabaseError(error)) {
          return null;
        }
        throw error;
      });
  }

  return configModulePromise;
};

const getConfigDependencies = async (): Promise<
  | {
      service: WahaConfigServiceInstance;
      ValidationError: ConfigValidationErrorConstructor;
    }
  | null
> => {
  const module = await loadConfigModule();

  if (!module) {
    return null;
  }

  if (!cachedConfigService) {
    cachedConfigService = new module.default();
  }

  return {
    service: cachedConfigService,
    ValidationError: module.ValidationError,
  } as const;
};

const addRetryableRange = (set: Set<number>, start: number, end: number) => {
  for (let status = start; status <= end; status += 1) {
    set.add(status);
  }
};

addRetryableRange(RETRYABLE_STATUS, 500, 599);

const stripKnownSuffixes = (pathname: string): string => {
  let result = pathname;
  let updated = true;

  while (updated) {
    updated = false;
    for (const suffix of BASE_URL_SUFFIXES_TO_REMOVE) {
      if (suffix.test(result)) {
        result = result.replace(suffix, '');
        updated = true;
      }
    }
  }

  return result.replace(/\/+$/, '');
};

const tryParsePathname = (value: string): string => {
  try {
    const parsed = new URL(value);
    return parsed.pathname ?? '';
  } catch {
    return '';
  }
};

const normalizeBaseUrl = (value: string): string => {
  const trimmed = value.trim().replace(/\/+$/, '');

  try {
    const parsed = new URL(trimmed);
    parsed.pathname = stripKnownSuffixes(parsed.pathname ?? '');
    parsed.hash = '';
    return parsed.toString().replace(/\/+$/, '');
  } catch {
    return trimmed;
  }
};

const hasSessionPath = (baseUrl: string): boolean => {
  const pathname = tryParsePathname(baseUrl);
  return looksLikeSessionScopedPath(pathname);
};

const DATABASE_CONNECTION_ERROR_CODES = new Set([
  'ECONNREFUSED',
  'ENOTFOUND',
  'EAI_AGAIN',
  'ECONNRESET',
  'ETIMEDOUT',
]);

const isDatabaseConnectionError = (error: unknown): error is NodeJS.ErrnoException =>
  !!error &&
  typeof error === 'object' &&
  'code' in error &&
  typeof (error as NodeJS.ErrnoException).code === 'string' &&
  DATABASE_CONNECTION_ERROR_CODES.has((error as NodeJS.ErrnoException).code as string);

const looksLikeSessionScopedPath = (pathname: string): boolean => {
  const segments = pathname
    .split('/')
    .map((segment) => segment.trim())
    .filter((segment) => segment.length > 0);

  if (segments.length < 2) {
    return false;
  }

  if (segments[0]!.toLowerCase() !== 'api') {
    return false;
  }

  const second = segments[1]!;
  return !/^v\d+$/i.test(second);
};

const extractSessionIdFromPathname = (pathname: string): string | undefined => {
  const segments = pathname
    .split('/')
    .map((segment) => segment.trim())
    .filter((segment) => segment.length > 0);

  if (segments.length < 2) {
    return undefined;
  }

  if (segments[0]!.toLowerCase() !== 'api') {
    return undefined;
  }

  const candidate = segments[1]!;

  if (/^v\d+$/i.test(candidate)) {
    return undefined;
  }

  try {
    return decodeURIComponent(candidate);
  } catch {
    return candidate;
  }
};

const buildChatEndpointCandidates = (
  baseUrl: string,
  sessionIds: readonly string[],
): EndpointCandidate[] => {
  const normalized = baseUrl;
  const seen = new Set<string>();
  const candidates: EndpointCandidate[] = [];

  const addCandidate = (url: string, sessionId?: string) => {
    if (seen.has(url)) {
      return;
    }
    seen.add(url);
    candidates.push({ url, sessionId });
  };

  if (/\/chats$/i.test(normalized)) {
    addCandidate(normalized, sessionIds[0]);
    return candidates;
  }

  const hasSession = hasSessionPath(normalized);
  const sessionFromBase = extractSessionIdFromPathname(tryParsePathname(normalized));

  if (!hasSession) {
    for (const sessionId of sessionIds) {
      const trimmed = toTrimmedString(sessionId);
      if (!trimmed) {
        continue;
      }
      const encodedSession = encodeURIComponent(trimmed);
      addCandidate(`${normalized}/api/${encodedSession}/chats`, trimmed);
    }
    addCandidate(`${normalized}/api/v1/chats`);
    addCandidate(`${normalized}/api/chats`);
  }

  addCandidate(`${normalized}/chats`, hasSession ? sessionFromBase : toTrimmedString(sessionIds[0]));

  return candidates;
};

const SESSION_NOT_FOUND_PATTERN = /session\s+["']?[^"']+["']?\s+does\s+not\s+exist/i;

const extractResponseMessage = (body: string | undefined): string | undefined => {
  if (!body) {
    return undefined;
  }

  const trimmed = body.trim();
  if (!trimmed) {
    return undefined;
  }

  try {
    const parsed = JSON.parse(trimmed);
    if (typeof parsed === 'string') {
      return parsed.trim() || undefined;
    }
    if (parsed && typeof parsed === 'object') {
      const record = parsed as Record<string, unknown>;
      for (const key of ['error', 'message', 'detail']) {
        const value = record[key];
        if (typeof value === 'string') {
          const normalized = value.trim();
          if (normalized) {
            return normalized;
          }
        }
      }
    }
  } catch {
    // Ignore JSON parsing errors and fall back to the raw string
  }

  return trimmed;
};

const isMissingSessionError = (error: WahaRequestError): boolean => {
  if (error.status !== 422) {
    return false;
  }

  const message = extractResponseMessage(error.responseBody);
  return message ? SESSION_NOT_FOUND_PATTERN.test(message) : false;
};

const shouldFallbackToNextEndpoint = (error: unknown): boolean =>
  error instanceof WahaRequestError &&
  typeof error.status === 'number' &&
  ([404, 405].includes(error.status) || isMissingSessionError(error));

const fetchChatsPayload = async (
  baseUrl: string,
  options: FetchOptions,
  logger: Logger,
  sessionIds: readonly string[],
): Promise<{ payload: unknown; endpoint: string; sessionId?: string }> => {
  const endpoints = buildChatEndpointCandidates(baseUrl, sessionIds);
  let lastError: unknown;

  for (const candidate of endpoints) {
    const { url, sessionId } = candidate;
    try {
      const payload = await fetchJson(url, options, logger);
      return { payload, endpoint: url, sessionId };
    } catch (error) {
      lastError = error;
      if (shouldFallbackToNextEndpoint(error)) {
        const status = (error as WahaRequestError).status;
        logger.warn(
          `WAHA chats endpoint ${url} returned status ${status}. Trying alternative path...`,
        );
        continue;
      }

      throw error;
    }
  }

  if (lastError instanceof WahaRequestError) {
    throw lastError;
  }

  throw new WahaRequestError('WAHA request failed');
};

const toTrimmedString = (value: unknown): string | undefined => {
  if (typeof value === 'string') {
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : undefined;
  }
  if (typeof value === 'number' && Number.isFinite(value)) {
    return String(value);
  }
  if (typeof value === 'boolean') {
    return value ? 'true' : 'false';
  }
  return undefined;
};

const firstNonEmptyString = (...values: unknown[]): string | undefined => {
  for (const value of values) {
    const normalized = toTrimmedString(value);
    if (normalized) {
      return normalized;
    }
  }
  return undefined;
};

const resolveConfiguredSessionId = (): string | undefined =>
  firstNonEmptyString(
    process.env.WAHA_SESSION,
    process.env.WAHA_SESSION_ID,
    process.env.WAHA_DEFAULT_SESSION,
  );

const buildSessionCandidateList = (baseUrl: string): string[] => {
  const sessionIds: string[] = [];
  const seen = new Set<string>();

  const add = (value: string | undefined) => {
    const normalized = toTrimmedString(value);
    if (!normalized || seen.has(normalized)) {
      return;
    }
    seen.add(normalized);
    sessionIds.push(normalized);
  };

  add(resolveConfiguredSessionId());
  add(extractSessionIdFromPathname(tryParsePathname(baseUrl)));
  for (const fallback of DEFAULT_SESSION_FALLBACKS) {
    add(fallback);
  }

  return sessionIds;
};

const buildHeaders = (token: string | undefined): Record<string, string> => {
  const headers: Record<string, string> = {
    Accept: 'application/json',
  };
  if (token) {
    headers.Authorization = `Bearer ${token}`;
    headers['X-Api-Key'] = token;
  }
  return headers;
};

const readTimeoutFromEnv = (): number => {
  const raw = process.env.WAHA_TIMEOUT_MS;
  if (!raw) {
    return DEFAULT_TIMEOUT_MS;
  }
  const parsed = Number.parseInt(raw, 10);
  if (Number.isNaN(parsed) || parsed <= 0) {
    return DEFAULT_TIMEOUT_MS;
  }
  return parsed;
};

async function fetchJson(url: string, options: FetchOptions, logger: Logger): Promise<unknown> {
  let attempt = 0;
  let lastError: unknown;

  while (attempt < MAX_ATTEMPTS) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), options.timeoutMs);

    try {
      const response = (await fetch(url, {
        headers: options.headers,
        signal: controller.signal,
      })) as unknown as MinimalFetchResponse;
      const bodyText = await response.text();

      if (!response.ok) {
        logger.error(`WAHA request failed (${response.status}): ${bodyText || '<empty>'}`);

        if (RETRYABLE_STATUS.has(response.status) && attempt + 1 < MAX_ATTEMPTS) {
          attempt += 1;
          await delay(2 ** attempt * 200);
          continue;
        }

        throw new WahaRequestError(
          `WAHA request failed with status ${response.status}`,
          response.status,
          bodyText,
        );
      }

      if (!bodyText) {
        return null;
      }

      try {
        return JSON.parse(bodyText);
      } catch (error) {
        logger.warn(`Failed to parse WAHA response as JSON: ${(error as Error).message}`);
        return bodyText;
      }
    } catch (error) {
      lastError = error;
      const isAbortError = error instanceof Error && error.name === 'AbortError';

      if (isAbortError) {
        logger.error(`WAHA request to ${url} timed out after ${options.timeoutMs}ms`);
      } else {
        logger.error(`WAHA request error on attempt ${attempt + 1}:`, error);
      }

      if (attempt + 1 >= MAX_ATTEMPTS) {
        if (error instanceof WahaRequestError) {
          throw error;
        }
        throw new WahaRequestError(
          isAbortError
            ? `WAHA request timed out after ${options.timeoutMs}ms`
            : 'WAHA request failed',
        );
      }

      attempt += 1;
      await delay(2 ** attempt * 200);
    } finally {
      clearTimeout(timer);
    }
  }

  if (lastError instanceof WahaRequestError) {
    throw lastError;
  }

  throw new WahaRequestError('WAHA request failed');
}

const extractChatArray = (payload: unknown): unknown[] => {
  if (!payload) {
    return [];
  }
  if (Array.isArray(payload)) {
    return payload;
  }
  if (typeof payload === 'object' && payload !== null) {
    const record = payload as Record<string, unknown>;
    if (Array.isArray(record.chats)) {
      return record.chats;
    }
    if (record.data) {
      const data = record.data as unknown;
      if (Array.isArray(data)) {
        return data;
      }
      if (typeof data === 'object' && data !== null && Array.isArray((data as Record<string, unknown>).chats)) {
        return (data as Record<string, unknown>).chats as unknown[];
      }
    }
  }
  return [];
};

const ensureConversationId = (chat: Record<string, unknown>): string | undefined =>
  firstNonEmptyString(
    chat.id,
    chat.chatId,
    chat.conversationId,
    chat.jid,
    chat.chat_id,
    chat.key,
    (chat.chat as Record<string, unknown> | undefined)?.id,
  );

const resolveContactName = (chat: Record<string, unknown>, fallbackId: string): string =>
  firstNonEmptyString(
    chat.name,
    chat.contactName,
    chat.pushName,
    chat.formattedName,
    (chat.contact as Record<string, unknown> | undefined)?.name,
    fallbackId,
  ) ?? fallbackId;

const resolveAvatar = (chat: Record<string, unknown>): string | undefined =>
  firstNonEmptyString(
    chat.avatar,
    chat.photoUrl,
    chat.photoURL,
    chat.profilePicUrl,
    chat.profilePicURL,
    (chat.contact as Record<string, unknown> | undefined)?.avatar,
    (chat.contact as Record<string, unknown> | undefined)?.profilePicUrl,
  );

const resolveContactIdentifier = (chat: Record<string, unknown>, fallbackId: string): string | undefined =>
  firstNonEmptyString(
    chat.contactId,
    chat.contact_id,
    (chat.contact as Record<string, unknown> | undefined)?.id,
    fallbackId,
  );

const buildContactUrl = (baseUrl: string, contactId: string, sessionId: string | undefined) => {
  const encodedContact = encodeURIComponent(contactId);

  if (hasSessionPath(baseUrl)) {
    return `${baseUrl}/contacts/${encodedContact}`;
  }

  if (sessionId) {
    const encodedSession = encodeURIComponent(sessionId);
    return `${baseUrl}/api/${encodedSession}/contacts/${encodedContact}`;
  }

  return `${baseUrl}/api/v1/contacts/${encodedContact}`;
};

async function fetchAvatarFromContact(
  baseUrl: string,
  contactId: string,
  options: FetchOptions,
  logger: Logger,
  sessionId: string | undefined,
): Promise<string | null> {
  try {
    const payload = await fetchJson(buildContactUrl(baseUrl, contactId, sessionId), options, logger);
    if (!payload || typeof payload !== 'object') {
      return null;
    }
    const record = payload as Record<string, unknown>;
    return (
      firstNonEmptyString(
        record.profilePicUrl,
        record.profilePicURL,
        record.avatar,
        record.photoUrl,
        record.photoURL,
      ) ?? null
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    logger.warn(`Unable to load avatar for ${contactId}: ${message}`);
    return null;
  }
}

const printTable = (rows: WahaConversationRow[], logger: Logger) => {
  logger.log('Conversas obtidas do WAHA:');
  if (rows.length === 0) {
    logger.log('Nenhuma conversa encontrada.');
    return;
  }

  const headers: Array<keyof WahaConversationRow> = ['conversation_id', 'contact_name', 'photo_url'];
  const columnWidths = headers.map((header) =>
    Math.max(
      header.length,
      ...rows.map((row) => {
        const value = row[header];
        const asString = value === null || value === undefined ? '—' : String(value);
        return asString.length;
      }),
    ),
  );

  const buildSeparator = () => `+${columnWidths.map((width) => '-'.repeat(width + 2)).join('+')}+`;
  const buildRow = (cells: string[]) =>
    `| ${cells.map((cell, index) => cell.padEnd(columnWidths[index]!)).join(' | ')} |`;

  logger.log(buildSeparator());
  logger.log(
    buildRow(
      headers.map((header) =>
        header
          .split('_')
          .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
          .join(' '),
      ),
    ),
  );
  logger.log(buildSeparator());

  for (const row of rows) {
    const cells = headers.map((header) => {
      const value = row[header];
      return value === null || value === undefined ? '—' : String(value);
    });
    logger.log(buildRow(cells));
  }

  logger.log(buildSeparator());
};

export const listWahaConversations = async (logger: Logger = console): Promise<WahaConversationRow[]> => {
  let baseUrl: string | undefined;
  let token: string | undefined;
  let configError: Error | undefined;

  const baseUrlEnv = process.env.WAHA_BASE_URL?.trim();
  if (baseUrlEnv) {
    baseUrl = baseUrlEnv;
    token = process.env.WAHA_TOKEN?.trim();
  }

  if (!baseUrl || !token) {
    const configDependencies = await getConfigDependencies();

    if (configDependencies) {
      const { service, ValidationError: ConfigValidationError } = configDependencies;

      try {
        const config = await service.requireConfig();
        if (!baseUrl) {
          baseUrl = config.baseUrl;
        }
        if (!token) {
          token = config.apiKey;
        }
      } catch (error) {
        if (error instanceof ConfigValidationError || isDatabaseConnectionError(error)) {
          configError = error as Error;
          logger.warn(`WAHA configuration warning: ${error.message}`);
        } else {
          throw error;
        }
      }
    }
  }

  if (!baseUrl) {
    const message = configError?.message ?? 'WAHA_BASE_URL environment variable is not defined';
    const status = configError ? 503 : undefined;
    throw new WahaRequestError(message, status);
  }

  baseUrl = normalizeBaseUrl(baseUrl);
  const sessionIds = buildSessionCandidateList(baseUrl);

  const timeoutMs = readTimeoutFromEnv();
  const headers = buildHeaders(token);
  const fetchOptions: FetchOptions = { headers, timeoutMs };

  const { payload, sessionId } = await fetchChatsPayload(
    baseUrl,
    fetchOptions,
    logger,
    sessionIds,
  );
  const chats = extractChatArray(payload);

  const results: WahaConversationRow[] = [];

  for (const item of chats) {
    if (!item || typeof item !== 'object') {
      continue;
    }
    const chat = item as Record<string, unknown>;
    const conversationId = ensureConversationId(chat);
    if (!conversationId) {
      continue;
    }

    const contactName = resolveContactName(chat, conversationId);
    let photoUrl = resolveAvatar(chat) ?? null;

    if (!photoUrl) {
      const contactIdentifier = resolveContactIdentifier(chat, conversationId);
      if (contactIdentifier) {
        photoUrl = await fetchAvatarFromContact(
          baseUrl,
          contactIdentifier,
          fetchOptions,
          logger,
          sessionId,
        );
      }
    }

    results.push({
      conversation_id: conversationId,
      contact_name: contactName,
      photo_url: photoUrl,
    });
  }

  printTable(results, logger);

  return results;
};

