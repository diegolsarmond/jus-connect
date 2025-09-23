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
  getUnreadCountByCategory,
  getNotificationPreferences,
  updateNotificationPreferences,
  NotificationNotFoundError,
  NotificationPreferenceUpdates,
  NotificationType,
} from '../services/notificationService';
import pjeNotificationService, {
  PjeConfigurationError,
  PjeWebhookSignatureError,
} from '../services/pjeNotificationService';
import cronJobs from '../services/cronJobs';
import { ProjudiConfigurationError } from '../services/projudiNotificationService';

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

function parsePositiveInteger(value: unknown): number | undefined {
  if (typeof value !== 'string' || value.trim() === '') {
    return undefined;
  }

  const parsed = Number.parseInt(value, 10);
  return Number.isNaN(parsed) || parsed <= 0 ? undefined : parsed;
}

export const listNotificationsHandler = async (req: Request, res: Response) => {
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

    const notifications = await listNotifications(userId, {
      onlyUnread: onlyUnread === undefined ? undefined : onlyUnread,
      category,
      limit,
      offset,
    });

    res.json(notifications);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const getNotificationHandler = async (req: Request, res: Response) => {
  try {
    const userId = resolveUserId(req);
    const { id } = req.params;
    const notification = await getNotification(userId, id);
    res.json(notification);
  } catch (error) {
    if (error instanceof NotificationNotFoundError) {
      return res.status(404).json({ error: error.message });
    }

    console.error(error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const createNotificationHandler = async (req: Request, res: Response) => {
  try {
    const { userId, title, message, category, type, metadata, actionUrl } = req.body ?? {};

    if (typeof userId !== 'string' || userId.trim() === '') {
      return res.status(400).json({ error: 'userId is required' });
    }

    if (!title || !message || !category) {
      return res.status(400).json({ error: 'title, message and category are required' });
    }

    const notification = await createNotification({
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

export const markNotificationAsReadHandler = async (req: Request, res: Response) => {
  try {
    const userId = resolveUserId(req);
    const { id } = req.params;
    const notification = await markNotificationAsRead(userId, id);
    res.json(notification);
  } catch (error) {
    if (error instanceof NotificationNotFoundError) {
      return res.status(404).json({ error: error.message });
    }

    console.error(error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const markNotificationAsUnreadHandler = async (req: Request, res: Response) => {
  try {
    const userId = resolveUserId(req);
    const { id } = req.params;
    const notification = await markNotificationAsUnread(userId, id);
    res.json(notification);
  } catch (error) {
    if (error instanceof NotificationNotFoundError) {
      return res.status(404).json({ error: error.message });
    }

    console.error(error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const markAllNotificationsAsReadHandler = async (req: Request, res: Response) => {
  try {
    const userId = resolveUserId(req);
    const notifications = await markAllNotificationsAsRead(userId);
    res.json({ updated: notifications.length, notifications });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const deleteNotificationHandler = async (req: Request, res: Response) => {
  try {
    const userId = resolveUserId(req);
    const { id } = req.params;
    await deleteNotification(userId, id);
    res.status(204).send();
  } catch (error) {
    if (error instanceof NotificationNotFoundError) {
      return res.status(404).json({ error: error.message });
    }

    console.error(error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const getUnreadCountHandler = async (req: Request, res: Response) => {
  try {
    const userId = resolveUserId(req);
    const category = typeof req.query.category === 'string' ? req.query.category : undefined;
    const groupBy = typeof req.query.groupBy === 'string' ? req.query.groupBy.toLowerCase() : undefined;

    if (groupBy === 'category') {
      const counts = await getUnreadCountByCategory(userId);
      return res.json({ counts });
    }

    const unread = await getUnreadCount(userId, { category });
    res.json({ unread, category: category ?? null });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const getNotificationPreferencesHandler = async (req: Request, res: Response) => {
  try {
    const userId = resolveUserId(req);
    const preferences = await getNotificationPreferences(userId);
    res.json(preferences);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const updateNotificationPreferencesHandler = async (req: Request, res: Response) => {
  try {
    const { userId, ...updates } = req.body ?? {};

    if (typeof userId !== 'string' || userId.trim() === '') {
      return res.status(400).json({ error: 'userId is required' });
    }

    if (updates === null || typeof updates !== 'object') {
      return res.status(400).json({ error: 'Request body must contain preference updates' });
    }

    const updated = await updateNotificationPreferences(userId, updates as NotificationPreferenceUpdates);
    res.json(updated);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

function pickHeaderValue(header: string | string[] | undefined): string | undefined {
  if (typeof header === 'string') {
    return header;
  }
  if (Array.isArray(header) && header.length > 0) {
    return header[0];
  }
  return undefined;
}

export const receivePjeNotificationHandler = async (req: Request, res: Response) => {
  const signatureHeaderNames = [
    'x-pje-signature',
    'x-hub-signature-256',
    'x-hub-signature',
    'x-signature',
  ] as const;

  let signature: string | undefined;
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
    const record = await pjeNotificationService.processIncomingNotification({
      payload: req.body,
      signature,
      deliveryId,
      headers: req.headers,
    });

    res.status(202).json({ received: true, id: record.id });
  } catch (error) {
    if (error instanceof PjeWebhookSignatureError) {
      return res.status(401).json({ error: error.message });
    }

    if (error instanceof PjeConfigurationError) {
      return res.status(500).json({ error: error.message });
    }

    console.error('Failed to process PJE notification', error);
    res.status(500).json({ error: 'Falha ao processar notificação do PJE' });
  }
};

export const triggerProjudiSyncHandler = async (req: Request, res: Response) => {
  try {
    const previewRequested = typeof req.query.preview === 'string'
      && ['true', '1', 'yes'].includes(req.query.preview.toLowerCase());

    if (previewRequested) {
      const status = cronJobs.getProjudiSyncStatus();
      return res.json({ triggered: false, status });
    }

    const result = await cronJobs.triggerProjudiSyncNow();
    res.json({ triggered: result.triggered, status: result.status });
  } catch (error) {
    if (error instanceof ProjudiConfigurationError) {
      return res.status(400).json({ error: error.message });
    }

    console.error('Failed to trigger Projudi sync job', error);
    res.status(500).json({ error: 'Falha ao sincronizar intimações do Projudi' });
  }
};

