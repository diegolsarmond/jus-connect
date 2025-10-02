import { Router } from 'express';
import {
  listTiposProcesso,
  createTipoProcesso,
  updateTipoProcesso,
  deleteTipoProcesso,
} from '../controllers/tipoProcessoController';

const router = Router();

/**
 * @swagger
 * tags:
 *   - name: TiposProcesso
 *     description: Endpoints para gerenciamento de tipos de processo
 * components:
 *   schemas:
 *     TipoProcesso:
 *       type: object
 *       properties:
 *         id:
 *           type: integer
 *         nome:
 *           type: string
 *         ativo:
 *           type: boolean
 *         area_atuacao_id:
 *           type: integer
 *           nullable: true
 *         datacriacao:
 *           type: string
 *           format: date-time
 */

/**
 * @swagger
 * /api/tipo-processos:
 *   get:
 *     summary: Lista todos os tipos de processo
 *     tags: [TiposProcesso]
 *     parameters:
 *       - in: query
 *         name: area_atuacao_id
 *         schema:
 *           type: integer
 *           nullable: true
 *         required: false
 *     responses:
 *       200:
 *         description: Lista de tipos de processo
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/TipoProcesso'
 */
router.get('/tipo-processos', listTiposProcesso);

/**
 * @swagger
 * /api/tipo-processos:
 *   post:
 *     summary: Cria um novo tipo de processo
 *     tags: [TiposProcesso]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               nome:
 *                 type: string
 *               ativo:
 *                 type: boolean
 *               area_atuacao_id:
 *                 type: integer
 *                 nullable: true
 *     responses:
 *       201:
 *         description: Tipo de processo criado
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/TipoProcesso'
 */
router.post('/tipo-processos', createTipoProcesso);

/**
 * @swagger
 * /api/tipo-processos/{id}:
 *   put:
 *     summary: Atualiza um tipo de processo existente
 *     tags: [TiposProcesso]
 *     parameters:
 *       - in: path
 *         name: id
 *         schema:
 *           type: integer
 *         required: true
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               nome:
 *                 type: string
 *               ativo:
 *                 type: boolean
 *               area_atuacao_id:
 *                 type: integer
 *                 nullable: true
 *     responses:
 *       200:
 *         description: Tipo de processo atualizado
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/TipoProcesso'
 *       404:
 *         description: Tipo de processo não encontrado
 */
router.put('/tipo-processos/:id', updateTipoProcesso);

/**
 * @swagger
 * /api/tipo-processos/{id}:
 *   delete:
 *     summary: Remove um tipo de processo
 *     tags: [TiposProcesso]
 *     parameters:
 *       - in: path
 *         name: id
 *         schema:
 *           type: integer
 *         required: true
 *     responses:
 *       204:
 *         description: Tipo de processo removido
 *       404:
 *         description: Tipo de processo não encontrado
 */
router.delete('/tipo-processos/:id', deleteTipoProcesso);

export default router;

