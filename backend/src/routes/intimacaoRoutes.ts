import { Router } from 'express';
import {
  listIntimacoesHandler,
  archiveIntimacaoHandler,
  markIntimacaoAsReadHandler,
} from '../controllers/intimacaoController';

const router = Router();

router.get('/intimacoes', listIntimacoesHandler);
router.patch('/intimacoes/:id/archive', archiveIntimacaoHandler);
router.patch('/intimacoes/:id/read', markIntimacaoAsReadHandler);

export default router;
