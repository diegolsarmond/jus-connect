import { Router } from 'express';
import { handleJuditWebhook } from '../controllers/juditWebhookController';

const router = Router();

router.post('/integrations/judit/webhook', handleJuditWebhook);

export default router;
