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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.WebhookAuthorizationError = exports.IntegrationNotConfiguredError = void 0;
const http_1 = __importDefault(require("http"));
const https_1 = __importDefault(require("https"));
const url_1 = require("url");
const chatService_1 = __importStar(require("./chatService"));
const wahaConfigService_1 = __importStar(require("./wahaConfigService"));
class IntegrationNotConfiguredError extends Error {
    constructor(message = 'WAHA integration is not configured') {
        super(message);
        this.name = 'IntegrationNotConfiguredError';
    }
}
exports.IntegrationNotConfiguredError = IntegrationNotConfiguredError;
class WebhookAuthorizationError extends Error {
    constructor(message = 'Invalid webhook signature') {
        super(message);
        this.name = 'WebhookAuthorizationError';
    }
}
exports.WebhookAuthorizationError = WebhookAuthorizationError;
class HttpClient {
    constructor(defaultTimeout = 10000) {
        this.defaultTimeout = defaultTimeout;
    }
    async postJson(url, body, headers) {
        const combinedHeaders = { 'Content-Type': 'application/json', ...headers };
        return this.request(url, { method: 'POST', headers: combinedHeaders, body });
    }
    async request(url, options = {}) {
        const parsedUrl = new url_1.URL(url);
        const isHttps = parsedUrl.protocol === 'https:';
        const transport = isHttps ? https_1.default : http_1.default;
        const headers = options.headers ? { ...options.headers } : {};
        const method = options.method ?? 'GET';
        const timeoutMs = options.timeoutMs ?? this.defaultTimeout;
        let payload;
        if (options.body !== undefined) {
            payload = typeof options.body === 'string' ? options.body : JSON.stringify(options.body);
            headers['Content-Length'] = Buffer.byteLength(payload).toString();
        }
        const requestOptions = {
            method,
            headers,
        };
        return new Promise((resolve, reject) => {
            const req = transport.request(parsedUrl, requestOptions, (res) => {
                const chunks = [];
                res.on('data', (chunk) => {
                    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
                });
                res.on('end', () => {
                    const raw = Buffer.concat(chunks).toString();
                    const contentType = res.headers['content-type'] ?? '';
                    let data = raw;
                    if (raw && typeof raw === 'string' && /json/i.test(String(contentType))) {
                        try {
                            data = JSON.parse(raw);
                        }
                        catch (error) {
                            data = raw;
                        }
                    }
                    resolve({
                        status: res.statusCode ?? 0,
                        headers: res.headers,
                        data: data,
                    });
                });
            });
            req.on('error', (error) => reject(error));
            req.setTimeout(timeoutMs, () => {
                req.destroy(new Error(`Request timed out after ${timeoutMs}ms`));
            });
            if (payload) {
                req.write(payload);
            }
            req.end();
        });
    }
}
function firstNonEmpty(...values) {
    for (const value of values) {
        if (typeof value === 'string') {
            const trimmed = value.trim();
            if (trimmed) {
                return trimmed;
            }
            continue;
        }
        if (typeof value === 'number' && !Number.isNaN(value)) {
            return value;
        }
        if (value instanceof Date) {
            return value;
        }
    }
    return undefined;
}
function toArray(value) {
    if (!value) {
        return [];
    }
    if (Array.isArray(value)) {
        return value;
    }
    return [value];
}
function normalizeTimestamp(value) {
    if (value instanceof Date) {
        return value;
    }
    if (typeof value === 'number') {
        if (value > 1e12) {
            return new Date(value);
        }
        return new Date(value * 1000);
    }
    if (typeof value === 'string') {
        const trimmed = value.trim();
        if (!trimmed) {
            return new Date();
        }
        const numeric = Number(trimmed);
        if (!Number.isNaN(numeric)) {
            return normalizeTimestamp(numeric);
        }
        const parsed = new Date(trimmed);
        if (!Number.isNaN(parsed.getTime())) {
            return parsed;
        }
    }
    return new Date();
}
function normalizeMessageType(value, hasImageAttachment) {
    if (value === 'image' || value === 'IMAGE') {
        return 'image';
    }
    return hasImageAttachment ? 'image' : 'text';
}
function normalizeStatus(value) {
    if (typeof value === 'string') {
        const normalized = value.trim().toLowerCase();
        if (['read', 'seen', 'viewed'].includes(normalized)) {
            return 'read';
        }
        if (['delivered', 'arrived', 'received'].includes(normalized)) {
            return 'delivered';
        }
        return 'sent';
    }
    if (typeof value === 'number') {
        if (value >= 3) {
            return 'read';
        }
        if (value >= 2) {
            return 'delivered';
        }
        return 'sent';
    }
    return 'sent';
}
function collectAttachments(candidate, _type) {
    const attachments = [];
    const attachmentArray = toArray(candidate.attachments);
    for (const item of attachmentArray) {
        if (!item || typeof item !== 'object') {
            continue;
        }
        const urlCandidate = firstNonEmpty(item.url, item.link, item.href);
        if (!urlCandidate) {
            continue;
        }
        const nameCandidate = firstNonEmpty(item.name, item.filename, 'Arquivo');
        attachments.push({
            id: String(firstNonEmpty(item.id, `att-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`)),
            type: 'image',
            url: String(urlCandidate),
            name: String(nameCandidate),
        });
    }
    if (attachments.length > 0) {
        return attachments;
    }
    const directImageUrl = firstNonEmpty(candidate.imageUrl, candidate.mediaUrl, candidate.media?.url, candidate.image?.url, candidate.message?.imageMessage?.url, candidate._data?.mediaUrl);
    if (directImageUrl) {
        attachments.push({
            id: String(firstNonEmpty(candidate.id, `att-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`)),
            type: 'image',
            url: String(directImageUrl),
            name: String(firstNonEmpty(candidate.fileName, candidate.file_name, 'Imagem')),
        });
    }
    return attachments.length > 0 ? attachments : undefined;
}
function parseIncomingMessage(candidate) {
    if (!candidate || typeof candidate !== 'object') {
        return null;
    }
    const fromMe = firstNonEmpty(candidate.fromMe, candidate.from_me, candidate.isFromMe, candidate.key?.fromMe);
    if (fromMe === true || fromMe === 'true') {
        return null;
    }
    const conversationIdCandidate = firstNonEmpty(candidate.conversationId, candidate.chatId, candidate.chat?.id, candidate.chat?.jid, candidate.from, candidate.remoteJid, candidate.author, candidate.key?.remoteJid, candidate._data?.from);
    if (!conversationIdCandidate) {
        return null;
    }
    const messageIdCandidate = firstNonEmpty(candidate.id, candidate.messageId, candidate._id, candidate.key?.id, candidate.message?.key?.id);
    const externalIdCandidate = firstNonEmpty(candidate.externalId, candidate.key?.id, candidate.messageId, candidate.id);
    if (!messageIdCandidate && !externalIdCandidate) {
        return null;
    }
    const timestampCandidate = firstNonEmpty(candidate.timestamp, candidate.ts, candidate.sentAt, candidate.messageTimestamp, candidate._data?.t);
    const timestamp = normalizeTimestamp(timestampCandidate);
    const contentCandidate = firstNonEmpty(typeof candidate.text === 'object' ? candidate.text?.body : candidate.text, candidate.body, candidate.message?.conversation, candidate.message?.text, candidate.message?.extendedTextMessage?.text, candidate._data?.body);
    const rawContent = typeof contentCandidate === 'string' ? contentCandidate.trim() : '';
    const typeCandidate = firstNonEmpty(candidate.type, candidate.message?.type, candidate._data?.type);
    const attachments = collectAttachments(candidate, normalizeMessageType(typeCandidate, false));
    const type = normalizeMessageType(typeCandidate, Boolean(attachments && attachments.length > 0));
    const senderNameCandidate = firstNonEmpty(candidate.senderName, candidate.sender?.name, candidate.chat?.name, candidate.pushName, candidate.notifyName);
    const content = rawContent || (attachments && attachments.length > 0 ? 'Arquivo recebido' : 'Mensagem recebida');
    return {
        conversationId: String(conversationIdCandidate),
        messageId: String(messageIdCandidate ?? externalIdCandidate ?? `waha-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`),
        externalId: externalIdCandidate ? String(externalIdCandidate) : undefined,
        content,
        timestamp,
        type,
        senderName: senderNameCandidate ? String(senderNameCandidate) : undefined,
        attachments,
    };
}
function collectMessageCandidates(payload) {
    const results = [];
    if (!payload) {
        return results;
    }
    const push = (value) => {
        if (value && typeof value === 'object') {
            results.push(value);
        }
    };
    for (const item of toArray(payload.messages)) {
        push(item);
    }
    if (payload.message) {
        push(payload.message);
    }
    if (payload.data) {
        if (Array.isArray(payload.data)) {
            for (const item of payload.data) {
                for (const message of toArray(item?.messages)) {
                    push(message);
                }
            }
        }
        else {
            for (const message of toArray(payload.data.messages)) {
                push(message);
            }
        }
    }
    if (payload.event === 'message' && payload.data) {
        push(payload.data);
    }
    for (const entry of toArray(payload.entry)) {
        for (const change of toArray(entry?.changes)) {
            for (const message of toArray(change?.value?.messages)) {
                push(message);
            }
        }
    }
    return results;
}
function normalizeWebhookMessages(payload) {
    const candidates = collectMessageCandidates(payload);
    const normalized = [];
    for (const candidate of candidates) {
        const parsed = parseIncomingMessage(candidate);
        if (parsed) {
            normalized.push(parsed);
        }
    }
    return normalized;
}
function collectStatusCandidates(payload) {
    const results = [];
    if (!payload) {
        return results;
    }
    const push = (value) => {
        if (value && typeof value === 'object') {
            results.push(value);
        }
    };
    for (const status of toArray(payload.statuses)) {
        push(status);
    }
    if (payload.data) {
        if (Array.isArray(payload.data)) {
            for (const item of payload.data) {
                for (const status of toArray(item?.statuses)) {
                    push(status);
                }
            }
        }
        else {
            for (const status of toArray(payload.data.statuses)) {
                push(status);
            }
        }
    }
    if (payload.event === 'status' && payload.data) {
        push(payload.data);
    }
    for (const entry of toArray(payload.entry)) {
        for (const change of toArray(entry?.changes)) {
            for (const status of toArray(change?.value?.statuses)) {
                push(status);
            }
        }
    }
    return results;
}
function normalizeStatusUpdates(payload) {
    const candidates = collectStatusCandidates(payload);
    const updates = [];
    for (const candidate of candidates) {
        if (!candidate || typeof candidate !== 'object') {
            continue;
        }
        const externalIdCandidate = firstNonEmpty(candidate.id, candidate.messageId, candidate.message_id, candidate.key?.id, candidate.status?.id);
        if (!externalIdCandidate) {
            continue;
        }
        const statusCandidate = firstNonEmpty(candidate.status, candidate.state, candidate.ack, candidate.deliveryStatus);
        updates.push({
            externalId: String(externalIdCandidate),
            status: normalizeStatus(statusCandidate),
        });
    }
    return updates;
}
function resolveChatId(conversation) {
    const metadataChatId = (conversation.metadata?.chatId ?? conversation.metadata?.chat_id ?? conversation.metadata?.id);
    if (metadataChatId && metadataChatId.trim()) {
        return metadataChatId.trim();
    }
    return conversation.contactIdentifier || conversation.id;
}
function resolveMessagesEndpoint(baseUrl) {
    const normalized = baseUrl.replace(/\/$/, '');
    if (normalized.toLowerCase().endsWith('/v1/messages')) {
        return normalized;
    }
    if (normalized.toLowerCase().endsWith('/v1')) {
        return `${normalized}/messages`;
    }
    return `${normalized}/v1/messages`;
}
function buildSendPayload(chatId, payload) {
    const type = payload.type ?? 'text';
    const messagePayload = {
        type,
        text: payload.content,
    };
    if (type === 'image') {
        const attachment = payload.attachments?.[0];
        if (attachment) {
            messagePayload.image = {
                url: attachment.url,
                caption: payload.content || undefined,
                name: attachment.name,
            };
        }
    }
    if (payload.attachments && payload.attachments.length > 0) {
        messagePayload.attachments = payload.attachments;
    }
    return {
        chatId,
        type,
        text: payload.content,
        message: messagePayload,
    };
}
function extractMessageMetadata(data) {
    if (!data || typeof data !== 'object') {
        return {};
    }
    const root = data;
    const messages = toArray(root.messages);
    const candidate = messages[0] ?? root;
    const id = firstNonEmpty(candidate?.id, candidate?.messageId, candidate?.message_id, root.id);
    const timestampCandidate = firstNonEmpty(candidate?.timestamp, candidate?.ts, candidate?.sentAt, candidate?.messageTimestamp);
    const timestamp = timestampCandidate ? normalizeTimestamp(timestampCandidate) : undefined;
    return {
        id: id ? String(id) : undefined,
        timestamp,
    };
}
class WahaIntegrationService {
    constructor(chatService = new chatService_1.default(), configService = new wahaConfigService_1.default(), httpClient = new HttpClient()) {
        this.chatService = chatService;
        this.configService = configService;
        this.httpClient = httpClient;
    }
    async sendMessage(conversationId, payload) {
        const conversation = await this.chatService.getConversationDetails(conversationId);
        if (!conversation) {
            throw new chatService_1.ValidationError('Conversation not found');
        }
        let config;
        try {
            config = await this.configService.requireConfig();
        }
        catch (error) {
            if (error instanceof wahaConfigService_1.ValidationError) {
                throw new IntegrationNotConfiguredError(error.message);
            }
            throw error;
        }
        const chatId = resolveChatId(conversation);
        const endpoint = resolveMessagesEndpoint(config.baseUrl);
        const requestBody = buildSendPayload(chatId, payload);
        const headers = {
            Authorization: `Bearer ${config.apiKey}`,
            'X-API-Key': config.apiKey,
        };
        const response = await this.httpClient.postJson(endpoint, requestBody, headers);
        if (response.status < 200 || response.status >= 300) {
            const message = typeof response.data === 'string'
                ? response.data
                : `WAHA request failed with status ${response.status}`;
            throw new Error(message);
        }
        const metadata = extractMessageMetadata(response.data);
        const timestamp = metadata.timestamp ?? new Date();
        return this.chatService.recordOutgoingMessage({
            id: metadata.id,
            externalId: metadata.id,
            conversationId,
            content: payload.content,
            type: payload.type ?? 'text',
            timestamp,
            attachments: payload.attachments ?? null,
        });
    }
    async handleWebhook(body, headers) {
        const config = await this.configService.getConfig();
        if (!config || !config.isActive) {
            throw new IntegrationNotConfiguredError();
        }
        if (config.webhookSecret) {
            const received = firstNonEmpty(headers['x-waha-signature'], headers['x-webhook-signature'], headers['x-webhook-secret'], headers['x-signature']);
            if (!received || String(received) !== config.webhookSecret) {
                throw new WebhookAuthorizationError();
            }
        }
        const messages = normalizeWebhookMessages(body);
        for (const message of messages) {
            const conversation = await this.chatService.ensureConversation({
                id: message.conversationId,
                contactIdentifier: message.conversationId,
                contactName: message.senderName ?? message.conversationId,
                metadata: {
                    provider: 'waha',
                    chatId: message.conversationId,
                },
            });
            await this.chatService.recordIncomingMessage({
                id: message.messageId,
                externalId: message.externalId ?? message.messageId,
                conversationId: conversation.id,
                content: message.content,
                type: message.type,
                timestamp: message.timestamp,
                attachments: message.attachments ?? null,
            });
        }
        const statuses = normalizeStatusUpdates(body);
        for (const status of statuses) {
            await this.chatService.updateMessageStatusByExternalId(status.externalId, status.status);
        }
    }
}
exports.default = WahaIntegrationService;
