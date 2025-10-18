import { Router } from 'express';
import {
  listTemplates,
  getTemplate,
  createTemplate,
  updateTemplate,
  deleteTemplate,
  generateWithAI,
} from '../controllers/templateController';
import { ensureAuthenticatedEmpresa } from '../middlewares/ensureAuthenticatedEmpresa';

const router = Router();

router.get('/templates', ensureAuthenticatedEmpresa, listTemplates);
router.get('/templates/:id', ensureAuthenticatedEmpresa, getTemplate);
router.post('/templates', ensureAuthenticatedEmpresa, createTemplate);
router.put('/templates/:id', ensureAuthenticatedEmpresa, updateTemplate);
router.delete('/templates/:id', ensureAuthenticatedEmpresa, deleteTemplate);
router.post('/templates/:id/generate', ensureAuthenticatedEmpresa, generateWithAI);

export default router;
