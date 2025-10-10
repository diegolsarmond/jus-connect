import { Router } from 'express';
import {
  listIntimacoesHandler,
  archiveIntimacaoHandler,
} from '../controllers/intimacaoController';

const router = Router();

router.get('/intimacoes', listIntimacoesHandler);
router.patch('/intimacoes/:id/archive', archiveIntimacaoHandler);

export default router;
