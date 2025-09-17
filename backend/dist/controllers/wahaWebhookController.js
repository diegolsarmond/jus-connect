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
const URL_PROTOCOL_PATTERN = /^(?:https?|data):/i;
const CONTACT_NAME_KEYS = [
    'contactName',
    'senderName',
    'sender_name',
    'pushName',
    'pushname',
    'notifyName',
    'chatName',
    'shortName',
    'displayName',
    'formattedName',
    'businessName',
    'subject',
    'name',
    'fullName',
    'givenName',
    'familyName',
    'firstName',
    'lastName',
    'alias',
    'title',
    'label',
];
const AVATAR_URL_KEYS = [
    'avatar',
    'profilePicUrl',
    'profilePic',
    'profilePictureUrl',
    'profilePicture',
    'pictureUrl',
    'picture',
    'photoUrl',
    'imageUrl',
    'imgUrl',
    'img',
    'imgFull',
    'thumbnailUrl',
    'thumbUrl',
    'previewEurl',
    'eurl',
];
const MEDIA_CONTAINER_KEYS = [
    'media',
    'mediaData',
    'mediaInfo',
    'mediaItem',
    'attachment',
    'attachments',
    'attachmentData',
    'file',
    'files',
    'document',
    'documents',
    'image',
    'images',
    'video',
    'videos',
    'audio',
    'audios',
    'sticker',
    'stickers',
    'thumbnail',
    'thumbnails',
    'preview',
    'previewMedia',
    'download',
    'downloadInfo',
    'payload',
    'data',
];
const MESSAGE_MEDIA_KEYS = [
    'imageMessage',
    'videoMessage',
    'documentMessage',
    'audioMessage',
    'stickerMessage',
    'documentWithCaptionMessage',
    'ptvMessage',
    'templateMessage',
    'productMessage',
    'viewOnceMessage',
    'viewOnceMessageV2',
];
function isRecord(value) {
    return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}
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
function readUrl(value) {
    if (typeof value !== 'string') {
        return undefined;
    }
    const trimmed = value.trim();
    if (!trimmed) {
        return undefined;
    }
    if (URL_PROTOCOL_PATTERN.test(trimmed)) {
        return trimmed;
    }
    return undefined;
}
function sanitizeFileName(value) {
    if (typeof value !== 'string') {
        return undefined;
    }
    const trimmed = value.trim();
    if (!trimmed) {
        return undefined;
    }
    const segments = trimmed.split(/[/\\]/);
    const last = segments[segments.length - 1] ?? trimmed;
    const sanitized = last.replace(/[<>:"|?*\u0000-\u001F]/g, ' ').replace(/\s+/g, ' ').trim();
    return sanitized || undefined;
}
function getMimeExtension(mimeType) {
    if (!mimeType) {
        return undefined;
    }
    const normalized = mimeType.trim().toLowerCase();
    const mapping = {
        'image/jpeg': 'jpg',
        'image/jpg': 'jpg',
        'image/png': 'png',
        'image/gif': 'gif',
        'image/webp': 'webp',
        'image/heic': 'heic',
        'image/heif': 'heif',
        'image/bmp': 'bmp',
        'image/svg+xml': 'svg',
        'image/avif': 'avif',
    };
    return mapping[normalized];
}
function buildAttachmentName(candidate, fallback, extension, index, total) {
    const fallbackBase = sanitizeFileName(fallback) ?? 'imagem';
    const base = sanitizeFileName(candidate) ?? (total > 1 ? `${fallbackBase}-${index}` : fallbackBase);
    if (extension && !base.toLowerCase().endsWith(`.${extension}`)) {
        return `${base}.${extension}`;
    }
    return base;
}
function extractNameFromValue(value, visited = new Set()) {
    if (!value || visited.has(value)) {
        return undefined;
    }
    if (typeof value === 'string') {
        const trimmed = value.trim();
        return trimmed || undefined;
    }
    if (Array.isArray(value)) {
        visited.add(value);
        for (const item of value) {
            const nested = extractNameFromValue(item, visited);
            if (nested) {
                return nested;
            }
        }
        return undefined;
    }
    if (!isRecord(value)) {
        return undefined;
    }
    visited.add(value);
    for (const key of CONTACT_NAME_KEYS) {
        const candidate = readString(value[key]);
        if (candidate) {
            return candidate;
        }
    }
    const nestedKeys = ['profile', 'contact', 'sender', 'participant', 'user', 'chat', 'metadata', 'profileData', 'details'];
    for (const nestedKey of nestedKeys) {
        if (nestedKey in value) {
            const nested = extractNameFromValue(value[nestedKey], visited);
            if (nested) {
                return nested;
            }
        }
    }
    return undefined;
}
function extractAvatarFromValue(value, visited = new Set()) {
    if (!value || visited.has(value)) {
        return undefined;
    }
    if (typeof value === 'string') {
        return readUrl(value);
    }
    if (Array.isArray(value)) {
        visited.add(value);
        for (const item of value) {
            const nested = extractAvatarFromValue(item, visited);
            if (nested) {
                return nested;
            }
        }
        return undefined;
    }
    if (!isRecord(value)) {
        return undefined;
    }
    visited.add(value);
    for (const key of AVATAR_URL_KEYS) {
        const url = readUrl(value[key]);
        if (url) {
            return url;
        }
    }
    const nestedKeys = ['profilePicThumbObj', 'contact', 'profile', 'sender', 'participant', 'user', 'chat', 'picture', 'thumbnail', 'thumb', 'metadata'];
    for (const nestedKey of nestedKeys) {
        if (nestedKey in value) {
            const nested = extractAvatarFromValue(value[nestedKey], visited);
            if (nested) {
                return nested;
            }
        }
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
    const chat = isRecord(payload['chat']) ? payload['chat'] : null;
    const data = isRecord(payload['data']) ? payload['data'] : null;
    const message = isRecord(payload['message']) ? payload['message'] : null;
    const nestedMessage = message && isRecord(message['message']) ? message['message'] : null;
    const key = isRecord(payload['key']) ? payload['key'] : null;
    const messageKey = message && isRecord(message['key']) ? message['key'] : null;
    return (readString(payload['chatId']) ??
        readString(payload['chat_id']) ??
        readString(payload['remoteJid']) ??
        readString(payload['remote_jid']) ??
        readString(payload['from']) ??
        readString(payload['to']) ??
        readString(payload['jid']) ??
        (chat
            ? readString(chat['id']) ??
                readString(chat['jid']) ??
                readString(chat['remoteJid']) ??
                readString(chat['chatId'])
            : undefined) ??
        (data
            ? readString(data['chatId']) ??
                readString(data['remoteJid']) ??
                readString(data['jid'])
            : undefined) ??
        (key ? readString(key['remoteJid']) ?? readString(key['chatId']) : undefined) ??
        (messageKey
            ? readString(messageKey['remoteJid']) ?? readString(messageKey['chatId'])
            : undefined) ??
        (message
            ? readString(message['chatId']) ??
                readString(message['remoteJid']) ??
                readString(message['jid'])
            : undefined) ??
        (nestedMessage
            ? readString(nestedMessage['chatId']) ?? readString(nestedMessage['remoteJid'])
            : undefined));
}
function deriveContactName(payload) {
    for (const key of CONTACT_NAME_KEYS) {
        const direct = readString(payload[key]);
        if (direct) {
            return direct;
        }
    }
    const candidates = [
        payload['contact'],
        payload['sender'],
        payload['chat'],
        payload['user'],
        payload['profile'],
        payload['profileData'],
        payload['profilePicThumbObj'],
    ];
    const data = isRecord(payload['data']) ? payload['data'] : null;
    if (data) {
        candidates.push(data['contact'], data['sender'], data['chat'], data['profile']);
    }
    const contacts = payload['contacts'];
    if (Array.isArray(contacts)) {
        candidates.push(...contacts);
    }
    const key = isRecord(payload['key']) ? payload['key'] : null;
    if (key) {
        candidates.push(key);
    }
    const message = isRecord(payload['message']) ? payload['message'] : null;
    if (message) {
        for (const keyName of CONTACT_NAME_KEYS) {
            const candidate = readString(message[keyName]);
            if (candidate) {
                return candidate;
            }
        }
        candidates.push(message, message['sender'], message['contact'], message['participant'], message['user'], message['profile']);
        const nestedMessage = isRecord(message['message']) ? message['message'] : null;
        if (nestedMessage) {
            candidates.push(nestedMessage);
        }
        const contextInfo = isRecord(message['contextInfo']) ? message['contextInfo'] : null;
        if (contextInfo) {
            candidates.push(contextInfo['participant'], contextInfo['contact'], contextInfo['quotedMessage']);
        }
    }
    for (const candidate of candidates) {
        const name = extractNameFromValue(candidate);
        if (name) {
            return name;
        }
    }
    return undefined;
}
function deriveContactAvatar(payload) {
    for (const key of AVATAR_URL_KEYS) {
        const direct = readUrl(payload[key]);
        if (direct) {
            return direct;
        }
    }
    const candidates = [
        payload['contact'],
        payload['sender'],
        payload['chat'],
        payload['user'],
        payload['profile'],
        payload['profileData'],
        payload['profilePicThumbObj'],
    ];
    const data = isRecord(payload['data']) ? payload['data'] : null;
    if (data) {
        candidates.push(data['contact'], data['sender'], data['chat'], data['profile']);
    }
    const contacts = payload['contacts'];
    if (Array.isArray(contacts)) {
        candidates.push(...contacts);
    }
    const message = isRecord(payload['message']) ? payload['message'] : null;
    if (message) {
        candidates.push(message, message['sender'], message['contact'], message['participant'], message['user'], message['profile']);
        const nestedMessage = isRecord(message['message']) ? message['message'] : null;
        if (nestedMessage) {
            candidates.push(nestedMessage);
        }
        const contextInfo = isRecord(message['contextInfo']) ? message['contextInfo'] : null;
        if (contextInfo) {
            candidates.push(contextInfo['participant'], contextInfo['contact'], contextInfo['quotedMessage']);
        }
    }
    for (const candidate of candidates) {
        const avatar = extractAvatarFromValue(candidate);
        if (avatar) {
            return avatar;
        }
    }
    return undefined;
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
function extractMediaCandidate(source) {
    const url = readUrl(source['mediaUrl']) ??
        readUrl(source['downloadUrl']) ??
        readUrl(source['fileUrl']) ??
        readUrl(source['directUrl']) ??
        readUrl(source['url']) ??
        readUrl(source['imageUrl']) ??
        readUrl(source['previewUrl']) ??
        readUrl(source['streamUrl']);
    if (!url) {
        return null;
    }
    const name = readString(source['fileName']) ??
        readString(source['filename']) ??
        readString(source['name']) ??
        readString(source['caption']) ??
        readString(source['title']) ??
        readString(source['displayName']);
    const mimeType = readString(source['mimetype']) ??
        readString(source['mimeType']) ??
        readString(source['contentType']);
    return { url, name, mimeType };
}
function extractAttachmentCandidates(payload) {
    const candidates = [];
    const urls = new Set();
    const visited = new Set();
    function pushCandidate(value) {
        if (!value || visited.has(value)) {
            return;
        }
        if (Array.isArray(value)) {
            visited.add(value);
            for (const item of value) {
                pushCandidate(item);
            }
            return;
        }
        if (!isRecord(value)) {
            return;
        }
        visited.add(value);
        const candidate = extractMediaCandidate(value);
        if (candidate && !urls.has(candidate.url)) {
            urls.add(candidate.url);
            candidates.push(candidate);
        }
        for (const key of MEDIA_CONTAINER_KEYS) {
            if (key in value) {
                pushCandidate(value[key]);
            }
        }
        for (const key of MESSAGE_MEDIA_KEYS) {
            if (key in value) {
                pushCandidate(value[key]);
            }
        }
        if ('message' in value) {
            pushCandidate(value['message']);
        }
        if ('contextInfo' in value && isRecord(value['contextInfo'])) {
            const contextInfo = value['contextInfo'];
            pushCandidate(contextInfo['quotedMessage']);
            pushCandidate(contextInfo['message']);
        }
        if ('quotedMessage' in value) {
            pushCandidate(value['quotedMessage']);
        }
    }
    pushCandidate(payload);
    if ('messages' in payload) {
        pushCandidate(payload['messages']);
    }
    if ('data' in payload) {
        pushCandidate(payload['data']);
    }
    return candidates;
}
function deriveAttachments(payload, type, messageId, externalId, conversationId) {
    if (type !== 'image') {
        return undefined;
    }
    const candidates = extractAttachmentCandidates(payload);
    if (candidates.length === 0) {
        return undefined;
    }
    const fallbackLabel = sanitizeFileName(readString(payload['fileName']) ??
        readString(payload['filename']) ??
        readString(payload['caption']) ??
        readString(payload['name'])) ?? 'imagem';
    const baseIdentifierRaw = (typeof messageId === 'string' && messageId.trim() ? messageId.trim() : undefined) ??
        (typeof externalId === 'string' && externalId.trim() ? externalId.trim() : undefined) ??
        readString(payload['messageId']) ??
        readString(payload['id']) ??
        (payload['key'] ? extractKeyId(payload['key']) : undefined) ??
        (conversationId ? `${conversationId}-media` : undefined) ??
        `media-${Date.now()}`;
    const baseIdentifier = baseIdentifierRaw.replace(/\s+/g, '-');
    return candidates.map((candidate, index) => {
        const extension = getMimeExtension(candidate.mimeType);
        const name = buildAttachmentName(candidate.name, fallbackLabel, extension, index + 1, candidates.length);
        return {
            id: `${baseIdentifier}-${index + 1}`,
            type: 'image',
            url: candidate.url,
            name,
        };
    });
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
    const contactAvatar = deriveContactAvatar(record) ?? null;
    const attachments = deriveAttachments(record, messageType, messageId, externalId ?? undefined, chatId);
    const content = deriveMessageContent(record, messageType);
    return {
        conversationId: chatId,
        contactIdentifier: chatId,
        contactName,
        contactAvatar,
        content,
        type: messageType,
        timestamp,
        externalId: externalId ?? undefined,
        messageId,
        fromMe,
        sessionId: event.instanceId,
        attachments,
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
                avatar: parsed.contactAvatar ?? undefined,
                metadata: parsed.sessionId ? { session: parsed.sessionId } : undefined,
            });
            const recordInput = {
                id: parsed.messageId,
                externalId: parsed.externalId,
                conversationId: parsed.conversationId,
                content: parsed.content,
                type: parsed.type,
                timestamp: parsed.timestamp,
                attachments: parsed.attachments,
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
