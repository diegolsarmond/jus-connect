"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ValidationError = void 0;
const db_1 = __importDefault(require("./db"));
const chatSchema_1 = require("./chatSchema");
class ValidationError extends Error {
    constructor(message) {
        super(message);
        this.name = 'ValidationError';
    }
}
exports.ValidationError = ValidationError;
const DEFAULT_SHORT_STATUS = 'Disponível';
const DEFAULT_PAGE_SIZE = 20;
const MAX_PAGE_SIZE = 100;
function formatDate(value) {
    if (!value) {
        return new Date().toISOString();
    }
    if (value instanceof Date) {
        return value.toISOString();
    }
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) {
        return new Date().toISOString();
    }
    return parsed.toISOString();
}
function normalizeSender(value) {
    return value === 'me' ? 'me' : 'contact';
}
function normalizeStatus(value) {
    if (value === 'delivered' || value === 'read') {
        return value;
    }
    return 'sent';
}
function normalizeMessageType(value) {
    return value === 'image' ? 'image' : 'text';
}
function parseAttachments(value) {
    if (!value) {
        return undefined;
    }
    if (Array.isArray(value)) {
        return value.filter((item) => item && typeof item === 'object');
    }
    if (typeof value === 'string') {
        try {
            const parsed = JSON.parse(value);
            return Array.isArray(parsed)
                ? parsed.filter((item) => item && typeof item === 'object')
                : undefined;
        }
        catch (error) {
            return undefined;
        }
    }
    if (typeof value === 'object') {
        const parsed = value;
        if (Array.isArray(parsed.attachments)) {
            return parsed.attachments.filter((item) => item && typeof item === 'object');
        }
    }
    return undefined;
}
function truncate(value, length = 160) {
    if (value.length <= length) {
        return value;
    }
    return `${value.slice(0, length - 1)}…`;
}
function buildPreview(content, type, attachments) {
    if (type === 'image') {
        const name = attachments && attachments.length > 0 ? attachments[0].name : undefined;
        return name ? `Imagem • ${name}` : 'Imagem recebida';
    }
    const normalized = content.trim();
    if (!normalized) {
        return 'Mensagem';
    }
    return truncate(normalized);
}
function getConversationName(row) {
    if (row.contact_name && row.contact_name.trim()) {
        return row.contact_name.trim();
    }
    if (row.contact_identifier && row.contact_identifier.trim()) {
        return row.contact_identifier.trim();
    }
    return row.id;
}
function buildAvatar(name) {
    const initial = name.trim().charAt(0).toUpperCase() || 'C';
    const svg = [
        "<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 64 64'>",
        "<rect width='64' height='64' rx='8' fill='%234F46E5' />",
        `<text x='50%' y='50%' dominant-baseline='central' text-anchor='middle' font-family='Inter,Arial,sans-serif' font-size='32' fill='white'>${initial}</text>`,
        '</svg>',
    ].join('');
    return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}
