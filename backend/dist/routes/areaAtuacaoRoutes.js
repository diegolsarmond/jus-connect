"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const areaAtuacaoController_1 = require("../controllers/areaAtuacaoController");
const router = (0, express_1.Router)();
/**
 * @swagger
 * tags:
 *   - name: AreaAtuacao
 *     description: Endpoints para gerenciamento de áreas de atuação
 * components:
 *   schemas:
 *     AreaAtuacao:
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
 *     tags: [AreaAtuacao]
 *     responses:
 *       200:
 *         description: Lista de áreas
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/AreaAtuacao'
 */
router.get('/areas', areaAtuacaoController_1.listAreas);
/**
 * @swagger
 * /api/areas/{id}:
 *   get:
 *     summary: Obtém uma área de atuação pelo ID
 *     tags: [AreaAtuacao]
 *     parameters:
 *       - in: path
 *         name: id
 *         schema:
 *           type: integer
 *         required: true
 *     responses:
 *       200:
 *         description: Área encontrada
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/AreaAtuacao'
 *       404:
 *         description: Área não encontrada
 */
router.get('/areas/:id', areaAtuacaoController_1.getAreaById);
/**
 * @swagger
 * /api/areas:
 *   post:
 *     summary: Cria uma nova área de atuação
 *     tags: [AreaAtuacao]
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
 *         description: Área criada
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/AreaAtuacao'
 */
router.post('/areas', areaAtuacaoController_1.createArea);
/**
 * @swagger
 * /api/areas/{id}:
 *   put:
 *     summary: Atualiza uma área de atuação existente
 *     tags: [AreaAtuacao]
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
 *         description: Área atualizada
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/AreaAtuacao'
 *       404:
 *         description: Área não encontrada
 */
router.put('/areas/:id', areaAtuacaoController_1.updateArea);
/**
 * @swagger
 * /api/areas/{id}:
 *   delete:
 *     summary: Remove uma área de atuação
 *     tags: [AreaAtuacao]
 *     parameters:
 *       - in: path
 *         name: id
 *         schema:
 *           type: integer
 *         required: true
 *     responses:
 *       204:
 *         description: Área removida
 *       404:
 *         description: Área não encontrada
 */
router.delete('/areas/:id', areaAtuacaoController_1.deleteArea);
exports.default = router;
