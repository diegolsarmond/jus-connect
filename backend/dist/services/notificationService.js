"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.NotificationNotFoundError = void 0;
exports.listNotifications = listNotifications;
exports.getNotification = getNotification;
exports.createNotification = createNotification;
exports.markNotificationAsRead = markNotificationAsRead;
exports.markNotificationAsUnread = markNotificationAsUnread;
exports.markAllNotificationsAsRead = markAllNotificationsAsRead;
exports.deleteNotification = deleteNotification;
exports.getUnreadCount = getUnreadCount;
exports.getNotificationPreferences = getNotificationPreferences;
exports.updateNotificationPreferences = updateNotificationPreferences;
exports.clearNotifications = clearNotifications;
exports.clearPreferences = clearPreferences;
exports.__resetNotificationState = __resetNotificationState;
class NotificationNotFoundError extends Error {
    constructor(message = 'Notification not found') {
        super(message);
        this.name = 'NotificationNotFoundError';
    }
}
exports.NotificationNotFoundError = NotificationNotFoundError;
const notificationsStore = new Map();
const preferenceStore = new Map();
let notificationIdCounter = 1;
function nextNotificationId() {
    return `ntf-${notificationIdCounter++}`;
}
function createDefaultPreferences() {
    return {
        email: {
            newMessages: true,
            appointments: true,
            deadlines: true,
            systemUpdates: false,
            securityAlerts: true,
            teamActivity: true,
        },
        push: {
            newMessages: true,
            appointments: true,
            deadlines: true,
            securityAlerts: true,
        },
        sms: {
            appointments: false,
            securityAlerts: true,
            emergencyOnly: true,
        },
        frequency: {
            emailDigest: 'daily',
            reminderTiming: '1hour',
        },
    };
}
function getOrCreateNotificationList(userId) {
    let notifications = notificationsStore.get(userId);
    if (!notifications) {
        notifications = [];
        notificationsStore.set(userId, notifications);
    }
    return notifications;
}
function getOrCreatePreferences(userId) {
    let preferences = preferenceStore.get(userId);
    if (!preferences) {
        preferences = createDefaultPreferences();
        preferenceStore.set(userId, preferences);
    }
    return preferences;
}
function cloneNotification(notification) {
    return {
        ...notification,
        metadata: notification.metadata ? { ...notification.metadata } : undefined,
    };
}
function cloneNotificationList(notifications) {
    return notifications.map(cloneNotification);
}
function clonePreferences(preferences) {
    return {
        email: { ...preferences.email },
        push: { ...preferences.push },
        sms: { ...preferences.sms },
        frequency: { ...preferences.frequency },
    };
}
function mergePreferences(base, updates) {
    const merged = clonePreferences(base);
    if (updates.email) {
        for (const [key, value] of Object.entries(updates.email)) {
            if (typeof value === 'boolean') {
                merged.email[key] = value;
            }
        }
    }
    if (updates.push) {
        for (const [key, value] of Object.entries(updates.push)) {
            if (typeof value === 'boolean') {
                merged.push[key] = value;
            }
        }
    }
    if (updates.sms) {
        for (const [key, value] of Object.entries(updates.sms)) {
            if (typeof value === 'boolean') {
                merged.sms[key] = value;
            }
        }
    }
    if (updates.frequency) {
        for (const [key, value] of Object.entries(updates.frequency)) {
            if (typeof value === 'string') {
                merged.frequency[key] = value;
            }
        }
    }
    return merged;
}
function listNotifications(userId, options = {}) {
    const notifications = getOrCreateNotificationList(userId);
    let result = notifications;
    if (options.category) {
        result = result.filter((notification) => notification.category === options.category);
    }
    if (options.onlyUnread) {
        result = result.filter((notification) => !notification.read);
    }
    if (typeof options.limit === 'number') {
        result = result.slice(0, Math.max(options.limit, 0));
    }
    return cloneNotificationList(result);
}
function getNotification(userId, notificationId) {
    const notifications = getOrCreateNotificationList(userId);
    const notification = notifications.find((item) => item.id === notificationId);
    if (!notification) {
        throw new NotificationNotFoundError();
    }
    return cloneNotification(notification);
}
function createNotification(input) {
    const { userId, title, message, category, metadata, actionUrl } = input;
    const type = input.type ?? 'info';
    if (!userId) {
        throw new Error('userId is required');
    }
    if (!title || !message || !category) {
        throw new Error('title, message and category are required');
    }
    const notifications = getOrCreateNotificationList(userId);
    const notification = {
        id: nextNotificationId(),
        userId,
        title,
        message,
        category,
        type,
        read: false,
        createdAt: new Date().toISOString(),
        actionUrl,
        metadata: metadata ? { ...metadata } : undefined,
    };
    notifications.unshift(notification);
    return cloneNotification(notification);
}
function markNotificationAsRead(userId, notificationId) {
    const notifications = getOrCreateNotificationList(userId);
    const notification = notifications.find((item) => item.id === notificationId);
    if (!notification) {
        throw new NotificationNotFoundError();
    }
    if (!notification.read) {
        notification.read = true;
        notification.readAt = new Date().toISOString();
    }
    return cloneNotification(notification);
}
function markNotificationAsUnread(userId, notificationId) {
    const notifications = getOrCreateNotificationList(userId);
    const notification = notifications.find((item) => item.id === notificationId);
    if (!notification) {
        throw new NotificationNotFoundError();
    }
    if (notification.read) {
        notification.read = false;
        delete notification.readAt;
    }
    return cloneNotification(notification);
}
function markAllNotificationsAsRead(userId) {
    const notifications = getOrCreateNotificationList(userId);
    const timestamp = new Date().toISOString();
    notifications.forEach((notification) => {
        if (!notification.read) {
            notification.read = true;
            notification.readAt = timestamp;
        }
    });
    return cloneNotificationList(notifications);
}
function deleteNotification(userId, notificationId) {
    const notifications = getOrCreateNotificationList(userId);
    const index = notifications.findIndex((item) => item.id === notificationId);
    if (index === -1) {
        throw new NotificationNotFoundError();
    }
    notifications.splice(index, 1);
}
function getUnreadCount(userId) {
    const notifications = getOrCreateNotificationList(userId);
    return notifications.reduce((total, notification) => total + (notification.read ? 0 : 1), 0);
}
function getNotificationPreferences(userId) {
    const preferences = getOrCreatePreferences(userId);
    return clonePreferences(preferences);
}
function updateNotificationPreferences(userId, updates) {
    const current = getOrCreatePreferences(userId);
    const merged = mergePreferences(current, updates);
    preferenceStore.set(userId, merged);
    return clonePreferences(merged);
}
function clearNotifications(userId) {
    if (userId) {
        notificationsStore.delete(userId);
        return;
    }
    notificationsStore.clear();
    notificationIdCounter = 1;
}
function clearPreferences(userId) {
    if (userId) {
        preferenceStore.delete(userId);
        return;
    }
    preferenceStore.clear();
}
function __resetNotificationState() {
    clearNotifications();
    clearPreferences();
}
