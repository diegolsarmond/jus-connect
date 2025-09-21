import { Router } from 'express';
import { createSubscription } from '../controllers/subscriptionController';

const router = Router();

router.post('/subscriptions', createSubscription);

export default router;
