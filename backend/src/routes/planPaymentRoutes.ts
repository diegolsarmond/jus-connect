import { Router } from 'express';
import { createPlanPayment } from '../controllers/planPaymentController';

const router = Router();

router.post('/plan-payments', createPlanPayment);

export default router;