function mapConversation(row) {
    const name = getConversationName(row);
    const avatar = row.contact_avatar && row.contact_avatar.trim()
        ? row.contact_avatar
        : buildAvatar(name);
    const lastMessage = row.last_message_id
        ? {
            id: row.last_message_id,
            content: row.last_message_preview ?? '',
            preview: row.last_message_preview ?? '',
            timestamp: formatDate(row.last_message_timestamp),
            sender: normalizeSender(row.last_message_sender),
            type: normalizeMessageType(row.last_message_type),
            status: normalizeStatus(row.last_message_status),
        }
        : undefined;
    return {
        id: row.id,
        name,
        avatar,
        shortStatus: row.short_status?.trim() || DEFAULT_SHORT_STATUS,
        description: row.description?.trim() || undefined,
        unreadCount: typeof row.unread_count === 'number' ? row.unread_count : 0,
        pinned: row.pinned ?? false,
        lastMessage,
        contactIdentifier: row.contact_identifier,
        metadata: row.metadata ?? null,
        createdAt: formatDate(row.created_at),
        updatedAt: formatDate(row.updated_at),
    };
}
function mapMessage(row) {
    return {
        id: row.id,
        conversationId: row.conversation_id,
        sender: normalizeSender(row.sender),
        content: row.content,
        timestamp: formatDate(row.timestamp),
        status: normalizeStatus(row.status),
        type: normalizeMessageType(row.message_type),
        attachments: parseAttachments(row.attachments),
    };
}
function normalizeConversationId(id, fallback) {
    const value = (id ?? fallback).trim();
    if (!value) {
        throw new ValidationError('Conversation id cannot be empty');
    }
    return value;
}
function normalizeContactIdentifier(value) {
    if (typeof value !== 'string') {
        throw new ValidationError('contactIdentifier is required');
    }
    const trimmed = value.trim();
    if (!trimmed) {
        throw new ValidationError('contactIdentifier is required');
    }
    return trimmed;
}
function normalizeContactName(value, fallback) {
    if (value === null) {
        return null;
    }
    if (typeof value === 'string' && value.trim()) {
        return value.trim();
    }
    return fallback.trim() || null;
}
function normalizeMetadata(value) {
    if (!value) {
        return null;
    }
    return value;
}
function normalizeBoolean(value, defaultValue) {
    if (typeof value === 'boolean') {
        return value;
    }
    return defaultValue;
}
function normalizeMessageContent(value) {
    if (typeof value !== 'string') {
        throw new ValidationError('Message content is required');
    }
    const trimmed = value.trim();
    if (!trimmed) {
        throw new ValidationError('Message content is required');
    }
    return trimmed;
}
function normalizeTimestamp(value) {
    if (value instanceof Date) {
        return value;
    }
    if (typeof value === 'string' && value.trim()) {
        const parsed = new Date(value);
        if (!Number.isNaN(parsed.getTime())) {
            return parsed;
        }
    }
    return new Date();
}
function normalizeAttachments(value) {
    if (!value) {
        return null;
    }
    const normalized = [];
    for (const attachment of value) {
        if (!attachment) {
            continue;
        }
        if (!attachment.id || !attachment.url || !attachment.name) {
            continue;
        }
        normalized.push({ ...attachment, type: 'image' });
    }
    return normalized.length > 0 ? normalized : null;
}
function normalizeMessageId(id, externalId) {
    if (typeof id === 'string' && id.trim()) {
        return id.trim();
    }
    if (typeof externalId === 'string' && externalId.trim()) {
        return externalId.trim();
    }
    return `msg-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}
function computeNextCursor(messages) {
    if (messages.length === 0) {
        return null;
    }
    return messages[0].timestamp;
}
class ChatService {
    constructor(db = db_1.default, schemaInitializer = chatSchema_1.ensureChatSchema) {
        this.db = db;
        this.schemaReady = schemaInitializer(this.db);
    }
    async query(text, params) {
        await this.schemaReady;
        return this.db.query(text, params);
    }
    async listConversations() {
        const result = await this.query(`SELECT id, contact_identifier, contact_name, contact_avatar, short_status, description, pinned,
              unread_count, last_message_id, last_message_preview, last_message_timestamp,
              last_message_sender, last_message_type, last_message_status, metadata, created_at, updated_at
         FROM chat_conversations
         ORDER BY COALESCE(last_message_timestamp, updated_at, created_at) DESC`);
        return result.rows.map((row) => {
            const mapped = mapConversation(row);
            return {
                id: mapped.id,
                name: mapped.name,
                avatar: mapped.avatar,
                shortStatus: mapped.shortStatus,
                description: mapped.description,
                unreadCount: mapped.unreadCount,
                pinned: mapped.pinned,
                lastMessage: mapped.lastMessage,
            };
        });
    }
    async listKnownSessions() {
        const result = await this.query(`SELECT DISTINCT metadata ->> 'session' AS session_id

         FROM chat_conversations
        WHERE metadata ? 'session'`);
        const sessions = [];
        const seen = new Set();
        for (const row of result.rows) {
            if (!row || typeof row.session_id !== 'string') {
                continue;
            }
            const trimmed = row.session_id.trim();
            if (!trimmed || seen.has(trimmed)) {
                continue;
            }
            seen.add(trimmed);
            sessions.push(trimmed);
        }
        return sessions;
    }
    async getConversationDetails(conversationId) {
        const result = await this.query(`SELECT id, contact_identifier, contact_name, contact_avatar, short_status, description, pinned,
              unread_count, last_message_id, last_message_preview, last_message_timestamp,
              last_message_sender, last_message_type, last_message_status, metadata, created_at, updated_at
         FROM chat_conversations
         WHERE id = $1`, [conversationId]);
        if (result.rowCount === 0) {
            return null;
        }
        return mapConversation(result.rows[0]);
    }
    async createConversation(input) {
        const contactIdentifier = normalizeContactIdentifier(input.contactIdentifier);
        const conversationId = normalizeConversationId(input.id, contactIdentifier);
        const contactName = normalizeContactName(input.contactName ?? undefined, contactIdentifier);
        const description = input.description?.trim() || null;
        const shortStatus = input.shortStatus?.trim() || null;
        const avatar = input.avatar?.trim() || null;
        const pinned = normalizeBoolean(input.pinned, false);
        const metadata = normalizeMetadata(input.metadata);
        const result = await this.query(`INSERT INTO chat_conversations (
         id,
         contact_identifier,
         contact_name,
         contact_avatar,
         short_status,
         description,
         pinned,
         metadata
       )
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       ON CONFLICT (id) DO UPDATE
         SET contact_identifier = EXCLUDED.contact_identifier,
             contact_name = EXCLUDED.contact_name,
             contact_avatar = EXCLUDED.contact_avatar,
             short_status = EXCLUDED.short_status,
             description = EXCLUDED.description,
             pinned = EXCLUDED.pinned,
             metadata = EXCLUDED.metadata
       RETURNING id, contact_identifier, contact_name, contact_avatar, short_status, description, pinned,
                 unread_count, last_message_id, last_message_preview, last_message_timestamp,
                 last_message_sender, last_message_type, last_message_status, metadata, created_at, updated_at`, [conversationId, contactIdentifier, contactName, avatar, shortStatus, description, pinned, metadata]);
        const mapped = mapConversation(result.rows[0]);
        return {
            id: mapped.id,
            name: mapped.name,
            avatar: mapped.avatar,
            shortStatus: mapped.shortStatus,
            description: mapped.description,
            unreadCount: mapped.unreadCount,
            pinned: mapped.pinned,
            lastMessage: mapped.lastMessage,
        };
    }
    async ensureConversation(input) {
        const contactIdentifier = normalizeContactIdentifier(input.contactIdentifier);
        const conversationId = normalizeConversationId(input.id, contactIdentifier);
        const contactName = normalizeContactName(input.contactName ?? undefined, contactIdentifier);
        const description = input.description?.trim() || null;
        const shortStatus = input.shortStatus?.trim() || null;
        const avatar = input.avatar?.trim() || null;
        const pinned = normalizeBoolean(input.pinned, false);
        const metadata = normalizeMetadata(input.metadata);
        const result = await this.query(`INSERT INTO chat_conversations (
         id,
         contact_identifier,
         contact_name,
         contact_avatar,
         short_status,
         description,
         pinned,
         metadata
       )
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       ON CONFLICT (id) DO UPDATE
        SET contact_identifier = COALESCE(chat_conversations.contact_identifier, EXCLUDED.contact_identifier),
            contact_name = COALESCE(chat_conversations.contact_name, EXCLUDED.contact_name),
            contact_avatar = COALESCE(chat_conversations.contact_avatar, EXCLUDED.contact_avatar),
            short_status = COALESCE(chat_conversations.short_status, EXCLUDED.short_status),
            description = COALESCE(chat_conversations.description, EXCLUDED.description),
            metadata = CASE
              WHEN chat_conversations.metadata IS NULL AND EXCLUDED.metadata IS NULL THEN NULL
              ELSE COALESCE(chat_conversations.metadata, '{}'::jsonb) || COALESCE(EXCLUDED.metadata, '{}'::jsonb)
            END
       RETURNING id, contact_identifier, contact_name, contact_avatar, short_status, description, pinned,
                 unread_count, last_message_id, last_message_preview, last_message_timestamp,
                 last_message_sender, last_message_type, last_message_status, metadata, created_at, updated_at`, [conversationId, contactIdentifier, contactName, avatar, shortStatus, description, pinned, metadata]);
        return mapConversation(result.rows[0]);
    }
    async recordMessage(input) {
        const conversation = await this.getConversationDetails(input.conversationId);
        if (!conversation) {
            throw new ValidationError('Conversation not found');
        }
        const content = normalizeMessageContent(input.content);
        const type = normalizeMessageType(input.type);
        const status = normalizeStatus(input.status);
        const timestamp = normalizeTimestamp(input.timestamp);
        const attachments = normalizeAttachments(input.attachments);
        const externalId = typeof input.externalId === 'string' && input.externalId.trim()
            ? input.externalId.trim()
            : null;
        const sender = input.sender;
        const id = normalizeMessageId(input.id, externalId);
        const insertResult = await this.query(`INSERT INTO chat_messages (id, conversation_id, external_id, sender, content, message_type, status, timestamp, attachments)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       ON CONFLICT (id) DO NOTHING
       RETURNING id, conversation_id, external_id, sender, content, message_type, status, timestamp, attachments, created_at`, [id, conversation.id, externalId, sender, content, type, status, timestamp, attachments]);
        if (insertResult.rowCount === 0) {
            const existing = await this.query(`SELECT id, conversation_id, external_id, sender, content, message_type, status, timestamp, attachments, created_at
           FROM chat_messages
           WHERE id = $1`, [id]);
            if (existing.rowCount === 0) {
                throw new Error('Failed to persist message');
            }
            return mapMessage(existing.rows[0]);
        }
        const preview = buildPreview(content, type, attachments ?? undefined);
        await this.query(`UPDATE chat_conversations
          SET last_message_id = $2,
              last_message_preview = $3,
              last_message_timestamp = $4,
              last_message_sender = $5,
              last_message_type = $6,
              last_message_status = $7,
              unread_count = CASE WHEN $5 = 'contact' THEN unread_count + 1 ELSE unread_count END
        WHERE id = $1`, [conversation.id, id, preview, timestamp, sender, type, status]);
        return mapMessage(insertResult.rows[0]);
    }
    async recordIncomingMessage(input) {
        return this.recordMessage({ ...input, sender: 'contact', status: input.status ?? 'delivered' });
    }
    async recordOutgoingMessage(input) {
        return this.recordMessage({ ...input, sender: 'me', status: input.status ?? 'sent' });
    }
    async getMessages(conversationId, cursor, limit = DEFAULT_PAGE_SIZE) {
        const conversation = await this.getConversationDetails(conversationId);
        if (!conversation) {
            throw new ValidationError('Conversation not found');
        }
        const normalizedLimit = Math.min(Math.max(limit, 1), MAX_PAGE_SIZE);
        const values = [conversationId, normalizedLimit + 1];
        let filter = '';
        if (cursor && cursor.trim()) {
            const parsed = new Date(cursor);
            if (!Number.isNaN(parsed.getTime())) {
                values.push(parsed);
                filter = 'AND created_at < $3';
            }
        }
        const result = await this.query(`SELECT id, conversation_id, external_id, sender, content, message_type, status, timestamp, attachments, created_at
         FROM chat_messages
         WHERE conversation_id = $1
         ${filter}
         ORDER BY created_at DESC
         LIMIT $2`, values);
        const rows = result.rows;
        const hasMore = rows.length > normalizedLimit;
        const slice = hasMore ? rows.slice(0, normalizedLimit) : rows;
        const messages = slice.reverse().map(mapMessage);
        return {
            messages,
            nextCursor: hasMore ? computeNextCursor(messages) : null,
        };
    }
    async markConversationAsRead(conversationId) {
        const updateConversation = await this.query(`UPDATE chat_conversations
          SET unread_count = 0,
              last_message_status = CASE WHEN last_message_sender = 'contact' THEN 'read' ELSE last_message_status END
        WHERE id = $1
        RETURNING id, last_message_id`, [conversationId]);
        if (updateConversation.rowCount === 0) {
            return false;
        }
        await this.query(`UPDATE chat_messages
          SET status = 'read'
        WHERE conversation_id = $1 AND sender = 'contact' AND status <> 'read'`, [conversationId]);
        return true;
    }
    async updateMessageStatusByExternalId(externalId, status) {
        const normalizedStatus = normalizeStatus(status);
        const result = await this.query(`UPDATE chat_messages
          SET status = $2
        WHERE external_id = $1
        RETURNING conversation_id, id`, [externalId, normalizedStatus]);
        if (result.rowCount === 0) {
            return false;
        }
        for (const row of result.rows) {
            await this.query(`UPDATE chat_conversations
            SET last_message_status = CASE WHEN last_message_id = $2 THEN $3 ELSE last_message_status END
          WHERE id = $1`, [row.conversation_id, row.id, normalizedStatus]);
        }
        return true;
    }
}
exports.default = ChatService;
