import { Router } from 'express';
import { requireAdminUser } from '../middlewares/adminAuthorization';
import { listAllUsuarios } from '../controllers/usuarioController';

const router = Router();

router.use(requireAdminUser);

router.get('/usuarios', listAllUsuarios);

export default router;
