import { Router } from 'express';
import {
  consultarProcessoPublicoPorNumero,
  consultarProcessosPublicos,
} from '../controllers/consultaPublicaController';

const router = Router();

router.get('/consulta-publica/processos', consultarProcessosPublicos);
router.get('/consulta-publica/processos/:numeroProcesso', consultarProcessoPublicoPorNumero);

export default router;
