import type { QueryResultRow } from 'pg';
import pool from './db';

export type NotificationType = 'info' | 'success' | 'warning' | 'error';

export interface Notification {
  id: string;
  userId: string;
  title: string;
  message: string;
  category: string;
  type: NotificationType;
  read: boolean;
  createdAt: string;
  readAt?: string;
  actionUrl?: string;
  metadata?: Record<string, unknown>;
}

export interface ListNotificationsOptions {
  onlyUnread?: boolean;
  category?: string;
  limit?: number;
  offset?: number;
}

export interface CreateNotificationInput {
  userId: string;
  title: string;
  message: string;
  category: string;
  type?: NotificationType;
  metadata?: Record<string, unknown>;
  actionUrl?: string;
}

export interface NotificationPreferences {
  email: {
    newMessages: boolean;
    appointments: boolean;
    deadlines: boolean;
    systemUpdates: boolean;
    securityAlerts: boolean;
    teamActivity: boolean;
  };
  push: {
    newMessages: boolean;
    appointments: boolean;
    deadlines: boolean;
    securityAlerts: boolean;
  };
  sms: {
    appointments: boolean;
    securityAlerts: boolean;
    emergencyOnly: boolean;
  };
  frequency: {
    emailDigest: string;
    reminderTiming: string;
  };
}

type DeepPartial<T> = {
  [P in keyof T]?: T[P] extends Record<string, unknown> ? DeepPartial<T[P]> : T[P];
};

export type NotificationPreferenceUpdates = DeepPartial<NotificationPreferences>;

export class NotificationNotFoundError extends Error {
  constructor(message = 'Notification not found') {
    super(message);
    this.name = 'NotificationNotFoundError';
  }
}

type Queryable = {
  query: (
    text: string,
    params?: unknown[],
  ) => Promise<{ rows: QueryResultRow[]; rowCount: number }>;
};

interface NotificationRow extends QueryResultRow {
  id: number;
  user_id: string;
  category: string;
  type: NotificationType;
  title: string;
  message: string;
  metadata: Record<string, unknown> | null;
  action_url: string | null;
  read: boolean;
  created_at: Date | string;
  read_at: Date | string | null;
}

interface PreferenceRow extends QueryResultRow {
  preferences: NotificationPreferences;
}

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

let database: Queryable = pool;

