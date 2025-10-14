import { Router } from 'express';
import {
  createIntegrationWebhook,
  deleteIntegrationWebhook,
  listIntegrationWebhooks,
  updateIntegrationWebhook,
  updateIntegrationWebhookStatus,
} from '../controllers/webhookController';

const router = Router();

router.get('/integrations/webhooks', listIntegrationWebhooks);
router.post('/integrations/webhooks', createIntegrationWebhook);
router.put('/integrations/webhooks/:id', updateIntegrationWebhook);
router.patch('/integrations/webhooks/:id', updateIntegrationWebhookStatus);
router.delete('/integrations/webhooks/:id', deleteIntegrationWebhook);

export default router;
