import { Router } from 'express';
import { createSupportRequest } from '../controllers/supportController';
const router = Router();
/**
 * @swagger
 * tags:
 *   - name: Suporte
 *     description: Endpoints para solicitações de suporte
 */
/**
 * @swagger
 * /api/support:
 *   post:
 *     summary: Cria uma nova solicitação de suporte
 *     tags: [Suporte]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               subject:
 *                 type: string
 *               description:
 *                 type: string
 *     responses:
 *       201:
 *         description: Solicitação criada
 */
router.post('/support', createSupportRequest);
export default router;
