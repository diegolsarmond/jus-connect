"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.NotificationNotFoundError = void 0;
exports.__setNotificationDb = __setNotificationDb;
exports.listNotifications = listNotifications;
exports.getNotification = getNotification;
exports.createNotification = createNotification;
exports.markNotificationAsRead = markNotificationAsRead;
exports.markNotificationAsUnread = markNotificationAsUnread;
exports.markAllNotificationsAsRead = markAllNotificationsAsRead;
exports.deleteNotification = deleteNotification;
exports.getUnreadCount = getUnreadCount;
exports.getUnreadCountByCategory = getUnreadCountByCategory;
exports.getNotificationPreferences = getNotificationPreferences;
exports.updateNotificationPreferences = updateNotificationPreferences;
exports.clearNotifications = clearNotifications;
exports.clearPreferences = clearPreferences;
exports.__resetNotificationState = __resetNotificationState;
const db_1 = __importDefault(require("./db"));
class NotificationNotFoundError extends Error {
    constructor(message = 'Notification not found') {
        super(message);
        this.name = 'NotificationNotFoundError';
    }
}
exports.NotificationNotFoundError = NotificationNotFoundError;
const NOTIFICATION_COLUMNS = `
  id,
  user_id,
  category,
  type,
  title,
  message,
  metadata,
  action_url,
  read,
  created_at,
  read_at
`;
let database = db_1.default;
function ensureStringDate(value) {
    if (!value) {
        return undefined;
    }
    if (value instanceof Date) {
        return value.toISOString();
    }
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) {
        return undefined;
    }
    return parsed.toISOString();
}
function formatNotificationId(id) {
    return `ntf-${id}`;
}
function parseNotificationId(value) {
    if (!value) {
        return null;
    }
    const trimmed = value.trim();
    const match = trimmed.match(/^ntf-(\d+)$/i);
    if (match) {
        return Number.parseInt(match[1] ?? '', 10);
    }
    const parsed = Number.parseInt(trimmed, 10);
    return Number.isFinite(parsed) ? parsed : null;
}
function mapNotificationRow(row) {
    return {
        id: formatNotificationId(Number(row.id)),
        userId: row.user_id,
        category: row.category,
        type: row.type ?? 'info',
        title: row.title,
        message: row.message,
        metadata: row.metadata ?? undefined,
        actionUrl: row.action_url ?? undefined,
        read: Boolean(row.read),
        createdAt: ensureStringDate(row.created_at) ?? new Date().toISOString(),
        readAt: ensureStringDate(row.read_at) ?? undefined,
    };
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
function mergePreferences(base, updates) {
    const merged = {
        email: { ...base.email },
        push: { ...base.push },
        sms: { ...base.sms },
        frequency: { ...base.frequency },
    };
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
function __setNotificationDb(queryable) {
    database = queryable;
}
async function listNotifications(userId, options = {}) {
    const conditions = ['user_id = $1'];
    const params = [userId];
    if (options.category) {
        conditions.push(`category = $${params.length + 1}`);
        params.push(options.category);
    }
    if (options.onlyUnread) {
        conditions.push('read IS FALSE');
    }
    let limitClause = '';
    if (typeof options.limit === 'number' && options.limit >= 0) {
        params.push(options.limit);
        limitClause += ` LIMIT $${params.length}`;
    }
    if (typeof options.offset === 'number' && options.offset > 0) {
        params.push(options.offset);
        limitClause += ` OFFSET $${params.length}`;
    }
    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    const result = await database.query(`SELECT ${NOTIFICATION_COLUMNS}
       FROM notifications
      ${whereClause}
      ORDER BY created_at DESC, id DESC${limitClause}`, params);
    return result.rows.map((row) => mapNotificationRow(row));
}
async function getNotification(userId, notificationId) {
    const numericId = parseNotificationId(notificationId);
    if (!numericId) {
        throw new NotificationNotFoundError();
    }
    const result = await database.query(`SELECT ${NOTIFICATION_COLUMNS}
       FROM notifications
      WHERE id = $1
        AND user_id = $2
      LIMIT 1`, [numericId, userId]);
    if (result.rowCount === 0) {
        throw new NotificationNotFoundError();
    }
    return mapNotificationRow(result.rows[0]);
}
async function createNotification(input) {
    const { userId, title, message, category, metadata, actionUrl } = input;
    const type = input.type ?? 'info';
    if (!userId) {
        throw new Error('userId is required');
    }
    if (!title || !message || !category) {
        throw new Error('title, message and category are required');
    }
    const result = await database.query(`INSERT INTO notifications (
       user_id,
       category,
       type,
       title,
       message,
       metadata,
       action_url
     )
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     RETURNING ${NOTIFICATION_COLUMNS}`, [userId, category, type, title, message, metadata ?? null, actionUrl ?? null]);
    return mapNotificationRow(result.rows[0]);
}
async function markNotificationAsRead(userId, notificationId) {
    const numericId = parseNotificationId(notificationId);
    if (!numericId) {
        throw new NotificationNotFoundError();
    }
    const result = await database.query(`UPDATE notifications
        SET read = TRUE,
            read_at = COALESCE(read_at, NOW())
      WHERE id = $1
        AND user_id = $2
      RETURNING ${NOTIFICATION_COLUMNS}`, [numericId, userId]);
    if (result.rowCount === 0) {
        throw new NotificationNotFoundError();
    }
    return mapNotificationRow(result.rows[0]);
}
async function markNotificationAsUnread(userId, notificationId) {
    const numericId = parseNotificationId(notificationId);
    if (!numericId) {
        throw new NotificationNotFoundError();
    }
    const result = await database.query(`UPDATE notifications
        SET read = FALSE,
            read_at = NULL
      WHERE id = $1
        AND user_id = $2
      RETURNING ${NOTIFICATION_COLUMNS}`, [numericId, userId]);
    if (result.rowCount === 0) {
        throw new NotificationNotFoundError();
    }
    return mapNotificationRow(result.rows[0]);
}
async function markAllNotificationsAsRead(userId) {
    await database.query(`UPDATE notifications
        SET read = TRUE,
            read_at = COALESCE(read_at, NOW())
      WHERE user_id = $1
        AND read IS FALSE`, [userId]);
    const result = await database.query(`SELECT ${NOTIFICATION_COLUMNS}
       FROM notifications
      WHERE user_id = $1
      ORDER BY created_at DESC, id DESC`, [userId]);
    return result.rows.map((row) => mapNotificationRow(row));
}
async function deleteNotification(userId, notificationId) {
    const numericId = parseNotificationId(notificationId);
    if (!numericId) {
        throw new NotificationNotFoundError();
    }
    const result = await database.query('DELETE FROM notifications WHERE id = $1 AND user_id = $2', [numericId, userId]);
    if (result.rowCount === 0) {
        throw new NotificationNotFoundError();
    }
}
async function getUnreadCount(userId, options = {}) {
    const params = [userId];
    const conditions = ['user_id = $1', 'read IS FALSE'];
    if (options.category) {
        params.push(options.category);
        conditions.push(`category = $${params.length}`);
    }
    const result = await database.query(`SELECT COUNT(*)::int AS count
       FROM notifications
      WHERE ${conditions.join(' AND ')}`, params);
    const countValue = result.rows[0]?.count;
    return typeof countValue === 'number'
        ? countValue
        : Number.parseInt(String(countValue ?? '0'), 10) || 0;
}
async function getUnreadCountByCategory(userId) {
    const result = await database.query(`SELECT category, COUNT(*)::int AS count
       FROM notifications
      WHERE user_id = $1
        AND read IS FALSE
      GROUP BY category`, [userId]);
    const counts = {};
    for (const row of result.rows) {
        const category = String(row.category ?? '');
        const countValue = row.count;
        const numericCount = typeof countValue === 'number'
            ? countValue
            : Number.parseInt(String(countValue ?? '0'), 10) || 0;
        counts[category] = numericCount;
    }
    return counts;
}
async function getNotificationPreferences(userId) {
    const result = await database.query('SELECT preferences FROM notification_preferences WHERE user_id = $1', [userId]);
    if (result.rowCount > 0) {
        return result.rows[0].preferences;
    }
    const defaults = createDefaultPreferences();
    await database.query('INSERT INTO notification_preferences (user_id, preferences) VALUES ($1, $2) ON CONFLICT (user_id) DO NOTHING', [userId, defaults]);
    return defaults;
}
async function updateNotificationPreferences(userId, updates) {
    const current = await getNotificationPreferences(userId);
    const merged = mergePreferences(current, updates);
    await database.query('UPDATE notification_preferences SET preferences = $2 WHERE user_id = $1', [userId, merged]);
    return merged;
}
async function clearNotifications(userId) {
    if (userId) {
        await database.query('DELETE FROM notifications WHERE user_id = $1', [userId]);
        return;
    }
    await database.query('DELETE FROM notifications');
}
async function clearPreferences(userId) {
    if (userId) {
        await database.query('DELETE FROM notification_preferences WHERE user_id = $1', [userId]);
        return;
    }
    await database.query('DELETE FROM notification_preferences');
}
async function __resetNotificationState() {
    await database.query('TRUNCATE notifications RESTART IDENTITY');
    await database.query('TRUNCATE notification_preferences RESTART IDENTITY');
}
