import { setTimeout as delay } from 'node:timers/promises';
import WahaConfigService, {
  ValidationError as ConfigValidationError,
} from './wahaConfigService';

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

const configService = new WahaConfigService();

const addRetryableRange = (set: Set<number>, start: number, end: number) => {
  for (let status = start; status <= end; status += 1) {
    set.add(status);
  }
};

addRetryableRange(RETRYABLE_STATUS, 500, 599);

const normalizeBaseUrl = (value: string) => value.replace(/\/+$/, '');

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

const buildContactUrl = (baseUrl: string, contactId: string) =>
  `${baseUrl}/api/v1/contacts/${encodeURIComponent(contactId)}`;

async function fetchAvatarFromContact(
  baseUrl: string,
  contactId: string,
  options: FetchOptions,
  logger: Logger,
): Promise<string | null> {
  try {
    const payload = await fetchJson(buildContactUrl(baseUrl, contactId), options, logger);
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
  let configError: ConfigValidationError | undefined;

  try {
    const config = await configService.requireConfig();
    baseUrl = config.baseUrl;
    token = config.apiKey;
  } catch (error) {
    if (error instanceof ConfigValidationError) {
      configError = error;
      logger.warn(`WAHA configuration warning: ${error.message}`);
    } else {
      throw error;
    }
  }

  if (!baseUrl) {
    const baseUrlEnv = process.env.WAHA_BASE_URL?.trim();
    if (baseUrlEnv) {
      baseUrl = normalizeBaseUrl(baseUrlEnv);
      token = token ?? process.env.WAHA_TOKEN?.trim();
    }
  }

  if (!baseUrl) {
    const message = configError?.message ?? 'WAHA_BASE_URL environment variable is not defined';
    const status = configError ? 503 : undefined;
    throw new WahaRequestError(message, status);
  }

  baseUrl = normalizeBaseUrl(baseUrl);

  const timeoutMs = readTimeoutFromEnv();
  const headers = buildHeaders(token);
  const fetchOptions: FetchOptions = { headers, timeoutMs };

  const payload = await fetchJson(`${baseUrl}/api/v1/chats`, fetchOptions, logger);
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
        photoUrl = await fetchAvatarFromContact(baseUrl, contactIdentifier, fetchOptions, logger);
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

