"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const supportController_1 = require("../controllers/supportController");
const router = (0, express_1.Router)();
/**
 * @swagger
 * tags:
 *   - name: Suporte
 *     description: Endpoints para solicitações de suporte
 */
/**
 * @swagger
 * /api/support:
 *   get:
 *     summary: Lista solicitações de suporte
 *     tags: [Suporte]
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           minimum: 1
 *       - in: query
 *         name: pageSize
 *         schema:
 *           type: integer
 *           minimum: 1
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [open, in_progress, resolved, closed]
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Lista de solicitações de suporte
 */
router.get('/support', supportController_1.listSupportRequests);
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
 *             required:
 *               - subject
 *               - description
 *             properties:
 *               subject:
 *                 type: string
 *               description:
 *                 type: string
 *               requesterName:
 *                 type: string
 *               requesterEmail:
 *                 type: string
 *               status:
 *                 type: string
 *                 enum: [open, in_progress, resolved, closed]
 *     responses:
 *       201:
 *         description: Solicitação criada
 */
router.post('/support', supportController_1.createSupportRequest);
/**
 * @swagger
 * /api/support/{id}:
 *   get:
 *     summary: Obtém uma solicitação de suporte pelo ID
 *     tags: [Suporte]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Solicitação encontrada
 *       404:
 *         description: Solicitação não encontrada
 */
router.get('/support/:id', supportController_1.getSupportRequest);
/**
 * @swagger
 * /api/support/{id}:
 *   patch:
 *     summary: Atualiza uma solicitação de suporte
 *     tags: [Suporte]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
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
 *               requesterName:
 *                 type: string
 *               requesterEmail:
 *                 type: string
 *               status:
 *                 type: string
 *                 enum: [open, in_progress, resolved, closed]
 *     responses:
 *       200:
 *         description: Solicitação atualizada
 *       404:
 *         description: Solicitação não encontrada
 */
router.patch('/support/:id', supportController_1.updateSupportRequest);
exports.default = router;
