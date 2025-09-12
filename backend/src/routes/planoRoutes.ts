import { Router } from 'express';
import {
  listPlanos,
  createPlano,
  updatePlano,
  deletePlano,
} from '../controllers/planoController';

const router = Router();

/**
 * @swagger
 * tags:
 *   - name: Planos
 *     description: Endpoints para gerenciamento de planos
 * components:
 *   schemas:
 *     Plano:
 *       type: object
 *       properties:
 *         id:
 *           type: integer
 *         nome:
 *           type: string
 *         valor:
 *           type: number
 *           format: float
 *         ativo:
 *           type: boolean
 *         datacadastro:
 *           type: string
 *           format: date-time
 */

/**
 * @swagger
 * /api/planos:
 *   get:
 *     summary: Lista todos os planos
 *     tags: [Planos]
 *     responses:
 *       200:
 *         description: Lista de planos
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/Plano'
 */
router.get('/planos', listPlanos);

/**
 * @swagger
 * /api/planos:
 *   post:
 *     summary: Cria um novo plano
 *     tags: [Planos]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               nome:
 *                 type: string
 *               valor:
 *                 type: number
 *                 format: float
 *               ativo:
 *                 type: boolean
 *     responses:
 *       201:
 *         description: Plano criado
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Plano'
 */
router.post('/planos', createPlano);

/**
 * @swagger
 * /api/planos/{id}:
 *   put:
 *     summary: Atualiza um plano existente
 *     tags: [Planos]
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
 *               valor:
 *                 type: number
 *                 format: float
 *               ativo:
 *                 type: boolean
 *     responses:
 *       200:
 *         description: Plano atualizado
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Plano'
 *       404:
 *         description: Plano não encontrado
 */
router.put('/planos/:id', updatePlano);

/**
 * @swagger
 * /api/planos/{id}:
 *   delete:
 *     summary: Remove um plano
 *     tags: [Planos]
 *     parameters:
 *       - in: path
 *         name: id
 *         schema:
 *           type: integer
 *         required: true
 *     responses:
 *       204:
 *         description: Plano removido
 *       404:
 *         description: Plano não encontrado
 */
router.delete('/planos/:id', deletePlano);

export default router;

