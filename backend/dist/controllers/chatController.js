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
exports.listConversationsHandler = listConversationsHandler;
exports.createConversationHandler = createConversationHandler;
exports.getConversationMessagesHandler = getConversationMessagesHandler;
exports.sendConversationMessageHandler = sendConversationMessageHandler;
exports.updateConversationHandler = updateConversationHandler;
exports.markConversationReadHandler = markConversationReadHandler;
const chatService_1 = __importStar(require("../services/chatService"));
const chatService = new chatService_1.default();
function parseCreateConversationInput(body) {
    if (!body || typeof body !== 'object') {
        throw new chatService_1.ValidationError('Request body must be an object');
    }
    const id = typeof body.id === 'string' ? body.id : undefined;
    const contactIdentifier = typeof body.contactIdentifier === 'string'
        ? body.contactIdentifier
        : typeof body.identifier === 'string'
            ? body.identifier
            : undefined;
    if (!contactIdentifier && !id) {
        throw new chatService_1.ValidationError('contactIdentifier is required');
    }
    const metadata = body.metadata && typeof body.metadata === 'object' ? body.metadata : undefined;
    return {
        id,
        contactIdentifier: contactIdentifier ?? id,
        contactName: typeof body.name === 'string' ? body.name : typeof body.contactName === 'string' ? body.contactName : undefined,
        description: typeof body.description === 'string' ? body.description : undefined,
        shortStatus: typeof body.shortStatus === 'string' ? body.shortStatus : undefined,
        avatar: typeof body.avatar === 'string' ? body.avatar : undefined,
        pinned: typeof body.pinned === 'boolean' ? body.pinned : undefined,
        metadata: metadata ?? undefined,
    };
}
function parseMessageLimit(value) {
    if (typeof value !== 'string') {
        return undefined;
    }
    const parsed = Number.parseInt(value, 10);
    if (Number.isNaN(parsed) || parsed <= 0) {
        return undefined;
    }
    return parsed;
}
function parseSendMessagePayload(body) {
    if (!body || typeof body !== 'object') {
        throw new chatService_1.ValidationError('Request body must be an object');
    }
    const content = typeof body.content === 'string' ? body.content.trim() : '';
    if (!content) {
        throw new chatService_1.ValidationError('Message content is required');
    }
    const type = typeof body.type === 'string' ? body.type : undefined;
    const attachments = Array.isArray(body.attachments) ? body.attachments : undefined;
    return {
        content,
        type,
        attachments,
    };
}
function parseUpdateConversationPayload(body) {
    if (!body || typeof body !== 'object') {
        throw new chatService_1.ValidationError('Request body must be an object');
    }
    const payload = {};
    const has = (key) => Object.prototype.hasOwnProperty.call(body, key);
    if (has('responsibleId')) {
        const value = body.responsibleId;
        if (value === null || value === undefined || (typeof value === 'string' && value.trim() === '')) {
            payload.responsibleId = null;
        }
        else if (typeof value === 'number') {
            if (!Number.isInteger(value)) {
                throw new chatService_1.ValidationError('responsibleId must be an integer');
            }
            payload.responsibleId = value;
        }
        else if (typeof value === 'string') {
            const parsed = Number.parseInt(value, 10);
            if (!Number.isFinite(parsed) || !Number.isInteger(parsed)) {
                throw new chatService_1.ValidationError('responsibleId must be a valid integer');
            }
            payload.responsibleId = parsed;
        }
        else {
            throw new chatService_1.ValidationError('responsibleId must be a string, number or null');
        }
    }
    if (has('tags')) {
        if (!Array.isArray(body.tags)) {
            throw new chatService_1.ValidationError('tags must be an array');
        }
        payload.tags = body.tags.filter((tag) => typeof tag === 'string');
    }
    if (has('phoneNumber')) {
        const value = body.phoneNumber;
        if (value === null || value === undefined) {
            payload.phoneNumber = null;
        }
        else if (typeof value === 'string') {
            payload.phoneNumber = value;
        }
        else {
            throw new chatService_1.ValidationError('phoneNumber must be a string or null');
        }
    }
    if (has('clientName')) {
        const value = body.clientName;
        if (value === null) {
            payload.clientName = null;
        }
        else if (typeof value === 'string') {
            payload.clientName = value;
        }
        else {
            throw new chatService_1.ValidationError('clientName must be a string or null');
        }
    }
    if (has('isLinkedToClient')) {
        if (typeof body.isLinkedToClient !== 'boolean') {
            throw new chatService_1.ValidationError('isLinkedToClient must be a boolean');
        }
        payload.isLinkedToClient = body.isLinkedToClient;
    }
    if (has('customAttributes')) {
        if (!Array.isArray(body.customAttributes)) {
            throw new chatService_1.ValidationError('customAttributes must be an array');
        }
        payload.customAttributes = body.customAttributes.filter((item) => !!item && typeof item === 'object');
    }
    if (has('isPrivate')) {
        if (typeof body.isPrivate !== 'boolean') {
            throw new chatService_1.ValidationError('isPrivate must be a boolean');
        }
        payload.isPrivate = body.isPrivate;
    }
    if (has('internalNotes')) {
        if (!Array.isArray(body.internalNotes)) {
            throw new chatService_1.ValidationError('internalNotes must be an array');
        }
        payload.internalNotes = body.internalNotes.filter((item) => !!item && typeof item === 'object');
    }
    return payload;
}
async function listConversationsHandler(_req, res) {
    try {
        const conversations = await chatService.listConversations();
        res.json(conversations);
    }
    catch (error) {
        console.error('Failed to list conversations', error);
        res.status(500).json({ error: 'Internal server error' });
    }
}
async function createConversationHandler(req, res) {
    try {
        const input = parseCreateConversationInput(req.body);
        const conversation = await chatService.createConversation(input);
        res.status(201).json(conversation);
    }
    catch (error) {
        if (error instanceof chatService_1.ValidationError) {
            return res.status(400).json({ error: error.message });
        }
        console.error('Failed to create conversation', error);
        res.status(500).json({ error: 'Internal server error' });
    }
}
async function getConversationMessagesHandler(req, res) {
    const { conversationId } = req.params;
    try {
        const limit = parseMessageLimit(req.query.limit);
        const cursor = typeof req.query.cursor === 'string' ? req.query.cursor : null;
        const page = await chatService.getMessages(conversationId, cursor, limit ?? undefined);
        res.json(page);
    }
    catch (error) {
        if (error instanceof chatService_1.ValidationError) {
            return res.status(404).json({ error: error.message });
        }
        console.error('Failed to load messages', error);
        res.status(500).json({ error: 'Internal server error' });
    }
}
async function sendConversationMessageHandler(req, res) {
    const { conversationId } = req.params;
    try {
        const payload = parseSendMessagePayload(req.body);
        const message = await chatService.recordOutgoingMessage({
            conversationId,
            content: payload.content,
            type: payload.type,
            attachments: payload.attachments,
        });
        res.status(201).json(message);
    }
    catch (error) {
        if (error instanceof chatService_1.ValidationError) {
            return res.status(400).json({ error: error.message });
        }
        console.error('Failed to record outgoing message', error);
        res.status(500).json({ error: 'Internal server error' });
    }
}
async function updateConversationHandler(req, res) {
    const { conversationId } = req.params;
    try {
        const payload = parseUpdateConversationPayload(req.body);
        const updated = await chatService.updateConversation(conversationId, payload);
        if (!updated) {
            return res.status(404).json({ error: 'Conversation not found' });
        }
        res.json(updated);
    }
    catch (error) {
        if (error instanceof chatService_1.ValidationError) {
            return res.status(400).json({ error: error.message });
        }
        console.error('Failed to update conversation', error);
        res.status(500).json({ error: 'Internal server error' });
    }
}
async function markConversationReadHandler(req, res) {
    const { conversationId } = req.params;
    try {
        const updated = await chatService.markConversationAsRead(conversationId);
        if (!updated) {
            return res.status(404).json({ error: 'Conversation not found' });
        }
        res.status(204).send();
    }
    catch (error) {
        console.error('Failed to mark conversation as read', error);
        res.status(500).json({ error: 'Internal server error' });
    }
}
