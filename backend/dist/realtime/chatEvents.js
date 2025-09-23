"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.updateTypingState = exports.publishMessageStatusUpdate = exports.publishConversationRead = exports.publishMessageCreated = exports.publishConversationUpdate = exports.streamConversations = void 0;
const clients = new Set();
const typingState = new Map();
let nextClientId = 1;
const KEEP_ALIVE_INTERVAL = 25000;
const TYPING_IDLE_TIMEOUT = 6000;
const safeJson = (payload) => {
    try {
        return JSON.stringify(payload ?? {});
    }
    catch (error) {
        console.warn('Failed to serialize SSE payload', error);
        return '{}';
    }
};
const writeEvent = (client, event) => {
    const chunks = [`event: ${event.event}`];
    if (event.data !== undefined) {
        const serialized = safeJson(event.data).split(/\n/);
        for (const line of serialized) {
            chunks.push(`data: ${line}`);
        }
    }
    chunks.push('\n');
    try {
        client.response.write(chunks.join('\n'));
    }
    catch (error) {
        console.warn('Failed to write SSE event, dropping connection', error);
        removeClient(client);
    }
};
const removeClient = (client) => {
    if (!clients.has(client)) {
        return;
    }
    clients.delete(client);
    try {
        clearInterval(client.keepAliveTimer);
    }
    catch (error) {
        console.warn('Failed to clear SSE keep-alive timer', error);
    }
    try {
        client.response.end();
    }
    catch (error) {
        console.warn('Failed to gracefully terminate SSE response', error);
    }
};
const registerClient = (req, res, userId, userName) => {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');
    res.flushHeaders?.();
    const connection = {
        id: nextClientId++,
        userId,
        userName,
        response: res,
        keepAliveTimer: setInterval(() => {
            writeEvent(connection, { event: 'ping', data: { ts: Date.now() } });
        }, KEEP_ALIVE_INTERVAL),
    };
    clients.add(connection);
    writeEvent(connection, {
        event: 'connection',
        data: { userId: String(userId), userName },
    });
    req.on('close', () => {
        removeClient(connection);
    });
};
const broadcastEvent = (event, options) => {
    if (clients.size === 0) {
        return;
    }
    for (const client of clients) {
        if (options?.excludeUserId && client.userId === options.excludeUserId) {
            continue;
        }
        writeEvent(client, event);
    }
};
const cleanupTypingEntry = (conversationId, userId) => {
    const conversationTimers = typingState.get(conversationId);
    if (!conversationTimers) {
        return;
    }
    const entry = conversationTimers.get(userId);
    if (entry) {
        clearTimeout(entry.timeout);
    }
    conversationTimers.delete(userId);
    if (conversationTimers.size === 0) {
        typingState.delete(conversationId);
    }
};
const scheduleTypingTimeout = (conversationId, userId, userName) => {
    let conversationTimers = typingState.get(conversationId);
    if (!conversationTimers) {
        conversationTimers = new Map();
        typingState.set(conversationId, conversationTimers);
    }
    const timeout = setTimeout(() => {
        conversationTimers?.delete(userId);
        if (conversationTimers && conversationTimers.size === 0) {
            typingState.delete(conversationId);
        }
        broadcastEvent({
            event: 'typing',
            data: {
                conversationId,
                userId: String(userId),
                userName,
                isTyping: false,
                timeout: true,
            },
        });
    }, TYPING_IDLE_TIMEOUT);
    conversationTimers.set(userId, { timeout, userName });
};
const streamConversations = (req, res) => {
    if (!req.auth) {
        res.status(401).json({ error: 'Token inválido.' });
        return;
    }
    const payload = (req.auth.payload ?? {});
    const userName = typeof payload.name === 'string' && payload.name.trim().length > 0
        ? payload.name.trim()
        : undefined;
    registerClient(req, res, req.auth.userId, userName);
};
exports.streamConversations = streamConversations;
const publishConversationUpdate = (conversation) => {
    const payload = {
        id: conversation.id,
        name: conversation.name,
        avatar: conversation.avatar,
        shortStatus: conversation.shortStatus,
        description: conversation.description,
        unreadCount: conversation.unreadCount,
        pinned: conversation.pinned,
        lastMessage: conversation.lastMessage,
        phoneNumber: conversation.phoneNumber,
        responsible: conversation.responsible,
        tags: conversation.tags,
        isLinkedToClient: conversation.isLinkedToClient,
        clientId: conversation.clientId,
        clientName: conversation.clientName,
        customAttributes: conversation.customAttributes,
        isPrivate: conversation.isPrivate,
        internalNotes: conversation.internalNotes,
    };
    broadcastEvent({ event: 'conversation:update', data: payload });
};
exports.publishConversationUpdate = publishConversationUpdate;
const publishMessageCreated = (message, options) => {
    broadcastEvent({
        event: 'message:new',
        data: { conversationId: message.conversationId, message },
    }, options);
};
exports.publishMessageCreated = publishMessageCreated;
const publishConversationRead = (conversationId, userId) => {
    broadcastEvent({
        event: 'conversation:read',
        data: {
            conversationId,
            userId: userId ? String(userId) : undefined,
        },
    });
};
exports.publishConversationRead = publishConversationRead;
const publishMessageStatusUpdate = (update) => {
    broadcastEvent({
        event: 'message:status',
        data: update,
    });
};
exports.publishMessageStatusUpdate = publishMessageStatusUpdate;
const updateTypingState = (conversationId, userId, userName, isTyping) => {
    const normalizedConversationId = conversationId.trim();
    if (!normalizedConversationId) {
        return;
    }
    cleanupTypingEntry(normalizedConversationId, userId);
    if (isTyping) {
        scheduleTypingTimeout(normalizedConversationId, userId, userName);
    }
    broadcastEvent({
        event: 'typing',
        data: {
            conversationId: normalizedConversationId,
            userId: String(userId),
            userName,
            isTyping,
        },
    }, { excludeUserId: userId });
};
exports.updateTypingState = updateTypingState;
