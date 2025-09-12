import { Router } from 'express';
import { listAreas } from '../controllers/areaAtuacaoController';

const router = Router();

router.get('/areas', listAreas);

export default router;

