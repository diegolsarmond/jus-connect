import { Router } from 'express';
import { listResponsaveis, addResponsaveis } from '../controllers/tarefaResponsavelController';

const router = Router();

// Rotas para responsáveis das tarefas
router.get('/tarefas/:id/responsaveis', listResponsaveis);
router.post('/tarefas/:id/responsaveis', addResponsaveis);

export default router;

