import { Router } from 'express';
import { listAreas } from '../controllers/areaAtuacaoController';

const router = Router();

/**
 * @swagger
 * components:
 *   schemas:
 *     Area:
 *       type: object
 *       properties:
 *         id:
 *           type: integer
 *         nome:
 *           type: string
 *         ativo:
 *           type: boolean
 *         datacriacao:
 *           type: string
 *           format: date-time
 */

/**
 * @swagger
 * /api/areas:
 *   get:
 *     summary: Lista todas as áreas de atuação
 *     tags: [Areas]
 *     responses:
 *       200:
 *         description: Lista de áreas
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/Area'
 */
router.get('/areas', listAreas);

export default router;

