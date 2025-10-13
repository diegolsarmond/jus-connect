import { Router } from 'express';
import { createPlanPayment, getCurrentPlanPayment } from '../controllers/planPaymentController';

const router = Router();

router.post('/plan-payments', createPlanPayment);
router.get('/plan-payments/current', getCurrentPlanPayment);

export default router;
