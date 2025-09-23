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
exports.createSupportRequest = createSupportRequest;
exports.listSupportRequests = listSupportRequests;
exports.getSupportRequest = getSupportRequest;
exports.listSupportRequestMessages = listSupportRequestMessages;
exports.createSupportRequestMessage = createSupportRequestMessage;
exports.downloadSupportRequestAttachment = downloadSupportRequestAttachment;
exports.updateSupportRequest = updateSupportRequest;
const node_buffer_1 = require("node:buffer");
const supportService_1 = __importStar(require("../services/supportService"));
const supportService = new supportService_1.default();
function parseIdParam(param) {
    const value = Number(param);
    if (!Number.isInteger(value) || value <= 0) {
        return null;
    }
    return value;
}
function extractStatus(value) {
    if (typeof value !== 'string') {
        return undefined;
    }
    const normalized = value.trim().toLowerCase();
    return normalized ? normalized : undefined;
}
function buildContentDisposition(filename) {
    const fallback = filename
        .replace(/["\\\r\n]/g, '_')
        .replace(/[^\x20-\x7E]/g, '_');
    const safeFallback = fallback.length > 0 ? fallback : 'arquivo';
    const encoded = encodeURIComponent(filename);
    return `attachment; filename="${safeFallback}"; filename*=UTF-8''${encoded}`;
}
function parseMessageAttachments(payload) {
    if (!Array.isArray(payload)) {
        return [];
    }
    return payload.map((item, index) => {
        if (!item || typeof item !== 'object') {
            throw new supportService_1.ValidationError(`Attachment at index ${index} is invalid`);
        }
        const { filename, contentType, data, size } = item;
        const normalizedFilename = typeof filename === 'string' ? filename.trim() : '';
        if (!normalizedFilename) {
            throw new supportService_1.ValidationError(`Attachment filename is required (index ${index})`);
        }
        if (typeof data !== 'string' || data.length === 0) {
            throw new supportService_1.ValidationError(`Attachment data is required for "${normalizedFilename}"`);
        }
        const base64Payload = data.includes(',') ? data.slice(data.indexOf(',') + 1) : data;
        let buffer;
        try {
            buffer = node_buffer_1.Buffer.from(base64Payload, 'base64');
        }
        catch (error) {
            throw new supportService_1.ValidationError(`Attachment data for "${normalizedFilename}" is not valid base64`);
        }
        if (buffer.length === 0) {
            throw new supportService_1.ValidationError(`Attachment "${normalizedFilename}" is empty`);
        }
        const attachment = {
            filename: normalizedFilename,
            contentType: typeof contentType === 'string' && contentType.trim().length > 0
                ? contentType.trim()
                : undefined,
            size: typeof size === 'number' && Number.isFinite(size)
                ? Math.max(0, Math.floor(size))
                : buffer.length,
            content: buffer,
        };
        return attachment;
    });
}
function sendAttachmentResponse(res, attachment) {
    const contentType = typeof attachment.contentType === 'string' && attachment.contentType.trim().length > 0
        ? attachment.contentType
        : 'application/octet-stream';
    res.setHeader('Content-Type', contentType);
    const length = attachment.fileSize ?? attachment.content.length;
    if (Number.isFinite(length)) {
        res.setHeader('Content-Length', String(length));
    }
    res.setHeader('Content-Disposition', buildContentDisposition(attachment.filename));
    res.setHeader('Cache-Control', 'private, max-age=0');
    return res.status(200).send(attachment.content);
}
function normalizeEmailValue(value) {
    if (typeof value !== 'string') {
        return null;
    }
    const trimmed = value.trim();
    if (!trimmed) {
        return null;
    }
    return trimmed.toLowerCase();
}
function doesRequestBelongToUser(req, owner) {
    if (!req.auth) {
        return false;
    }
    if (owner.requesterId != null && owner.requesterId === req.auth.userId) {
        return true;
    }
    const authEmail = normalizeEmailValue(req.auth.email);
    const ownerEmail = normalizeEmailValue(owner.requesterEmail);
    return authEmail !== null && ownerEmail !== null && authEmail === ownerEmail;
}
function isSupportManager(req) {
    if (!req.auth) {
        return false;
    }
    if (req.auth.userId === 3) {
        return true;
    }
    const modules = req.auth.modules ?? [];
    return modules.includes('suporte-admin');
}
function resolveAuthDisplayName(req) {
    const tokenName = req.auth?.payload && typeof req.auth.payload.name === 'string'
        ? req.auth.payload.name.trim()
        : '';
    if (tokenName) {
        return tokenName;
    }
    const email = typeof req.auth?.email === 'string' ? req.auth.email.trim() : '';
    return email || null;
}
async function loadRequestOrFail(req, res, requestId) {
    const request = await supportService.findById(requestId);
    if (!request) {
        res.status(404).json({ error: 'Support request not found' });
        return null;
    }
    if (!isSupportManager(req) && !doesRequestBelongToUser(req, request)) {
        res.status(403).json({ error: 'Acesso negado à solicitação de suporte.' });
        return null;
    }
    return request;
}
async function createSupportRequest(req, res) {
    const { subject, description, requesterName, requesterEmail, status } = req.body;
    const input = {
        subject: subject ?? '',
        description: description ?? '',
    };
    if (req.auth) {
        input.requesterId = req.auth.userId;
        const displayName = resolveAuthDisplayName(req);
        if (displayName) {
            input.requesterName = displayName;
        }
        else if (typeof requesterName === 'string') {
            input.requesterName = requesterName;
        }
        const emailFromAuth = typeof req.auth.email === 'string' ? req.auth.email.trim() : '';
        if (emailFromAuth) {
            input.requesterEmail = emailFromAuth;
        }
        else if (typeof requesterEmail === 'string') {
            input.requesterEmail = requesterEmail;
        }
    }
    else {
        if (typeof requesterName === 'string') {
            input.requesterName = requesterName;
        }
        if (typeof requesterEmail === 'string') {
            input.requesterEmail = requesterEmail;
        }
    }
    if (typeof status === 'string' && status.trim()) {
        input.status = status.trim().toLowerCase();
    }
    try {
        const request = await supportService.create(input);
        return res.status(201).json(request);
    }
    catch (error) {
        if (error instanceof supportService_1.ValidationError) {
            return res.status(400).json({ error: error.message });
        }
        console.error('Failed to create support request:', error);
        return res.status(500).json({ error: 'Internal server error' });
    }
}
async function listSupportRequests(req, res) {
    const options = {};
    const pageParam = req.query.page;
    const pageSizeParam = req.query.pageSize ?? req.query.limit; // allow limit alias
    if (typeof pageParam === 'string') {
        const parsed = Number(pageParam);
        if (Number.isFinite(parsed) && parsed > 0) {
            options.page = Math.floor(parsed);
        }
        else {
            return res.status(400).json({ error: 'Invalid page parameter' });
        }
    }
    if (typeof pageSizeParam === 'string') {
        const parsed = Number(pageSizeParam);
        if (Number.isFinite(parsed) && parsed > 0) {
            options.pageSize = Math.floor(parsed);
        }
        else {
            return res.status(400).json({ error: 'Invalid pageSize parameter' });
        }
    }
    const statusFilter = extractStatus(req.query.status);
    if (statusFilter) {
        options.status = statusFilter;
    }
    if (typeof req.query.search === 'string') {
        options.search = req.query.search;
    }
    if (!isSupportManager(req) && req.auth) {
        options.requesterId = req.auth.userId;
        if (typeof req.auth.email === 'string') {
            options.requesterEmail = req.auth.email;
        }
    }
    try {
        const result = await supportService.list(options);
        return res.json(result);
    }
    catch (error) {
        if (error instanceof supportService_1.ValidationError) {
            return res.status(400).json({ error: error.message });
        }
        console.error('Failed to list support requests:', error);
        return res.status(500).json({ error: 'Internal server error' });
    }
}
async function getSupportRequest(req, res) {
    const requestId = parseIdParam(req.params.id);
    if (!requestId) {
        return res.status(400).json({ error: 'Invalid support request id' });
    }
    try {
        const request = await loadRequestOrFail(req, res, requestId);
        if (!request) {
            return;
        }
        return res.json(request);
    }
    catch (error) {
        console.error('Failed to fetch support request:', error);
        return res.status(500).json({ error: 'Internal server error' });
    }
}
async function listSupportRequestMessages(req, res) {
    const requestId = parseIdParam(req.params.id);
    if (!requestId) {
        return res.status(400).json({ error: 'Invalid support request id' });
    }
    try {
        if (!(await loadRequestOrFail(req, res, requestId))) {
            return;
        }
        const messages = await supportService.listMessagesForRequest(requestId);
        if (messages === null) {
            return res.status(404).json({ error: 'Support request not found' });
        }
        return res.json({ items: messages });
    }
    catch (error) {
        console.error('Failed to list support request messages:', error);
        return res.status(500).json({ error: 'Internal server error' });
    }
}
async function createSupportRequestMessage(req, res) {
    const requestId = parseIdParam(req.params.id);
    if (!requestId) {
        return res.status(400).json({ error: 'Invalid support request id' });
    }
    if (!(await loadRequestOrFail(req, res, requestId))) {
        return;
    }
    const manager = isSupportManager(req);
    const { message, sender } = req.body;
    let attachments = [];
    try {
        attachments = parseMessageAttachments(req.body.attachments);
    }
    catch (error) {
        if (error instanceof supportService_1.ValidationError) {
            return res.status(400).json({ error: error.message });
        }
        console.error('Failed to parse support message attachments:', error);
        return res.status(500).json({ error: 'Internal server error' });
    }
    const input = {
        message: typeof message === 'string' ? message : undefined,
        attachments,
    };
    if (typeof sender === 'string' && sender.trim()) {
        input.sender = sender.trim().toLowerCase();
    }
    if (input.sender === 'support' && !manager) {
        return res.status(403).json({ error: 'Apenas a equipe de suporte pode enviar mensagens internas.' });
    }
    try {
        let context;
        if (input.sender === 'support' && req.auth) {
            context = { supportAgentId: req.auth.userId };
            const agentName = resolveAuthDisplayName(req);
            if (agentName) {
                context.supportAgentName = agentName;
            }
        }
        const created = await supportService.createMessage(requestId, input, context);
        if (!created) {
            return res.status(404).json({ error: 'Support request not found' });
        }
        return res.status(201).json(created);
    }
    catch (error) {
        if (error instanceof supportService_1.ValidationError) {
            return res.status(400).json({ error: error.message });
        }
        console.error('Failed to create support request message:', error);
        return res.status(500).json({ error: 'Internal server error' });
    }
}
async function downloadSupportRequestAttachment(req, res) {
    const messageId = parseIdParam(req.params.messageId);
    const attachmentId = parseIdParam(req.params.attachmentId);
    if (!messageId || !attachmentId) {
        return res.status(400).json({ error: 'Invalid attachment reference' });
    }
    try {
        const attachment = await supportService.getAttachment(messageId, attachmentId);
        if (!attachment) {
            return res.status(404).json({ error: 'Attachment not found' });
        }
        if (!isSupportManager(req) && !doesRequestBelongToUser(req, attachment)) {
            return res.status(403).json({ error: 'Acesso negado ao anexo solicitado.' });
        }
        return sendAttachmentResponse(res, attachment);
    }
    catch (error) {
        console.error('Failed to download support attachment:', error);
        return res.status(500).json({ error: 'Internal server error' });
    }
}
async function updateSupportRequest(req, res) {
    const requestId = parseIdParam(req.params.id);
    if (!requestId) {
        return res.status(400).json({ error: 'Invalid support request id' });
    }
    const { subject, description, requesterName, requesterEmail, status } = req.body;
    const updates = {};
    if (subject !== undefined) {
        updates.subject = subject;
    }
    if (description !== undefined) {
        updates.description = description;
    }
    if (requesterName !== undefined) {
        updates.requesterName = requesterName;
    }
    if (requesterEmail !== undefined) {
        updates.requesterEmail = requesterEmail;
    }
    if (typeof status === 'string' && status.trim()) {
        updates.status = status.trim().toLowerCase();
    }
    try {
        const existingRequest = await loadRequestOrFail(req, res, requestId);
        if (!existingRequest) {
            return;
        }
        const manager = isSupportManager(req);
        if (!manager) {
            const unauthorizedFieldPresent = updates.subject !== undefined ||
                updates.description !== undefined ||
                updates.requesterName !== undefined ||
                updates.requesterEmail !== undefined ||
                updates.supportAgentId !== undefined ||
                updates.supportAgentName !== undefined;
            if (unauthorizedFieldPresent) {
                return res.status(403).json({ error: 'Você não tem permissão para atualizar esta solicitação.' });
            }
            if (updates.status === undefined) {
                return res.status(400).json({ error: 'Status é obrigatório para atualizar a solicitação.' });
            }
            if (updates.status !== 'cancelled') {
                return res.status(400).json({ error: 'Somente é possível cancelar a solicitação.' });
            }
        }
        else if (updates.status && req.auth) {
            if (updates.status === 'in_progress' || updates.status === 'resolved') {
                updates.supportAgentId = req.auth.userId;
                const agentName = resolveAuthDisplayName(req);
                if (agentName) {
                    updates.supportAgentName = agentName;
                }
            }
        }
        const updated = await supportService.update(requestId, updates);
        if (!updated) {
            return res.status(404).json({ error: 'Support request not found' });
        }
        return res.json(updated);
    }
    catch (error) {
        if (error instanceof supportService_1.ValidationError) {
            return res.status(400).json({ error: error.message });
        }
        console.error('Failed to update support request:', error);
        return res.status(500).json({ error: 'Internal server error' });
    }
}
