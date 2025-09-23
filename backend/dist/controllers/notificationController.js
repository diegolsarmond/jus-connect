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
exports.triggerProjudiSyncHandler = exports.receivePjeNotificationHandler = exports.updateNotificationPreferencesHandler = exports.getNotificationPreferencesHandler = exports.getUnreadCountHandler = exports.deleteNotificationHandler = exports.markAllNotificationsAsReadHandler = exports.markNotificationAsUnreadHandler = exports.markNotificationAsReadHandler = exports.createNotificationHandler = exports.getNotificationHandler = exports.listNotificationsHandler = void 0;
const notificationService_1 = require("../services/notificationService");
const pjeNotificationService_1 = __importStar(require("../services/pjeNotificationService"));
const cronJobs_1 = __importDefault(require("../services/cronJobs"));
const projudiNotificationService_1 = require("../services/projudiNotificationService");
function resolveUserId(req) {
    const queryUserId = typeof req.query.userId === 'string' ? req.query.userId : undefined;
    const body = req.body ?? {};
    const bodyUserId = typeof body.userId === 'string' ? body.userId : undefined;
    return queryUserId || bodyUserId || 'default';
}
function parseBoolean(value) {
    if (typeof value !== 'string') {
        return undefined;
    }
    const normalized = value.trim().toLowerCase();
    if (['true', '1', 'yes', 'y'].includes(normalized)) {
        return true;
    }
    if (['false', '0', 'no', 'n'].includes(normalized)) {
        return false;
    }
    return undefined;
}
function parsePositiveInteger(value) {
    if (typeof value !== 'string' || value.trim() === '') {
        return undefined;
    }
    const parsed = Number.parseInt(value, 10);
    return Number.isNaN(parsed) || parsed <= 0 ? undefined : parsed;
}
const listNotificationsHandler = async (req, res) => {
    try {
        const userId = resolveUserId(req);
        const onlyUnread = parseBoolean(req.query.onlyUnread);
        const limit = parsePositiveInteger(req.query.limit) ?? parsePositiveInteger(req.query.pageSize);
        const offsetParam = parsePositiveInteger(req.query.offset);
        const page = parsePositiveInteger(req.query.page);
        const category = typeof req.query.category === 'string' ? req.query.category : undefined;
        const offset = (() => {
            if (typeof offsetParam === 'number') {
                return offsetParam;
            }
            if (typeof page === 'number' && typeof limit === 'number') {
                return (page - 1) * limit;
            }
            return undefined;
        })();
        const notifications = await (0, notificationService_1.listNotifications)(userId, {
            onlyUnread: onlyUnread === undefined ? undefined : onlyUnread,
            category,
            limit,
            offset,
        });
        res.json(notifications);
    }
    catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Internal server error' });
    }
};
exports.listNotificationsHandler = listNotificationsHandler;
const getNotificationHandler = async (req, res) => {
    try {
        const userId = resolveUserId(req);
        const { id } = req.params;
        const notification = await (0, notificationService_1.getNotification)(userId, id);
        res.json(notification);
    }
    catch (error) {
        if (error instanceof notificationService_1.NotificationNotFoundError) {
            return res.status(404).json({ error: error.message });
        }
        console.error(error);
        res.status(500).json({ error: 'Internal server error' });
    }
};
exports.getNotificationHandler = getNotificationHandler;
const createNotificationHandler = async (req, res) => {
    try {
        const { userId, title, message, category, type, metadata, actionUrl } = req.body ?? {};
        if (typeof userId !== 'string' || userId.trim() === '') {
            return res.status(400).json({ error: 'userId is required' });
        }
        if (!title || !message || !category) {
            return res.status(400).json({ error: 'title, message and category are required' });
        }
        const notification = await (0, notificationService_1.createNotification)({
            userId,
            title,
            message,
            category,
            type: type,
            metadata,
            actionUrl,
        });
        res.status(201).json(notification);
    }
    catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Internal server error' });
    }
};
exports.createNotificationHandler = createNotificationHandler;
const markNotificationAsReadHandler = async (req, res) => {
    try {
        const userId = resolveUserId(req);
        const { id } = req.params;
        const notification = await (0, notificationService_1.markNotificationAsRead)(userId, id);
        res.json(notification);
    }
    catch (error) {
        if (error instanceof notificationService_1.NotificationNotFoundError) {
            return res.status(404).json({ error: error.message });
        }
        console.error(error);
        res.status(500).json({ error: 'Internal server error' });
    }
};
exports.markNotificationAsReadHandler = markNotificationAsReadHandler;
const markNotificationAsUnreadHandler = async (req, res) => {
    try {
        const userId = resolveUserId(req);
        const { id } = req.params;
        const notification = await (0, notificationService_1.markNotificationAsUnread)(userId, id);
        res.json(notification);
    }
    catch (error) {
        if (error instanceof notificationService_1.NotificationNotFoundError) {
            return res.status(404).json({ error: error.message });
        }
        console.error(error);
        res.status(500).json({ error: 'Internal server error' });
    }
};
exports.markNotificationAsUnreadHandler = markNotificationAsUnreadHandler;
const markAllNotificationsAsReadHandler = async (req, res) => {
    try {
        const userId = resolveUserId(req);
        const notifications = await (0, notificationService_1.markAllNotificationsAsRead)(userId);
        res.json({ updated: notifications.length, notifications });
    }
    catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Internal server error' });
    }
};
exports.markAllNotificationsAsReadHandler = markAllNotificationsAsReadHandler;
const deleteNotificationHandler = async (req, res) => {
    try {
        const userId = resolveUserId(req);
        const { id } = req.params;
        await (0, notificationService_1.deleteNotification)(userId, id);
        res.status(204).send();
    }
    catch (error) {
        if (error instanceof notificationService_1.NotificationNotFoundError) {
            return res.status(404).json({ error: error.message });
        }
        console.error(error);
        res.status(500).json({ error: 'Internal server error' });
    }
};
exports.deleteNotificationHandler = deleteNotificationHandler;
const getUnreadCountHandler = async (req, res) => {
    try {
        const userId = resolveUserId(req);
        const category = typeof req.query.category === 'string' ? req.query.category : undefined;
        const groupBy = typeof req.query.groupBy === 'string' ? req.query.groupBy.toLowerCase() : undefined;
        if (groupBy === 'category') {
            const counts = await (0, notificationService_1.getUnreadCountByCategory)(userId);
            return res.json({ counts });
        }
        const unread = await (0, notificationService_1.getUnreadCount)(userId, { category });
        res.json({ unread, category: category ?? null });
    }
    catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Internal server error' });
    }
};
exports.getUnreadCountHandler = getUnreadCountHandler;
const getNotificationPreferencesHandler = async (req, res) => {
    try {
        const userId = resolveUserId(req);
        const preferences = await (0, notificationService_1.getNotificationPreferences)(userId);
        res.json(preferences);
    }
    catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Internal server error' });
    }
};
exports.getNotificationPreferencesHandler = getNotificationPreferencesHandler;
const updateNotificationPreferencesHandler = async (req, res) => {
    try {
        const { userId, ...updates } = req.body ?? {};
        if (typeof userId !== 'string' || userId.trim() === '') {
            return res.status(400).json({ error: 'userId is required' });
        }
        if (updates === null || typeof updates !== 'object') {
            return res.status(400).json({ error: 'Request body must contain preference updates' });
        }
        const updated = await (0, notificationService_1.updateNotificationPreferences)(userId, updates);
        res.json(updated);
    }
    catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Internal server error' });
    }
};
exports.updateNotificationPreferencesHandler = updateNotificationPreferencesHandler;
function pickHeaderValue(header) {
    if (typeof header === 'string') {
        return header;
    }
    if (Array.isArray(header) && header.length > 0) {
        return header[0];
    }
    return undefined;
}
const receivePjeNotificationHandler = async (req, res) => {
    const signatureHeaderNames = [
        'x-pje-signature',
        'x-hub-signature-256',
        'x-hub-signature',
        'x-signature',
    ];
    let signature;
    for (const headerName of signatureHeaderNames) {
        const value = pickHeaderValue(req.headers[headerName]);
        if (value && value.trim()) {
            signature = value;
            break;
        }
    }
    const deliveryId = pickHeaderValue(req.headers['x-delivery-id'])
        ?? pickHeaderValue(req.headers['x-request-id'])
        ?? pickHeaderValue(req.headers['x-correlation-id']);
    try {
        const record = await pjeNotificationService_1.default.processIncomingNotification({
            payload: req.body,
            signature,
            deliveryId,
            headers: req.headers,
        });
        res.status(202).json({ received: true, id: record.id });
    }
    catch (error) {
        if (error instanceof pjeNotificationService_1.PjeWebhookSignatureError) {
            return res.status(401).json({ error: error.message });
        }
        if (error instanceof pjeNotificationService_1.PjeConfigurationError) {
            return res.status(500).json({ error: error.message });
        }
        console.error('Failed to process PJE notification', error);
        res.status(500).json({ error: 'Falha ao processar notificação do PJE' });
    }
};
exports.receivePjeNotificationHandler = receivePjeNotificationHandler;
const triggerProjudiSyncHandler = async (req, res) => {
    try {
        const previewRequested = typeof req.query.preview === 'string'
            && ['true', '1', 'yes'].includes(req.query.preview.toLowerCase());
        if (previewRequested) {
            const status = cronJobs_1.default.getProjudiSyncStatus();
            return res.json({ triggered: false, status });
        }
        const result = await cronJobs_1.default.triggerProjudiSyncNow();
        res.json({ triggered: result.triggered, status: result.status });
    }
    catch (error) {
        if (error instanceof projudiNotificationService_1.ProjudiConfigurationError) {
            return res.status(400).json({ error: error.message });
        }
        console.error('Failed to trigger Projudi sync job', error);
        res.status(500).json({ error: 'Falha ao sincronizar intimações do Projudi' });
    }
};
exports.triggerProjudiSyncHandler = triggerProjudiSyncHandler;
