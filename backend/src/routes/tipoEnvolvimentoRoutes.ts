import { Router } from 'express';
import { listTiposEnvolvimento } from '../controllers/tipoEnvolvimentoController';

const router = Router();

/**
 * @swagger
 * tags:
 *   - name: TiposEnvolvimento
 *     description: Endpoints para gerenciamento de tipos de envolvimento
 * components:
 *   schemas:
 *     TipoEnvolvimento:
 *       type: object
 *       properties:
 *         id:
 *           type: integer
 *         descricao:
 *           type: string
 */

/**
 * @swagger
 * /api/tipo-envolvimentos:
 *   get:
 *     summary: Lista todos os tipos de envolvimento
 *     tags: [TiposEnvolvimento]
 *     responses:
 *       200:
 *         description: Lista de tipos de envolvimento
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/TipoEnvolvimento'
 */
router.get('/tipo-envolvimentos', listTiposEnvolvimento);

export default router;
