"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.listWahaConversations = exports.WahaRequestError = void 0;
const promises_1 = require("node:timers/promises");
class WahaRequestError extends Error {
    constructor(message, status, responseBody) {
        super(message);
        this.status = status;
        this.responseBody = responseBody;
        this.name = 'WahaRequestError';
    }
}
exports.WahaRequestError = WahaRequestError;
const DEFAULT_TIMEOUT_MS = 15000;
const MAX_ATTEMPTS = 3;
const RETRYABLE_STATUS = new Set([429]);
const BASE_URL_SUFFIXES_TO_REMOVE = [
    /\/v\d+\/messages$/i,
    /\/v\d+$/i,
    /\/api\/send[a-z]+$/i,
    /\/api$/i,
];
let configModulePromise;
let cachedConfigService;
const isMissingDatabaseError = (error) => error instanceof Error &&
    error.message.includes('Database connection string not provided');
const loadConfigModule = async () => {
    if (!configModulePromise) {
        configModulePromise = Promise.resolve().then(() => __importStar(require('./wahaConfigService'))).then((module) => module)
            .catch((error) => {
            if (isMissingDatabaseError(error)) {
                return null;
            }
            throw error;
        });
    }
    return configModulePromise;
};
const getConfigDependencies = async () => {
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
    };
};
const addRetryableRange = (set, start, end) => {
    for (let status = start; status <= end; status += 1) {
        set.add(status);
    }
};
addRetryableRange(RETRYABLE_STATUS, 500, 599);
const stripKnownSuffixes = (pathname) => {
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
const tryParsePathname = (value) => {
    try {
        const parsed = new URL(value);
        return parsed.pathname ?? '';
    }
    catch {
        return '';
    }
};
const normalizeBaseUrl = (value) => {
    const trimmed = value.trim().replace(/\/+$/, '');
    try {
        const parsed = new URL(trimmed);
        parsed.pathname = stripKnownSuffixes(parsed.pathname ?? '');
        parsed.hash = '';
        return parsed.toString().replace(/\/+$/, '');
    }
    catch {
        return trimmed;
    }
};
const hasSessionPath = (baseUrl) => {
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
const isDatabaseConnectionError = (error) => !!error &&
    typeof error === 'object' &&
    'code' in error &&
    typeof error.code === 'string' &&
    DATABASE_CONNECTION_ERROR_CODES.has(error.code);
const looksLikeSessionScopedPath = (pathname) => {
    const segments = pathname
        .split('/')
        .map((segment) => segment.trim())
        .filter((segment) => segment.length > 0);
    if (segments.length < 2) {
        return false;
    }
    if (segments[0].toLowerCase() !== 'api') {
        return false;
    }
    const second = segments[1];
    return !/^v\d+$/i.test(second);
};
const buildChatEndpointCandidates = (baseUrl, sessionId) => {
    const normalized = baseUrl;
    const candidates = new Set();
    if (/\/chats$/i.test(normalized)) {
        candidates.add(normalized);
        return Array.from(candidates);
    }
    const hasSession = hasSessionPath(normalized);
    if (!hasSession) {
        if (sessionId) {
            const encodedSession = encodeURIComponent(sessionId);
            candidates.add(`${normalized}/api/${encodedSession}/chats`);
        }
        candidates.add(`${normalized}/api/v1/chats`);
        candidates.add(`${normalized}/api/chats`);
    }
    candidates.add(`${normalized}/chats`);
    return Array.from(candidates);
};
const SESSION_NOT_FOUND_PATTERN = /session\s+["']?[^"']+["']?\s+does\s+not\s+exist/i;
const extractResponseMessage = (body) => {
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
            const record = parsed;
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
    }
    catch {
        // Ignore JSON parsing errors and fall back to the raw string
    }
    return trimmed;
};
const isMissingSessionError = (error) => {
    if (error.status !== 422) {
        return false;

    }
    const message = extractResponseMessage(error.responseBody);
    return message ? SESSION_NOT_FOUND_PATTERN.test(message) : false;
};
const shouldFallbackToNextEndpoint = (error) => error instanceof WahaRequestError &&
    typeof error.status === 'number' &&
    ([404, 405].includes(error.status) || isMissingSessionError(error));

const fetchChatsPayload = async (baseUrl, options, logger, sessionId) => {
    const endpoints = buildChatEndpointCandidates(baseUrl, sessionId);
    let lastError;
    for (const endpoint of endpoints) {
        try {
            const payload = await fetchJson(endpoint, options, logger);
            return { payload, endpoint };
        }
        catch (error) {
            lastError = error;
            if (shouldFallbackToNextEndpoint(error)) {
                const status = error.status;
                logger.warn(`WAHA chats endpoint ${endpoint} returned status ${status}. Trying alternative path...`);
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
const toTrimmedString = (value) => {
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
const firstNonEmptyString = (...values) => {
    for (const value of values) {
        const normalized = toTrimmedString(value);
        if (normalized) {
            return normalized;
        }
    }
    return undefined;
};
const resolveConfiguredSessionId = () => firstNonEmptyString(process.env.WAHA_SESSION, process.env.WAHA_SESSION_ID, process.env.WAHA_DEFAULT_SESSION);
const buildHeaders = (token) => {
    const headers = {
        Accept: 'application/json',
    };
    if (token) {
        headers.Authorization = `Bearer ${token}`;
        headers['X-Api-Key'] = token;
    }
    return headers;
};
const readTimeoutFromEnv = () => {
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
async function fetchJson(url, options, logger) {
    let attempt = 0;
    let lastError;
    while (attempt < MAX_ATTEMPTS) {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), options.timeoutMs);
        try {
            const response = (await fetch(url, {
                headers: options.headers,
                signal: controller.signal,
            }));
            const bodyText = await response.text();
            if (!response.ok) {
                logger.error(`WAHA request failed (${response.status}): ${bodyText || '<empty>'}`);
                if (RETRYABLE_STATUS.has(response.status) && attempt + 1 < MAX_ATTEMPTS) {
                    attempt += 1;
                    await (0, promises_1.setTimeout)(2 ** attempt * 200);
                    continue;
                }
                throw new WahaRequestError(`WAHA request failed with status ${response.status}`, response.status, bodyText);
            }
            if (!bodyText) {
                return null;
            }
            try {
                return JSON.parse(bodyText);
            }
            catch (error) {
                logger.warn(`Failed to parse WAHA response as JSON: ${error.message}`);
                return bodyText;
            }
        }
        catch (error) {
            lastError = error;
            const isAbortError = error instanceof Error && error.name === 'AbortError';
            if (isAbortError) {
                logger.error(`WAHA request to ${url} timed out after ${options.timeoutMs}ms`);
            }
            else {
                logger.error(`WAHA request error on attempt ${attempt + 1}:`, error);
            }
            if (attempt + 1 >= MAX_ATTEMPTS) {
                if (error instanceof WahaRequestError) {
                    throw error;
                }
                throw new WahaRequestError(isAbortError
                    ? `WAHA request timed out after ${options.timeoutMs}ms`
                    : 'WAHA request failed');
            }
            attempt += 1;
            await (0, promises_1.setTimeout)(2 ** attempt * 200);
        }
        finally {
            clearTimeout(timer);
        }
    }
    if (lastError instanceof WahaRequestError) {
        throw lastError;
    }
    throw new WahaRequestError('WAHA request failed');
}
const extractChatArray = (payload) => {
    if (!payload) {
        return [];
    }
    if (Array.isArray(payload)) {
        return payload;
    }
    if (typeof payload === 'object' && payload !== null) {
        const record = payload;
        if (Array.isArray(record.chats)) {
            return record.chats;
        }
        if (record.data) {
            const data = record.data;
            if (Array.isArray(data)) {
                return data;
            }
            if (typeof data === 'object' && data !== null && Array.isArray(data.chats)) {
                return data.chats;
            }
        }
    }
    return [];
};
const ensureConversationId = (chat) => firstNonEmptyString(chat.id, chat.chatId, chat.conversationId, chat.jid, chat.chat_id, chat.key, chat.chat?.id);
const resolveContactName = (chat, fallbackId) => firstNonEmptyString(chat.name, chat.contactName, chat.pushName, chat.formattedName, chat.contact?.name, fallbackId) ?? fallbackId;
const resolveAvatar = (chat) => firstNonEmptyString(chat.avatar, chat.photoUrl, chat.photoURL, chat.profilePicUrl, chat.profilePicURL, chat.contact?.avatar, chat.contact?.profilePicUrl);
const resolveContactIdentifier = (chat, fallbackId) => firstNonEmptyString(chat.contactId, chat.contact_id, chat.contact?.id, fallbackId);
const buildContactUrl = (baseUrl, contactId, sessionId) => {
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
async function fetchAvatarFromContact(baseUrl, contactId, options, logger, sessionId) {
    try {
        const payload = await fetchJson(buildContactUrl(baseUrl, contactId, sessionId), options, logger);
        if (!payload || typeof payload !== 'object') {
            return null;
        }
        const record = payload;
        return (firstNonEmptyString(record.profilePicUrl, record.profilePicURL, record.avatar, record.photoUrl, record.photoURL) ?? null);
    }
    catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        logger.warn(`Unable to load avatar for ${contactId}: ${message}`);
        return null;
    }
}
const printTable = (rows, logger) => {
    logger.log('Conversas obtidas do WAHA:');
    if (rows.length === 0) {
        logger.log('Nenhuma conversa encontrada.');
        return;
    }
    const headers = ['conversation_id', 'contact_name', 'photo_url'];
    const columnWidths = headers.map((header) => Math.max(header.length, ...rows.map((row) => {
        const value = row[header];
        const asString = value === null || value === undefined ? '—' : String(value);
        return asString.length;
    })));
    const buildSeparator = () => `+${columnWidths.map((width) => '-'.repeat(width + 2)).join('+')}+`;
    const buildRow = (cells) => `| ${cells.map((cell, index) => cell.padEnd(columnWidths[index])).join(' | ')} |`;
    logger.log(buildSeparator());
    logger.log(buildRow(headers.map((header) => header
        .split('_')
        .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
        .join(' '))));
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
const listWahaConversations = async (logger = console) => {
    let baseUrl;
    let token;
    let configError;
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
            }
            catch (error) {
                if (error instanceof ConfigValidationError || isDatabaseConnectionError(error)) {
                    configError = error;
                    logger.warn(`WAHA configuration warning: ${error.message}`);
                }
                else {
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
    const sessionId = resolveConfiguredSessionId();
    const timeoutMs = readTimeoutFromEnv();
    const headers = buildHeaders(token);
    const fetchOptions = { headers, timeoutMs };
    const { payload } = await fetchChatsPayload(baseUrl, fetchOptions, logger, sessionId);
    const chats = extractChatArray(payload);
    const results = [];
    for (const item of chats) {
        if (!item || typeof item !== 'object') {
            continue;
        }
        const chat = item;
        const conversationId = ensureConversationId(chat);
        if (!conversationId) {
            continue;
        }
        const contactName = resolveContactName(chat, conversationId);
        let photoUrl = resolveAvatar(chat) ?? null;
        if (!photoUrl) {
            const contactIdentifier = resolveContactIdentifier(chat, conversationId);
            if (contactIdentifier) {
                photoUrl = await fetchAvatarFromContact(baseUrl, contactIdentifier, fetchOptions, logger, sessionId);
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
exports.listWahaConversations = listWahaConversations;
