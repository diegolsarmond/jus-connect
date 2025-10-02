import { Router } from 'express';
import { listSistemasCnj } from '../controllers/sistemaCnjController';

const router = Router();

router.get('/sistemas-cnj', listSistemasCnj);

export default router;
