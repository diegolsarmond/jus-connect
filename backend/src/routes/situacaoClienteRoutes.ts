import { Router } from 'express';
import {
  listSituacaoClientes,
  createSituacaoCliente,
  updateSituacaoCliente,
  deleteSituacaoCliente,
} from '../controllers/situacaoClienteController';

const router = Router();

/**
 * @swagger
 * tags:
 *   - name: SituacaoCliente
 *     description: Endpoints para gerenciamento de situação do cliente
 * components:
 *   schemas:
 *     SituacaoCliente:
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
 * /api/situacao-clientes:
 *   get:
 *     summary: Lista todas as situações de cliente
 *     tags: [SituacaoCliente]
 *     responses:
 *       200:
 *         description: Lista de situações de cliente
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/SituacaoCliente'
 */
router.get('/situacao-clientes', listSituacaoClientes);

/**
 * @swagger
 * /api/situacao-clientes:
 *   post:
 *     summary: Cria uma nova situação de cliente
 *     tags: [SituacaoCliente]
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
 *     responses:
 *       201:
 *         description: Situação de cliente criada
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/SituacaoCliente'
 */
router.post('/situacao-clientes', createSituacaoCliente);

/**
 * @swagger
 * /api/situacao-clientes/{id}:
 *   put:
 *     summary: Atualiza uma situação de cliente existente
 *     tags: [SituacaoCliente]
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
 *     responses:
 *       200:
 *         description: Situação de cliente atualizada
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/SituacaoCliente'
 *       404:
 *         description: Situação de cliente não encontrada
 */
router.put('/situacao-clientes/:id', updateSituacaoCliente);

/**
 * @swagger
 * /api/situacao-clientes/{id}:
 *   delete:
 *     summary: Remove uma situação de cliente
 *     tags: [SituacaoCliente]
 *     parameters:
 *       - in: path
 *         name: id
 *         schema:
 *           type: integer
 *         required: true
 *     responses:
 *       204:
 *         description: Situação de cliente removida
 *       404:
 *         description: Situação de cliente não encontrada
 */
router.delete('/situacao-clientes/:id', deleteSituacaoCliente);

export default router;

