import { Router } from 'express';
import {
  listIntimacoesHandler,
  archiveIntimacaoHandler,
  markIntimacaoAsReadHandler,
  listIntimacaoOabMonitoradasHandler,
  createIntimacaoOabMonitoradaHandler,
  deleteIntimacaoOabMonitoradaHandler,
} from '../controllers/intimacaoController';

const router = Router();

router.get('/intimacoes', listIntimacoesHandler);
router.patch('/intimacoes/:id/archive', archiveIntimacaoHandler);
router.patch('/intimacoes/:id/read', markIntimacaoAsReadHandler);
router.get('/intimacoes/oab-monitoradas', listIntimacaoOabMonitoradasHandler);
router.post('/intimacoes/oab-monitoradas', createIntimacaoOabMonitoradaHandler);
router.delete('/intimacoes/oab-monitoradas/:id', deleteIntimacaoOabMonitoradaHandler);

export default router;
