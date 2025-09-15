import { Request, Response } from 'express';
import {
  listNotifications,
  getNotification,
  createNotification,
  markNotificationAsRead,
  markNotificationAsUnread,
  markAllNotificationsAsRead,
  deleteNotification,
  getUnreadCount,
  getNotificationPreferences,
  updateNotificationPreferences,
  NotificationNotFoundError,
  NotificationPreferenceUpdates,
  NotificationType,
} from '../services/notificationService';

function resolveUserId(req: Request): string {
  const queryUserId = typeof req.query.userId === 'string' ? req.query.userId : undefined;
  const body = req.body ?? {};
  const bodyUserId = typeof body.userId === 'string' ? body.userId : undefined;
  return queryUserId || bodyUserId || 'default';
}

function parseBoolean(value: unknown): boolean | undefined {
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

function parseLimit(value: unknown): number | undefined {
  if (typeof value !== 'string' || value.trim() === '') {
    return undefined;
  }

  const parsed = Number.parseInt(value, 10);
  return Number.isNaN(parsed) ? undefined : parsed;
}

export const listNotificationsHandler = (req: Request, res: Response) => {
  try {
    const userId = resolveUserId(req);
    const onlyUnread = parseBoolean(req.query.onlyUnread);
    const limit = parseLimit(req.query.limit);
    const category = typeof req.query.category === 'string' ? req.query.category : undefined;

    const notifications = listNotifications(userId, {
      onlyUnread: onlyUnread === undefined ? undefined : onlyUnread,
      category,
      limit,
    });

    res.json(notifications);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const getNotificationHandler = (req: Request, res: Response) => {
  try {
    const userId = resolveUserId(req);
    const { id } = req.params;
    const notification = getNotification(userId, id);
    res.json(notification);
  } catch (error) {
    if (error instanceof NotificationNotFoundError) {
      return res.status(404).json({ error: error.message });
    }

    console.error(error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const createNotificationHandler = (req: Request, res: Response) => {
  try {
    const { userId, title, message, category, type, metadata, actionUrl } = req.body ?? {};

    if (typeof userId !== 'string' || userId.trim() === '') {
      return res.status(400).json({ error: 'userId is required' });
    }

    if (!title || !message || !category) {
      return res.status(400).json({ error: 'title, message and category are required' });
    }

    const notification = createNotification({
      userId,
      title,
      message,
      category,
      type: type as NotificationType | undefined,
      metadata,
      actionUrl,
    });

    res.status(201).json(notification);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const markNotificationAsReadHandler = (req: Request, res: Response) => {
  try {
    const userId = resolveUserId(req);
    const { id } = req.params;
    const notification = markNotificationAsRead(userId, id);
    res.json(notification);
  } catch (error) {
    if (error instanceof NotificationNotFoundError) {
      return res.status(404).json({ error: error.message });
    }

    console.error(error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const markNotificationAsUnreadHandler = (req: Request, res: Response) => {
  try {
    const userId = resolveUserId(req);
    const { id } = req.params;
    const notification = markNotificationAsUnread(userId, id);
    res.json(notification);
  } catch (error) {
    if (error instanceof NotificationNotFoundError) {
      return res.status(404).json({ error: error.message });
    }

    console.error(error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const markAllNotificationsAsReadHandler = (req: Request, res: Response) => {
  try {
    const userId = resolveUserId(req);
    const notifications = markAllNotificationsAsRead(userId);
    res.json({ updated: notifications.length, notifications });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const deleteNotificationHandler = (req: Request, res: Response) => {
  try {
    const userId = resolveUserId(req);
    const { id } = req.params;
    deleteNotification(userId, id);
    res.status(204).send();
  } catch (error) {
    if (error instanceof NotificationNotFoundError) {
      return res.status(404).json({ error: error.message });
    }

    console.error(error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const getUnreadCountHandler = (req: Request, res: Response) => {
  try {
    const userId = resolveUserId(req);
    const unread = getUnreadCount(userId);
    res.json({ unread });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const getNotificationPreferencesHandler = (req: Request, res: Response) => {
  try {
    const userId = resolveUserId(req);
    const preferences = getNotificationPreferences(userId);
    res.json(preferences);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const updateNotificationPreferencesHandler = (req: Request, res: Response) => {
  try {
    const { userId, ...updates } = req.body ?? {};

    if (typeof userId !== 'string' || userId.trim() === '') {
      return res.status(400).json({ error: 'userId is required' });
    }

    if (updates === null || typeof updates !== 'object') {
      return res.status(400).json({ error: 'Request body must contain preference updates' });
    }

    const updated = updateNotificationPreferences(userId, updates as NotificationPreferenceUpdates);
    res.json(updated);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

