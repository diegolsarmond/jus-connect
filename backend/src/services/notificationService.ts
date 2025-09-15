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

type InternalNotification = Notification;

const notificationsStore = new Map<string, InternalNotification[]>();
const preferenceStore = new Map<string, NotificationPreferences>();

let notificationIdCounter = 1;

function nextNotificationId(): string {
  return `ntf-${notificationIdCounter++}`;
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

function getOrCreateNotificationList(userId: string): InternalNotification[] {
  let notifications = notificationsStore.get(userId);
  if (!notifications) {
    notifications = [];
    notificationsStore.set(userId, notifications);
  }
  return notifications;
}

function getOrCreatePreferences(userId: string): NotificationPreferences {
  let preferences = preferenceStore.get(userId);
  if (!preferences) {
    preferences = createDefaultPreferences();
    preferenceStore.set(userId, preferences);
  }
  return preferences;
}

function cloneNotification(notification: InternalNotification): Notification {
  return {
    ...notification,
    metadata: notification.metadata ? { ...notification.metadata } : undefined,
  };
}

function cloneNotificationList(notifications: InternalNotification[]): Notification[] {
  return notifications.map(cloneNotification);
}

function clonePreferences(preferences: NotificationPreferences): NotificationPreferences {
  return {
    email: { ...preferences.email },
    push: { ...preferences.push },
    sms: { ...preferences.sms },
    frequency: { ...preferences.frequency },
  };
}

function mergePreferences(
  base: NotificationPreferences,
  updates: NotificationPreferenceUpdates,
): NotificationPreferences {
  const merged = clonePreferences(base);

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

export function listNotifications(
  userId: string,
  options: ListNotificationsOptions = {},
): Notification[] {
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

export function getNotification(userId: string, notificationId: string): Notification {
  const notifications = getOrCreateNotificationList(userId);
  const notification = notifications.find((item) => item.id === notificationId);

  if (!notification) {
    throw new NotificationNotFoundError();
  }

  return cloneNotification(notification);
}

export function createNotification(input: CreateNotificationInput): Notification {
  const { userId, title, message, category, metadata, actionUrl } = input;
  const type = input.type ?? 'info';

  if (!userId) {
    throw new Error('userId is required');
  }

  if (!title || !message || !category) {
    throw new Error('title, message and category are required');
  }

  const notifications = getOrCreateNotificationList(userId);

  const notification: InternalNotification = {
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

export function markNotificationAsRead(
  userId: string,
  notificationId: string,
): Notification {
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

export function markNotificationAsUnread(
  userId: string,
  notificationId: string,
): Notification {
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

export function markAllNotificationsAsRead(userId: string): Notification[] {
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

export function deleteNotification(
  userId: string,
  notificationId: string,
): void {
  const notifications = getOrCreateNotificationList(userId);
  const index = notifications.findIndex((item) => item.id === notificationId);

  if (index === -1) {
    throw new NotificationNotFoundError();
  }

  notifications.splice(index, 1);
}

export function getUnreadCount(userId: string): number {
  const notifications = getOrCreateNotificationList(userId);
  return notifications.reduce((total, notification) => total + (notification.read ? 0 : 1), 0);
}

export function getNotificationPreferences(userId: string): NotificationPreferences {
  const preferences = getOrCreatePreferences(userId);
  return clonePreferences(preferences);
}

export function updateNotificationPreferences(
  userId: string,
  updates: NotificationPreferenceUpdates,
): NotificationPreferences {
  const current = getOrCreatePreferences(userId);
  const merged = mergePreferences(current, updates);
  preferenceStore.set(userId, merged);
  return clonePreferences(merged);
}

export function clearNotifications(userId?: string): void {
  if (userId) {
    notificationsStore.delete(userId);
    return;
  }

  notificationsStore.clear();
  notificationIdCounter = 1;
}

export function clearPreferences(userId?: string): void {
  if (userId) {
    preferenceStore.delete(userId);
    return;
  }

  preferenceStore.clear();
}

export function __resetNotificationState(): void {
  clearNotifications();
  clearPreferences();
}

