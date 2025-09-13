import { Router } from 'express';
import {
  listFlows,
  getFlow,
  createFlow,
  updateFlow,
  deleteFlow,
  settleFlow,
} from '../controllers/financialController';

const router = Router();

router.get('/financial/flows', listFlows);
router.get('/financial/flows/:id', getFlow);
router.post('/financial/flows', createFlow);
router.put('/financial/flows/:id', updateFlow);
router.delete('/financial/flows/:id', deleteFlow);
router.post('/financial/flows/:id/settle', settleFlow);

export default router;
