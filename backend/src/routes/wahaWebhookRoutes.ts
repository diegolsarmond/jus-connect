import { Router } from 'express';
import { handleWahaWebhook } from '../controllers/wahaWebhookController';

const router = Router();

router.post('/webhooks/waha', handleWahaWebhook);

export default router;
