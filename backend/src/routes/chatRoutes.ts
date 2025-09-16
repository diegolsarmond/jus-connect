import { Router } from 'express';
import {
  createConversationHandler,
  getConversationMessagesHandler,
  listConversationsHandler,
  markConversationReadHandler,
  sendConversationMessageHandler,
  wahaWebhookHandler,
} from '../controllers/chatController';
import {
  getWahaConfigHandler,
  updateWahaConfigHandler,
} from '../controllers/wahaIntegrationController';

const router = Router();

router.get('/conversations', listConversationsHandler);
router.post('/conversations', createConversationHandler);
router.get('/conversations/:conversationId/messages', getConversationMessagesHandler);
router.post('/conversations/:conversationId/messages', sendConversationMessageHandler);
router.post('/conversations/:conversationId/read', markConversationReadHandler);
router.post('/webhooks/waha', wahaWebhookHandler);
router.get('/integrations/waha', getWahaConfigHandler);
router.put('/integrations/waha', updateWahaConfigHandler);

export default router;
