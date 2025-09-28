import { Router } from 'express';
import {
  listFlows,
  getFlow,
  createFlow,
  updateFlow,
  deleteFlow,
  settleFlow,
  getAsaasChargeForFlow,
  listAsaasChargeStatus,
  createAsaasChargeForFlow,
  refundAsaasCharge,
} from '../controllers/financialController';

const router = Router();

router.get('/financial/flows', listFlows);
router.get('/financial/flows/:id', getFlow);
router.post('/financial/flows', createFlow);
router.put('/financial/flows/:id', updateFlow);
router.delete('/financial/flows/:id', deleteFlow);
router.post('/financial/flows/:id/settle', settleFlow);
router
  .route('/financial/flows/:id/asaas/charges')
  .get(getAsaasChargeForFlow)
  .post(createAsaasChargeForFlow);

router.get('/financial/flows/:id/asaas/charges/status', listAsaasChargeStatus);

router.get('/financial/flows/:id/asaas-charge', getAsaasChargeForFlow);
router.get('/financial/flows/:id/asaas-charge/status', listAsaasChargeStatus);
router.post('/financial/flows/:id/asaas-charge', createAsaasChargeForFlow);
router.post('/financial/flows/:id/asaas/charges/refund', refundAsaasCharge);

export default router;