function ensureStringDate(value: Date | string | null | undefined): string | undefined {
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

function formatNotificationId(id: number): string {
  return `ntf-${id}`;
}

function parseNotificationId(value: string): number | null {
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

function mapNotificationRow(row: NotificationRow): Notification {
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

function createDefaultPreferences(): NotificationPreferences {
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

function mergePreferences(
  base: NotificationPreferences,
  updates: NotificationPreferenceUpdates,
): NotificationPreferences {
  const merged: NotificationPreferences = {
    email: { ...base.email },
    push: { ...base.push },
    sms: { ...base.sms },
    frequency: { ...base.frequency },
  };

  if (updates.email) {
    for (const [key, value] of Object.entries(updates.email)) {
      if (typeof value === 'boolean') {
        (merged.email as Record<string, boolean>)[key] = value;
      }
    }
  }

  if (updates.push) {
    for (const [key, value] of Object.entries(updates.push)) {
      if (typeof value === 'boolean') {
        (merged.push as Record<string, boolean>)[key] = value;
      }
    }
  }

  if (updates.sms) {
    for (const [key, value] of Object.entries(updates.sms)) {
      if (typeof value === 'boolean') {
        (merged.sms as Record<string, boolean>)[key] = value;
      }
    }
  }

  if (updates.frequency) {
    for (const [key, value] of Object.entries(updates.frequency)) {
      if (typeof value === 'string') {
        (merged.frequency as Record<string, string>)[key] = value;
      }
    }
  }

  return merged;
}

export function __setNotificationDb(queryable: Queryable): void {
  database = queryable;
}

export async function listNotifications(
  userId: string,
  options: ListNotificationsOptions = {},
): Promise<Notification[]> {
  const conditions: string[] = ['user_id = $1'];
  const params: unknown[] = [userId];

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

  const result = await database.query(
    `SELECT ${NOTIFICATION_COLUMNS}
       FROM notifications
      ${whereClause}
      ORDER BY created_at DESC, id DESC${limitClause}`,
    params,
  );

  return result.rows.map((row) => mapNotificationRow(row as NotificationRow));
}

export async function getNotification(userId: string, notificationId: string): Promise<Notification> {
  const numericId = parseNotificationId(notificationId);

  if (!numericId) {
    throw new NotificationNotFoundError();
  }

  const result = await database.query(
    `SELECT ${NOTIFICATION_COLUMNS}
       FROM notifications
      WHERE id = $1
        AND user_id = $2
      LIMIT 1`,
    [numericId, userId],
  );

  if (result.rowCount === 0) {
    throw new NotificationNotFoundError();
  }

  return mapNotificationRow(result.rows[0] as NotificationRow);
}

export async function createNotification(input: CreateNotificationInput): Promise<Notification> {
  const { userId, title, message, category, metadata, actionUrl } = input;
  const type = input.type ?? 'info';

  if (!userId) {
    throw new Error('userId is required');
  }

  if (!title || !message || !category) {
    throw new Error('title, message and category are required');
  }

  const result = await database.query(
    `INSERT INTO notifications (
       user_id,
       category,
       type,
       title,
       message,
       metadata,
       action_url
     )
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     RETURNING ${NOTIFICATION_COLUMNS}`,
    [userId, category, type, title, message, metadata ?? null, actionUrl ?? null],
  );

  return mapNotificationRow(result.rows[0] as NotificationRow);
}

export async function markNotificationAsRead(
  userId: string,
  notificationId: string,
): Promise<Notification> {
  const numericId = parseNotificationId(notificationId);

  if (!numericId) {
    throw new NotificationNotFoundError();
  }

  const result = await database.query(
    `UPDATE notifications
        SET read = TRUE,
            read_at = COALESCE(read_at, NOW())
      WHERE id = $1
        AND user_id = $2
      RETURNING ${NOTIFICATION_COLUMNS}`,
    [numericId, userId],
  );

  if (result.rowCount === 0) {
    throw new NotificationNotFoundError();
  }

  return mapNotificationRow(result.rows[0] as NotificationRow);
}

export async function markNotificationAsUnread(
  userId: string,
  notificationId: string,
): Promise<Notification> {
  const numericId = parseNotificationId(notificationId);

  if (!numericId) {
    throw new NotificationNotFoundError();
  }

  const result = await database.query(
    `UPDATE notifications
        SET read = FALSE,
            read_at = NULL
      WHERE id = $1
        AND user_id = $2
      RETURNING ${NOTIFICATION_COLUMNS}`,
    [numericId, userId],
  );

  if (result.rowCount === 0) {
    throw new NotificationNotFoundError();
  }

  return mapNotificationRow(result.rows[0] as NotificationRow);
}

export async function markAllNotificationsAsRead(userId: string): Promise<Notification[]> {
  await database.query(
    `UPDATE notifications
        SET read = TRUE,
            read_at = COALESCE(read_at, NOW())
      WHERE user_id = $1
        AND read IS FALSE`,
    [userId],
  );

  const result = await database.query(
    `SELECT ${NOTIFICATION_COLUMNS}
       FROM notifications
      WHERE user_id = $1
      ORDER BY created_at DESC, id DESC`,
    [userId],
  );

  return result.rows.map((row) => mapNotificationRow(row as NotificationRow));
}

export async function deleteNotification(
  userId: string,
  notificationId: string,
): Promise<void> {
  const numericId = parseNotificationId(notificationId);

  if (!numericId) {
    throw new NotificationNotFoundError();
  }

  const result = await database.query(
    'DELETE FROM notifications WHERE id = $1 AND user_id = $2',
    [numericId, userId],
  );

  if (result.rowCount === 0) {
    throw new NotificationNotFoundError();
  }
}

export async function getUnreadCount(
  userId: string,
  options: { category?: string } = {},
): Promise<number> {
  const params: unknown[] = [userId];
  const conditions: string[] = ['user_id = $1', 'read IS FALSE'];

  if (options.category) {
    params.push(options.category);
    conditions.push(`category = $${params.length}`);
  }

  const result = await database.query(
    `SELECT COUNT(*)::int AS count
       FROM notifications
      WHERE ${conditions.join(' AND ')}`,
    params,
  );

  const countValue = result.rows[0]?.count;
  return typeof countValue === 'number'
    ? countValue
    : Number.parseInt(String(countValue ?? '0'), 10) || 0;
}

export async function getUnreadCountByCategory(userId: string): Promise<Record<string, number>> {
  const result = await database.query(
    `SELECT category, COUNT(*)::int AS count
       FROM notifications
      WHERE user_id = $1
        AND read IS FALSE
      GROUP BY category`,
    [userId],
  );

  const counts: Record<string, number> = {};
  for (const row of result.rows) {
    const category = String((row as { category?: unknown }).category ?? '');
    const countValue = (row as { count?: unknown }).count;
    const numericCount = typeof countValue === 'number'
      ? countValue
      : Number.parseInt(String(countValue ?? '0'), 10) || 0;
    counts[category] = numericCount;
  }

  return counts;
}

export async function getNotificationPreferences(userId: string): Promise<NotificationPreferences> {
  const result = await database.query(
    'SELECT preferences FROM notification_preferences WHERE user_id = $1',
    [userId],
  );

  if (result.rowCount > 0) {
    return (result.rows[0] as PreferenceRow).preferences;
  }

  const defaults = createDefaultPreferences();
  await database.query(
    'INSERT INTO notification_preferences (user_id, preferences) VALUES ($1, $2) ON CONFLICT (user_id) DO NOTHING',
    [userId, defaults],
  );
  return defaults;
}

export async function updateNotificationPreferences(
  userId: string,
  updates: NotificationPreferenceUpdates,
): Promise<NotificationPreferences> {
  const current = await getNotificationPreferences(userId);
  const merged = mergePreferences(current, updates);

  await database.query(
    'UPDATE notification_preferences SET preferences = $2 WHERE user_id = $1',
    [userId, merged],
  );

  return merged;
}

export async function clearNotifications(userId?: string): Promise<void> {
  if (userId) {
    await database.query('DELETE FROM notifications WHERE user_id = $1', [userId]);
    return;
  }

  await database.query('DELETE FROM notifications');
}

export async function clearPreferences(userId?: string): Promise<void> {
  if (userId) {
    await database.query('DELETE FROM notification_preferences WHERE user_id = $1', [userId]);
    return;
  }

  await database.query('DELETE FROM notification_preferences');
}

export async function __resetNotificationState(): Promise<void> {
  await database.query('TRUNCATE notifications RESTART IDENTITY');
  await database.query('TRUNCATE notification_preferences RESTART IDENTITY');
}

