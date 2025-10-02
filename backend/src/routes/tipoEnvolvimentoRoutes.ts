import { Router } from 'express';
import { listTiposEnvolvimento } from '../controllers/tipoEnvolvimentoController';

const router = Router();

router.get('/tipo-envolvimentos', listTiposEnvolvimento);

export default router;
