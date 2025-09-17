"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.handleWahaWebhook = handleWahaWebhook;
const chatService_1 = __importDefault(require("../services/chatService"));
const chatService = new chatService_1.default();
const MESSAGE_EVENTS = new Set([
    'message',
    'messages.upsert',
    'message.created',
]);
const STATUS_EVENTS = new Set([
    'status',
    'message.ack',
    'messages.update',
]);
const ARRAY_LIKE_KEYS = ['events', 'payload', 'data', 'messages'];
const TRUTHY_STRINGS = new Set(['true', '1', 'yes', 'on']);
function toEvent(value, fallbackInstanceId) {
    if (!value || typeof value !== 'object') {
        return null;
    }
    const record = value;
    const eventName = typeof record.event === 'string' ? record.event.trim() : '';
    if (!eventName) {
        return null;
    }
    const instanceId = typeof record.instanceId === 'string' && record.instanceId.trim()
        ? record.instanceId.trim()
        : fallbackInstanceId;
    const type = typeof record.type === 'string' ? record.type.trim() : undefined;
    const payload = record.payload ?? record.data;
    return {
        event: eventName,
        instanceId,
        type,
        payload,
        data: record.data,
    };
}
function extractEvents(body) {
    if (Array.isArray(body)) {
        return body.map((item) => toEvent(item)).filter((item) => Boolean(item));
    }
    if (body && typeof body === 'object') {
        const container = body;
        for (const key of ARRAY_LIKE_KEYS) {
            const value = container[key];
            if (Array.isArray(value)) {
                return value
                    .map((item) => toEvent(item, typeof container.instanceId === 'string' ? container.instanceId : undefined))
                    .filter((item) => Boolean(item));
            }
        }
        const single = toEvent(body);
        return single ? [single] : [];
    }
    return [];
}
function asArray(value) {
    if (Array.isArray(value)) {
        return value;
    }
    if (!value) {
        return [];
    }
    return [value];
}
function readString(value) {
    if (typeof value === 'string') {
        const trimmed = value.trim();
        return trimmed.length > 0 ? trimmed : undefined;
    }
    if (typeof value === 'number' && Number.isFinite(value)) {
        return String(value);
    }
    return undefined;
}
function readBoolean(value) {
    if (typeof value === 'boolean') {
        return value;
    }
    if (typeof value === 'number') {
        return value !== 0;
    }
    if (typeof value === 'string') {
        const normalized = value.trim().toLowerCase();
        if (!normalized) {
            return undefined;
        }
        return TRUTHY_STRINGS.has(normalized);
    }
    return undefined;
}
function parseTimestamp(value) {
    if (!value) {
        return undefined;
    }
    if (value instanceof Date) {
        return value;
    }
    if (typeof value === 'number') {
        if (!Number.isFinite(value)) {
            return undefined;
        }
        if (value > 1000000000000) {
            return new Date(value);
        }
        return new Date(value * 1000);
    }
    if (typeof value === 'string' && value.trim()) {
        const numeric = Number(value);
        if (!Number.isNaN(numeric)) {
            return parseTimestamp(numeric);
        }
        const parsed = new Date(value);
        if (!Number.isNaN(parsed.getTime())) {
            return parsed;
        }
    }
    return undefined;
}
function normalizeStatus(value) {
    if (typeof value === 'number') {
        switch (value) {
            case 0:
            case 1:
                return 'sent';
            case 2:
                return 'delivered';
            case 3:
            case 4:
                return 'read';
            default:
                return null;
        }
    }
    if (typeof value === 'string') {
        const normalized = value.trim().toLowerCase();
        if (!normalized) {
            return null;
        }
        if (['pending', 'sent', 'server_ack', 'ack'].includes(normalized)) {
            return 'sent';
        }
        if (['delivered', 'delivery', 'client_ack', 'received'].includes(normalized)) {
            return 'delivered';
        }
        if (['read', 'viewed', 'played', 'seen'].includes(normalized)) {
            return 'read';
        }
    }
    return null;
}
function deriveChatIdentifier(payload) {
    return (readString(payload.chatId) ??
        readString(payload.remoteJid) ??
        readString(payload.from) ??
        readString(payload.to) ??
        readString(payload.chat_id));
}
function deriveContactName(payload) {
    return (readString(payload.senderName) ??
        readString(payload.pushName) ??
        readString(payload.notifyName) ??
        readString(payload.chatName) ??
        readString(payload.name));
}
function extractKeyId(value) {
    if (!value) {
        return undefined;
    }
    if (typeof value === 'string' || typeof value === 'number') {
        return readString(value);
    }
    if (typeof value !== 'object') {
        return undefined;
    }
    const record = value;
    const direct = record.id ?? record._serialized;
    if (typeof direct === 'string' || typeof direct === 'number') {
        return readString(direct);
    }
    if (direct && typeof direct === 'object') {
        const nested = direct;
        return readString(nested._serialized ?? nested.id);
    }
    return undefined;
}
function deriveMessageContent(payload, type) {
    const text = payload.text;
    const message = payload.message;
    const extended = message?.extendedTextMessage;
    const baseContent = readString(payload.body) ??
        (text ? readString(text.body) : undefined) ??
        readString(payload.caption) ??
        (message ? readString(message.conversation) : undefined) ??
        (extended ? readString(extended.text) : undefined);
    if (baseContent) {
        return baseContent;
    }
    return type === 'image' ? 'Imagem recebida' : 'Mensagem recebida';
}
function determineMessageType(payload) {
    const type = readString(payload.type) ?? readString(payload.messageType);
    if (!type) {
        return 'text';
    }
    const normalized = type.toLowerCase();
    if (['image', 'sticker', 'document', 'video', 'audio'].includes(normalized)) {
        return 'image';
    }
    return 'text';
}
function parseMessagePayload(payload, event) {
    if (!payload || typeof payload !== 'object') {
        return null;
    }
    const record = payload;
    const chatId = deriveChatIdentifier(record);
    if (!chatId) {
        return null;
    }
    const messageType = determineMessageType(record);
    const fromMeFlag = readBoolean(record.fromMe) ?? readBoolean(record.isMe);
    const direction = event.type?.toLowerCase();
    const fromMe = (typeof direction === 'string' && direction === 'outgoing') ||
        (typeof direction === 'string' && ['sent', 'server_ack'].includes(direction)) ||
        fromMeFlag === true;
    const key = record.key;
    const externalId = readString(record.id) ??
        readString(record.messageId) ??
        (key ? extractKeyId(key) : undefined);
    const messageId = readString(record.messageToken) ?? externalId ?? undefined;
    const timestamp = parseTimestamp(record.timestamp) ??
        parseTimestamp(record.messageTimestamp) ??
        parseTimestamp(record.t) ??
        parseTimestamp(record.time) ??
        parseTimestamp(record.sendAt);
    const contactName = deriveContactName(record) ?? null;
    const content = deriveMessageContent(record, messageType);
    return {
        conversationId: chatId,
        contactIdentifier: chatId,
        contactName,
        content,
        type: messageType,
        timestamp,
        externalId: externalId ?? undefined,
        messageId,
        fromMe,
        sessionId: event.instanceId,
    };
}
async function handleMessageEvent(event) {
    const payload = (event.payload ?? event.data);
    const items = asArray(Array.isArray(payload)
        ? payload
        : Array.isArray(payload?.messages)
            ? payload.messages
            : payload);
    let processed = 0;
    for (const item of items) {
        const parsed = parseMessagePayload(item, event);
        if (!parsed) {
            continue;
        }
        try {
            await chatService.ensureConversation({
                id: parsed.conversationId,
                contactIdentifier: parsed.contactIdentifier,
                contactName: parsed.contactName ?? undefined,
                metadata: parsed.sessionId ? { session: parsed.sessionId } : undefined,
            });
            const recordInput = {
                id: parsed.messageId,
                externalId: parsed.externalId,
                conversationId: parsed.conversationId,
                content: parsed.content,
                type: parsed.type,
                timestamp: parsed.timestamp,
            };
            if (parsed.fromMe) {
                await chatService.recordOutgoingMessage(recordInput);
            }
            else {
                await chatService.recordIncomingMessage(recordInput);
            }
            processed += 1;
        }
        catch (error) {
            console.error('Failed to persist WAHA message event', error, { item });
        }
    }
    return processed;
}
async function handleStatusEvent(event) {
    const payload = (event.payload ?? event.data);
    const updates = asArray(Array.isArray(payload)
        ? payload
        : Array.isArray(payload?.messages)
            ? payload.messages
            : payload);
    let processed = 0;
    for (const update of updates) {
        if (!update || typeof update !== 'object') {
            continue;
        }
        const record = update;
        const key = record.key;
        const externalId = readString(record.id) ??
            readString(record.messageId) ??
            (key ? extractKeyId(key) : undefined);
        if (!externalId) {
            continue;
        }
        const status = normalizeStatus(record.status) ??
            normalizeStatus(record.ack) ??
            normalizeStatus(event.type);
        if (!status) {
            continue;
        }
        try {
            const updated = await chatService.updateMessageStatusByExternalId(externalId, status);
            if (updated) {
                processed += 1;
            }
        }
        catch (error) {
            console.error('Failed to update WAHA message status', error, { update });
        }
    }
    return processed;
}
async function handleWahaWebhook(req, res) {
    const events = extractEvents(req.body);
    if (events.length === 0) {
        console.warn('Received WAHA webhook without recognizable events');
        return res.status(200).json({ messages: 0, statuses: 0 });
    }
    let messageCount = 0;
    let statusCount = 0;
    for (const event of events) {
        try {
            if (MESSAGE_EVENTS.has(event.event)) {
                messageCount += await handleMessageEvent(event);
            }
            else if (STATUS_EVENTS.has(event.event)) {
                statusCount += await handleStatusEvent(event);
            }
            else {
                // Ignore unsupported events but acknowledge reception
                continue;
            }
        }
        catch (error) {
            console.error('Failed to process WAHA webhook event', error, { event: event.event });
        }
    }
    res.status(200).json({ messages: messageCount, statuses: statusCount });
}
exports.default = handleWahaWebhook;
