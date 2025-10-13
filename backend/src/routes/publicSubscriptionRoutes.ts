import { Router } from 'express';
import { authenticateRequest } from '../middlewares/authMiddleware';
import { ensureSubscriptionOwner } from '../middlewares/subscriptionOwnershipMiddleware';
import {
  createOrGetCustomer,
  createSubscription,
  getPaymentBoletoCode,
  getPaymentPixQrCode,
  getSubscription,
  getSubscriptionPayments,
  updateSubscriptionCard,
  updateSubscriptionPlan,
} from '../controllers/publicSubscriptionController';

const router = Router();

router.post('/site/asaas/customers', createOrGetCustomer);
router.post('/site/asaas/subscriptions', createSubscription);

const subscriptionRouter = Router({ mergeParams: true });

subscriptionRouter.use(authenticateRequest, ensureSubscriptionOwner);
subscriptionRouter.get('/', getSubscription);
subscriptionRouter.get('/payments', getSubscriptionPayments);
subscriptionRouter.put('/', updateSubscriptionPlan);
subscriptionRouter.put('/card', updateSubscriptionCard);

router.use('/site/asaas/subscriptions/:subscriptionId', subscriptionRouter);

router.get('/site/asaas/payments/:paymentId/pix', getPaymentPixQrCode);
router.get('/site/asaas/payments/:paymentId/boleto', getPaymentBoletoCode);

export default router;
