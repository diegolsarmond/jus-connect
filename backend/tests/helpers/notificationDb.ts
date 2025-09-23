import { __setNotificationDb } from '../../src/services/notificationService';
import type { NotificationPreferences } from '../../src/services/notificationService';

type QueryResultRow = Record<string, unknown>;

type QueryResult = { rows: QueryResultRow[]; rowCount: number };

type Queryable = { query: (text: string, params?: unknown[]) => Promise<QueryResult> };

interface StoredNotification {
  id: number;
  user_id: string;
  category: string;
  type: string;
  title: string;
  message: string;
  metadata: Record<string, unknown> | null;
  action_url: string | null;
  read: boolean;
  created_at: Date;
  read_at: Date | null;
}

interface StoredPreference {
  user_id: string;
  preferences: NotificationPreferences;
  created_at: Date;
  updated_at: Date;
}

class InMemoryNotificationDb implements Queryable {
  private notifications: StoredNotification[] = [];
  private preferences = new Map<string, StoredPreference>();
  private notificationSequence = 1;

  async query(text: string, params: unknown[] = []): Promise<QueryResult> {
    const trimmed = text.trim();

    if (trimmed.startsWith('SELECT COUNT(*)')) {
      return this.countNotifications(trimmed, params);
    }

    if (trimmed.startsWith('SELECT category, COUNT(*)')) {
      return this.groupUnreadByCategory(params);
    }

    if (trimmed.startsWith('INSERT INTO notifications')) {
      return this.insertNotification(params);
    }

    if (trimmed.startsWith('SELECT') && trimmed.includes('FROM notifications')) {
      return this.selectNotifications(trimmed, params);
    }

    if (
      trimmed.startsWith('UPDATE notifications') &&
      trimmed.includes('SET read = TRUE') &&
      trimmed.includes('WHERE id = $1') &&
      trimmed.includes('user_id = $2')
    ) {
      return this.markNotificationRead(params);
    }

    if (
      trimmed.startsWith('UPDATE notifications') &&
      trimmed.includes('SET read = FALSE') &&
      trimmed.includes('WHERE id = $1') &&
      trimmed.includes('user_id = $2')
    ) {
      return this.markNotificationUnread(params);
    }

    if (trimmed.startsWith('UPDATE notifications') && trimmed.includes('WHERE user_id = $1') && trimmed.includes('SET read = TRUE')) {
      return this.markAllRead(params);
    }

    if (trimmed.startsWith('DELETE FROM notifications WHERE id = $1 AND user_id = $2')) {
      return this.deleteNotificationById(params);
    }

    if (trimmed.startsWith('DELETE FROM notifications WHERE user_id = $1')) {
      return this.deleteNotificationsByUser(params);
    }

    if (trimmed === 'DELETE FROM notifications') {
      return this.deleteAllNotifications();
    }

    if (trimmed.startsWith('INSERT INTO notification_preferences')) {
      return this.insertPreferences(params);
    }

    if (trimmed.startsWith('SELECT preferences FROM notification_preferences')) {
      return this.selectPreferences(params);
    }

    if (trimmed.startsWith('UPDATE notification_preferences')) {
      return this.updatePreferences(params);
    }

    if (trimmed.startsWith('DELETE FROM notification_preferences WHERE user_id = $1')) {
      return this.deletePreferencesByUser(params);
    }

    if (trimmed === 'DELETE FROM notification_preferences') {
      this.preferences.clear();
      return { rows: [], rowCount: 0 };
    }

    if (trimmed.startsWith('TRUNCATE notifications')) {
      this.notifications = [];
      this.notificationSequence = 1;
      return { rows: [], rowCount: 0 };
    }

    if (trimmed.startsWith('TRUNCATE notification_preferences')) {
      this.preferences.clear();
      return { rows: [], rowCount: 0 };
    }

    throw new Error(`Unsupported query: ${trimmed}`);
  }

  private insertNotification(params: unknown[]): QueryResult {
    const [userId, category, type, title, message, metadata, actionUrl] = params as [
      string,
      string,
      string,
      string,
      string,
      Record<string, unknown> | null,
      string | null,
    ];

    const record: StoredNotification = {
      id: this.notificationSequence++,
      user_id: userId,
      category,
      type,
      title,
      message,
      metadata: metadata ? { ...metadata } : null,
      action_url: actionUrl ?? null,
      read: false,
      created_at: new Date(),
      read_at: null,
    };

    this.notifications.unshift(record);
    return { rows: [this.toRow(record)], rowCount: 1 };
  }

  private selectNotifications(text: string, params: unknown[]): QueryResult {
    const userId = params[0] as string;
    let category: string | undefined;
    let limit: number | undefined;
    let offset: number | undefined;

    let paramIndex = 1;
    if (text.includes('category = $')) {
      category = params[paramIndex] as string;
      paramIndex += 1;
    }

    if (text.includes('LIMIT $')) {
      limit = params[paramIndex] as number;
      paramIndex += 1;
    }

    if (text.includes('OFFSET $')) {
      offset = params[paramIndex] as number;
    }

    const onlyUnread = text.includes('read IS FALSE');

    let rows = this.notifications.filter((item) => item.user_id === userId);

    if (category) {
      rows = rows.filter((item) => item.category === category);
    }

    if (onlyUnread) {
      rows = rows.filter((item) => !item.read);
    }

    rows = [...rows].sort((a, b) => {
      const createdDiff = b.created_at.getTime() - a.created_at.getTime();
      if (createdDiff !== 0) {
        return createdDiff;
      }
      return b.id - a.id;
    });

    if (typeof offset === 'number' && offset > 0) {
      rows = rows.slice(offset);
    }

    if (typeof limit === 'number' && limit >= 0) {
      rows = rows.slice(0, limit);
    }

    return { rows: rows.map((row) => this.toRow(row)), rowCount: rows.length };
  }

