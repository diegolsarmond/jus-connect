import { Router } from 'express';
import {
  listFluxosTrabalho,
  listFluxoTrabalhoMenus,
  createFluxoTrabalho,
  updateFluxoTrabalho,
  deleteFluxoTrabalho,
} from '../controllers/fluxoTrabalhoController';

const router = Router();

/**
 * @swagger
 * tags:
 *   - name: FluxosTrabalho
 *     description: Endpoints para gerenciamento de fluxos de trabalho
 * components:
 *   schemas:
 *     FluxoTrabalho:
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
 *         exibe_menu:
 *           type: boolean
 *         ordem:
 *           type: integer
 *           nullable: true
 */

/**
 * @swagger
 * /api/fluxos-trabalho:
 *   get:
 *     summary: Lista todos os fluxos de trabalho
 *     tags: [FluxosTrabalho]
 *     responses:
 *       200:
 *         description: Lista de fluxos de trabalho
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/FluxoTrabalho'
 */
router.get('/fluxos-trabalho', listFluxosTrabalho);

/**
 * @swagger
 * /api/fluxos-trabalho/menus:
 *   get:
 *     summary: Lista menus dos fluxos de trabalho
 *     tags: [FluxosTrabalho]
 *     responses:
 *       200:
 *         description: Lista de menus dos fluxos de trabalho
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 type: object
 *                 properties:
 *                   id:
 *                     type: integer
 *                   nome:
 *                     type: string
 *                   ordem:
 *                     type: integer
 */
router.get('/fluxos-trabalho/menus', listFluxoTrabalhoMenus);

/**
 * @swagger
 * /api/fluxos-trabalho:
 *   post:
 *     summary: Cria um novo fluxo de trabalho
 *     tags: [FluxosTrabalho]
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
 *               exibe_menu:
 *                 type: boolean
 *               ordem:
 *                 type: integer
 *                 nullable: true
 *     responses:
 *       201:
 *         description: Fluxo de trabalho criado
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/FluxoTrabalho'
 */
router.post('/fluxos-trabalho', createFluxoTrabalho);

/**
 * @swagger
 * /api/fluxos-trabalho/{id}:
 *   put:
 *     summary: Atualiza um fluxo de trabalho existente
 *     tags: [FluxosTrabalho]
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
 *               exibe_menu:
 *                 type: boolean
 *               ordem:
 *                 type: integer
 *                 nullable: true
 *     responses:
 *       200:
 *         description: Fluxo de trabalho atualizado
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/FluxoTrabalho'
 *       404:
 *         description: Fluxo de trabalho não encontrado
 */
router.put('/fluxos-trabalho/:id', updateFluxoTrabalho);

/**
 * @swagger
 * /api/fluxos-trabalho/{id}:
 *   delete:
 *     summary: Remove um fluxo de trabalho
 *     tags: [FluxosTrabalho]
 *     parameters:
 *       - in: path
 *         name: id
 *         schema:
 *           type: integer
 *         required: true
 *     responses:
 *       204:
 *         description: Fluxo de trabalho removido
 *       404:
 *         description: Fluxo de trabalho não encontrado
 */
router.delete('/fluxos-trabalho/:id', deleteFluxoTrabalho);

export default router;
