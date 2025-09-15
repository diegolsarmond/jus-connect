import { Router } from 'express';
import { generateDocument } from '../controllers/documentController';
const router = Router();
router.post('/documents/generate', generateDocument);
export default router;
