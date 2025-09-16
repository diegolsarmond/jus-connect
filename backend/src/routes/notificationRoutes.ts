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

const router = Router();

router.get('/notifications', listNotificationsHandler);
router.get('/notifications/unread-count', getUnreadCountHandler);
router.get('/notifications/preferences', getNotificationPreferencesHandler);
router.get('/notifications/:id', getNotificationHandler);
router.post('/notifications', createNotificationHandler);
router.post('/notifications/pje/webhook', receivePjeNotificationHandler);
router.get('/notificacoes/projudi/sync', triggerProjudiSyncHandler);
router.post('/notifications/read-all', markAllNotificationsAsReadHandler);
router.post('/notifications/:id/read', markNotificationAsReadHandler);
router.post('/notifications/:id/unread', markNotificationAsUnreadHandler);
router.put('/notifications/preferences', updateNotificationPreferencesHandler);
router.delete('/notifications/:id', deleteNotificationHandler);

export default router;

