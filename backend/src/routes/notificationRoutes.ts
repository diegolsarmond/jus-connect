import { Router } from 'express';
import {
  listNotificationsHandler,
  getNotificationHandler,
  createNotificationHandler,
  markNotificationAsReadHandler,
  markNotificationAsUnreadHandler,
  markAllNotificationsAsReadHandler,
  deleteNotificationHandler,
  getUnreadCountHandler,
  getNotificationPreferencesHandler,
  updateNotificationPreferencesHandler,
  receivePjeNotificationHandler,
  triggerProjudiSyncHandler,
} from '../controllers/notificationController';
import { getNotificationProvider } from '../services/notificationProviders/registry';
import { NotificationProviderError } from '../services/notificationProviders/types';

const router = Router();

router.get('/notifications', listNotificationsHandler);
router.get('/notifications/unread-count', getUnreadCountHandler);
router.get('/notifications/preferences', getNotificationPreferencesHandler);
router.get('/notifications/:id', getNotificationHandler);
router.post('/notifications', createNotificationHandler);
router.post('/notifications/webhooks/:providerId?', async (req, res) => {
  const headerProvider =
    req.header('x-notification-provider') ??
    req.header('x-notification-source') ??
    req.header('x-provider-id');

  const providerId = (req.params.providerId || headerProvider)?.toLowerCase();

  if (!providerId) {
    return res.status(400).json({ error: 'Notification provider identifier is required' });
  }

  const provider = getNotificationProvider(providerId);

  if (!provider) {
    return res.status(404).json({ error: `Notification provider '${providerId}' not found` });
  }

  try {
    const notifications = await provider.handleWebhook(req);
    res.status(202).json({
      provider: providerId,
      received: notifications.length,
      notifications,
    });
  } catch (error) {
    if (error instanceof NotificationProviderError) {
      return res.status(error.statusCode).json({ error: error.message });
    }

    console.error(`Failed to handle webhook from provider ${providerId}`, error);
    res.status(500).json({ error: 'Failed to process notification webhook' });
  }
});
router.post('/notifications/pje/webhook', receivePjeNotificationHandler);
router.get('/notificacoes/projudi/sync', triggerProjudiSyncHandler);
router.post('/notifications/read-all', markAllNotificationsAsReadHandler);
router.post('/notifications/:id/read', markNotificationAsReadHandler);
router.post('/notifications/:id/unread', markNotificationAsUnreadHandler);
router.put('/notifications/preferences', updateNotificationPreferencesHandler);
router.delete('/notifications/:id', deleteNotificationHandler);

export default router;

