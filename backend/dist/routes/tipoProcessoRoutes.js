"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const tipoProcessoController_1 = require("../controllers/tipoProcessoController");
const router = (0, express_1.Router)();
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
router.get('/tipo-processos', tipoProcessoController_1.listTiposProcesso);
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
 *     responses:
 *       201:
 *         description: Tipo de processo criado
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/TipoProcesso'
 */
router.post('/tipo-processos', tipoProcessoController_1.createTipoProcesso);
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
router.put('/tipo-processos/:id', tipoProcessoController_1.updateTipoProcesso);
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
router.delete('/tipo-processos/:id', tipoProcessoController_1.deleteTipoProcesso);
exports.default = router;
