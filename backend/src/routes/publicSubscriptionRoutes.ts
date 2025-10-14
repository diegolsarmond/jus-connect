import { Router } from 'express';
import {
  createOrGetCustomer,
  createSubscription,
  getPaymentBoletoCode,
  getPaymentPixQrCode,
  getSubscription,
  getSubscriptionPayments,
  cancelSubscription,
  updateSubscriptionCard,
  updateSubscriptionPlan,
} from '../controllers/publicSubscriptionController';

const router = Router();

router.post('/site/asaas/customers', createOrGetCustomer);
router.post('/site/asaas/subscriptions', createSubscription);
router.get('/site/asaas/subscriptions/:subscriptionId', getSubscription);
router.get('/site/asaas/subscriptions/:subscriptionId/payments', getSubscriptionPayments);
router.get('/site/asaas/payments/:paymentId/pix', getPaymentPixQrCode);
router.get('/site/asaas/payments/:paymentId/boleto', getPaymentBoletoCode);
router.put('/site/asaas/subscriptions/:subscriptionId', updateSubscriptionPlan);
router.put('/site/asaas/subscriptions/:subscriptionId/card', updateSubscriptionCard);
router.post('/site/asaas/subscriptions/:subscriptionId/cancel', cancelSubscription);

export default router;