  private markNotificationRead(params: unknown[]): QueryResult {
    const [idValue, userId] = params as [number, string];
    const record = this.notifications.find((item) => item.id === idValue && item.user_id === userId);
    if (!record) {
      return { rows: [], rowCount: 0 };
    }

    if (!record.read) {
      record.read = true;
      record.read_at = record.read_at ?? new Date();
    }

    return { rows: [this.toRow(record)], rowCount: 1 };
  }

  private markNotificationUnread(params: unknown[]): QueryResult {
    const [idValue, userId] = params as [number, string];
    const record = this.notifications.find((item) => item.id === idValue && item.user_id === userId);
    if (!record) {
      return { rows: [], rowCount: 0 };
    }

    record.read = false;
    record.read_at = null;

    return { rows: [this.toRow(record)], rowCount: 1 };
  }

  private markAllRead(params: unknown[]): QueryResult {
    const [userId] = params as [string];
    let updated = 0;
    for (const record of this.notifications) {
      if (record.user_id === userId && !record.read) {
        record.read = true;
        record.read_at = record.read_at ?? new Date();
        updated += 1;
      }
    }
    return { rows: [], rowCount: updated };
  }

  private deleteNotificationById(params: unknown[]): QueryResult {
    const [idValue, userId] = params as [number, string];
    const initialLength = this.notifications.length;
    this.notifications = this.notifications.filter(
      (item) => !(item.id === idValue && item.user_id === userId),
    );
    const rowCount = initialLength - this.notifications.length;
    return { rows: [], rowCount };
  }

  private deleteNotificationsByUser(params: unknown[]): QueryResult {
    const [userId] = params as [string];
    this.notifications = this.notifications.filter((item) => item.user_id !== userId);
    return { rows: [], rowCount: 0 };
  }

  private deleteAllNotifications(): QueryResult {
    this.notifications = [];
    this.notificationSequence = 1;
    return { rows: [], rowCount: 0 };
  }

  private countNotifications(text: string, params: unknown[]): QueryResult {
    const userId = params[0] as string;
    let category: string | undefined;

    if (text.includes('category = $')) {
      category = params[1] as string;
    }

    const onlyUnread = text.includes('read IS FALSE');

    const total = this.notifications.filter((item) => {
      if (item.user_id !== userId) {
        return false;
      }
      if (category && item.category !== category) {
        return false;
      }
      if (onlyUnread && item.read) {
        return false;
      }
      return true;
    }).length;

    return { rows: [{ count: total }], rowCount: 1 };
  }

  private groupUnreadByCategory(params: unknown[]): QueryResult {
    const userId = params[0] as string;
    const counts = new Map<string, number>();

    for (const notification of this.notifications) {
      if (notification.user_id !== userId || notification.read) {
        continue;
      }
      counts.set(notification.category, (counts.get(notification.category) ?? 0) + 1);
    }

    const rows = Array.from(counts.entries()).map(([category, count]) => ({
      category,
      count,
    }));

    return { rows, rowCount: rows.length };
  }

  private insertPreferences(params: unknown[]): QueryResult {
    const [userId, preferences] = params as [string, NotificationPreferences];

    if (this.preferences.has(userId)) {
      return { rows: [], rowCount: 0 };
    }

    const now = new Date();
    this.preferences.set(userId, {
      user_id: userId,
      preferences: JSON.parse(JSON.stringify(preferences)) as NotificationPreferences,
      created_at: now,
      updated_at: now,
    });

    return { rows: [], rowCount: 1 };
  }

  private selectPreferences(params: unknown[]): QueryResult {
    const [userId] = params as [string];
    const record = this.preferences.get(userId);
    if (!record) {
      return { rows: [], rowCount: 0 };
    }
    return { rows: [{ preferences: record.preferences }], rowCount: 1 };
  }

  private updatePreferences(params: unknown[]): QueryResult {
    const [userId, preferences] = params as [string, NotificationPreferences];
    const record = this.preferences.get(userId);
    if (!record) {
      return { rows: [], rowCount: 0 };
    }
    record.preferences = JSON.parse(JSON.stringify(preferences)) as NotificationPreferences;
    record.updated_at = new Date();
    return { rows: [], rowCount: 1 };
  }

  private deletePreferencesByUser(params: unknown[]): QueryResult {
    const [userId] = params as [string];
    this.preferences.delete(userId);
    return { rows: [], rowCount: 1 };
  }

  private toRow(record: StoredNotification): Record<string, unknown> {
    return {
      id: record.id,
      user_id: record.user_id,
      category: record.category,
      type: record.type,
      title: record.title,
      message: record.message,
      metadata: record.metadata ? { ...record.metadata } : null,
      action_url: record.action_url,
      read: record.read,
      created_at: record.created_at,
      read_at: record.read_at,
    };
  }
}

const inMemoryDb = new InMemoryNotificationDb();
let initialized = false;

export async function initNotificationTestDb(): Promise<void> {
  if (initialized) {
    return;
  }
  __setNotificationDb(inMemoryDb as unknown as Queryable);
  initialized = true;
}
