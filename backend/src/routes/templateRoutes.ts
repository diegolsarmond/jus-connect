import { Router } from 'express';
import {
  listTemplates,
  getTemplate,
  createTemplate,
  updateTemplate,
  deleteTemplate,
  generateWithAI,
} from '../controllers/templateController';

const router = Router();

router.get('/templates', listTemplates);
router.get('/templates/:id', getTemplate);
router.post('/templates', createTemplate);
router.put('/templates/:id', updateTemplate);
router.delete('/templates/:id', deleteTemplate);
router.post('/templates/:id/generate', generateWithAI);

export default router;
