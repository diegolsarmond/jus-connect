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
exports.markConversationReadHandler = markConversationReadHandler;
exports.wahaWebhookHandler = wahaWebhookHandler;
const chatService_1 = __importStar(require("../services/chatService"));
const wahaIntegrationService_1 = __importStar(require("../services/wahaIntegrationService"));
const wahaConfigService_1 = __importStar(require("../services/wahaConfigService"));
const chatService = new chatService_1.default();
const wahaConfigService = new wahaConfigService_1.default();
const wahaIntegration = new wahaIntegrationService_1.default(chatService, wahaConfigService);
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
        const message = await wahaIntegration.sendMessage(conversationId, payload);
        res.status(201).json(message);
    }
    catch (error) {
        if (error instanceof chatService_1.ValidationError) {
            return res.status(400).json({ error: error.message });
        }
        if (error instanceof wahaIntegrationService_1.IntegrationNotConfiguredError) {
            return res.status(503).json({ error: error.message });
        }
        console.error('Failed to send message through WAHA', error);
        res.status(502).json({ error: 'Failed to deliver message to provider' });
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
async function wahaWebhookHandler(req, res) {
    try {
        await wahaIntegration.handleWebhook(req.body, req.headers);
        res.status(204).send();
    }
    catch (error) {
        if (error instanceof wahaIntegrationService_1.WebhookAuthorizationError) {
            return res.status(401).json({ error: error.message });
        }
        if (error instanceof wahaIntegrationService_1.IntegrationNotConfiguredError) {
            return res.status(503).json({ error: error.message });
        }
        if (error instanceof wahaConfigService_1.ValidationError || error instanceof chatService_1.ValidationError) {
            return res.status(400).json({ error: error.message });
        }
        console.error('Failed to process WAHA webhook', error);
        res.status(500).json({ error: 'Internal server error' });
    }
}
