import { Router } from 'express';
import { listTags, createTag, updateTag, deleteTag } from '../controllers/tagController';

const router = Router();

router.get('/tags', listTags);
router.post('/tags', createTag);
router.put('/tags/:id', updateTag);
router.delete('/tags/:id', deleteTag);

export default router;
