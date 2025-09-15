"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.updateNotificationPreferencesHandler = exports.getNotificationPreferencesHandler = exports.getUnreadCountHandler = exports.deleteNotificationHandler = exports.markAllNotificationsAsReadHandler = exports.markNotificationAsUnreadHandler = exports.markNotificationAsReadHandler = exports.createNotificationHandler = exports.getNotificationHandler = exports.listNotificationsHandler = void 0;
const notificationService_1 = require("../services/notificationService");
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
function parseLimit(value) {
    if (typeof value !== 'string' || value.trim() === '') {
        return undefined;
    }
    const parsed = Number.parseInt(value, 10);
    return Number.isNaN(parsed) ? undefined : parsed;
}
const listNotificationsHandler = (req, res) => {
    try {
        const userId = resolveUserId(req);
        const onlyUnread = parseBoolean(req.query.onlyUnread);
        const limit = parseLimit(req.query.limit);
        const category = typeof req.query.category === 'string' ? req.query.category : undefined;
        const notifications = (0, notificationService_1.listNotifications)(userId, {
            onlyUnread: onlyUnread === undefined ? undefined : onlyUnread,
            category,
            limit,
        });
        res.json(notifications);
    }
    catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Internal server error' });
    }
};
exports.listNotificationsHandler = listNotificationsHandler;
const getNotificationHandler = (req, res) => {
    try {
        const userId = resolveUserId(req);
        const { id } = req.params;
        const notification = (0, notificationService_1.getNotification)(userId, id);
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
const createNotificationHandler = (req, res) => {
    try {
        const { userId, title, message, category, type, metadata, actionUrl } = req.body ?? {};
        if (typeof userId !== 'string' || userId.trim() === '') {
            return res.status(400).json({ error: 'userId is required' });
        }
        if (!title || !message || !category) {
            return res.status(400).json({ error: 'title, message and category are required' });
        }
        const notification = (0, notificationService_1.createNotification)({
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
const markNotificationAsReadHandler = (req, res) => {
    try {
        const userId = resolveUserId(req);
        const { id } = req.params;
        const notification = (0, notificationService_1.markNotificationAsRead)(userId, id);
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
const markNotificationAsUnreadHandler = (req, res) => {
    try {
        const userId = resolveUserId(req);
        const { id } = req.params;
        const notification = (0, notificationService_1.markNotificationAsUnread)(userId, id);
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
const markAllNotificationsAsReadHandler = (req, res) => {
    try {
        const userId = resolveUserId(req);
        const notifications = (0, notificationService_1.markAllNotificationsAsRead)(userId);
        res.json({ updated: notifications.length, notifications });
    }
    catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Internal server error' });
    }
};
exports.markAllNotificationsAsReadHandler = markAllNotificationsAsReadHandler;
const deleteNotificationHandler = (req, res) => {
    try {
        const userId = resolveUserId(req);
        const { id } = req.params;
        (0, notificationService_1.deleteNotification)(userId, id);
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
const getUnreadCountHandler = (req, res) => {
    try {
        const userId = resolveUserId(req);
        const unread = (0, notificationService_1.getUnreadCount)(userId);
        res.json({ unread });
    }
    catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Internal server error' });
    }
};
exports.getUnreadCountHandler = getUnreadCountHandler;
const getNotificationPreferencesHandler = (req, res) => {
    try {
        const userId = resolveUserId(req);
        const preferences = (0, notificationService_1.getNotificationPreferences)(userId);
        res.json(preferences);
    }
    catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Internal server error' });
    }
};
exports.getNotificationPreferencesHandler = getNotificationPreferencesHandler;
const updateNotificationPreferencesHandler = (req, res) => {
    try {
        const { userId, ...updates } = req.body ?? {};
        if (typeof userId !== 'string' || userId.trim() === '') {
            return res.status(400).json({ error: 'userId is required' });
        }
        if (updates === null || typeof updates !== 'object') {
            return res.status(400).json({ error: 'Request body must contain preference updates' });
        }
        const updated = (0, notificationService_1.updateNotificationPreferences)(userId, updates);
        res.json(updated);
    }
    catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Internal server error' });
    }
};
exports.updateNotificationPreferencesHandler = updateNotificationPreferencesHandler;
