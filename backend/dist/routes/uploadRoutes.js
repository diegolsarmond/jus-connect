import { Router } from 'express';
import { upload } from '../controllers/uploadController';
const router = Router();
router.post('/uploads', upload);
export default router;
