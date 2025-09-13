import { Router } from 'express';
import {
  listEtiquetas,
  listEtiquetasByFluxoTrabalho,
  createEtiqueta,
  updateEtiqueta,
  deleteEtiqueta,
} from '../controllers/etiquetaController';

const router = Router();

/**
 * @swagger
 * tags:
 *   - name: Etiquetas
 *     description: Endpoints para gerenciamento de etiquetas
 * components:
 *   schemas:
 *     Etiqueta:
 *       type: object
 *       required:
 *         - nome
 *         - ativo
 *       properties:
 *         id:
 *           type: integer
 *         nome:
 *           type: string
 *         ativo:
 *           type: boolean
 *         exibe_pipeline:
 *           type: boolean
 *           default: true
 *         ordem:
 *           type: integer
 *         id_fluxo_trabalho:
 *           type: integer
 *         datacriacao:
 *           type: string
 *           format: date-time
 */

/**
 * @swagger
 * /api/etiquetas:
 *   get:
 *     summary: Lista todas as etiquetas
 *     tags: [Etiquetas]
 *     responses:
 *       200:
 *         description: Lista de etiquetas
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/Etiqueta'
 */
router.get('/etiquetas', listEtiquetas);

/**
 * @swagger
 * /api/etiquetas/fluxos-trabalho/{id}:
 *   get:
 *     summary: Lista etiquetas por fluxo de trabalho
 *     tags: [Etiquetas]
 *     parameters:
 *       - in: path
 *         name: id
 *         schema:
 *           type: integer
 *         required: true
 *     responses:
 *       200:
 *         description: Lista de etiquetas do fluxo de trabalho
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/Etiqueta'
 */
router.get('/etiquetas/fluxos-trabalho/:id', listEtiquetasByFluxoTrabalho);

/**
 * @swagger
 * /api/etiquetas:
 *   post:
 *     summary: Cria uma nova etiqueta
 *     tags: [Etiquetas]
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
 *               exibe_pipeline:
 *                 type: boolean
 *                 default: true
 *               ordem:
 *                 type: integer
 *               id_fluxo_trabalho:
 *                 type: integer
 *     responses:
 *       201:
 *         description: Etiqueta criada
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Etiqueta'
 */
router.post('/etiquetas', createEtiqueta);

/**
 * @swagger
 * /api/etiquetas/{id}:
 *   put:
 *     summary: Atualiza uma etiqueta existente
 *     tags: [Etiquetas]
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
 *               exibe_pipeline:
 *                 type: boolean
 *                 default: true
 *               ordem:
 *                 type: integer
 *               id_fluxo_trabalho:
 *                 type: integer
 *     responses:
 *       200:
 *         description: Etiqueta atualizada
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Etiqueta'
 *       404:
 *         description: Etiqueta não encontrada
 */
router.put('/etiquetas/:id', updateEtiqueta);

/**
 * @swagger
 * /api/etiquetas/{id}:
 *   delete:
 *     summary: Remove uma etiqueta
 *     tags: [Etiquetas]
 *     parameters:
 *       - in: path
 *         name: id
 *         schema:
 *           type: integer
 *         required: true
 *     responses:
 *       204:
 *         description: Etiqueta removida
 *       404:
 *         description: Etiqueta não encontrada
 */
router.delete('/etiquetas/:id', deleteEtiqueta);

export default router;

