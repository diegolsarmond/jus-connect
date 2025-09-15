"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const tipoEventoController_1 = require("../controllers/tipoEventoController");
const router = (0, express_1.Router)();
/**
 * @swagger
 * tags:
 *   - name: TiposEvento
 *     description: Endpoints para gerenciamento de tipos de evento
 * components:
 *   schemas:
 *     TipoEvento:
 *       type: object
 *       properties:
 *         id:
 *           type: integer
 *         nome:
 *           type: string
 *         ativo:
 *           type: boolean
 *         agenda:
 *           type: boolean
 *         tarefa:
 *           type: boolean
 *         datacriacao:
 *           type: string
 *           format: date-time
 */
/**
 * @swagger
 * /api/tipo-eventos:
 *   get:
 *     summary: Lista todos os tipos de evento
 *     tags: [TiposEvento]
 *     responses:
 *       200:
 *         description: Lista de tipos de evento
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/TipoEvento'
 */
router.get('/tipo-eventos', tipoEventoController_1.listTiposEvento);
/**
 * @swagger
 * /api/tipo-eventos:
 *   post:
 *     summary: Cria um novo tipo de evento
 *     tags: [TiposEvento]
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
 *               agenda:
 *                 type: boolean
 *               tarefa:
 *                 type: boolean
 *     responses:
 *       201:
 *         description: Tipo de evento criado
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/TipoEvento'
 */
router.post('/tipo-eventos', tipoEventoController_1.createTipoEvento);
/**
 * @swagger
 * /api/tipo-eventos/{id}:
 *   put:
 *     summary: Atualiza um tipo de evento existente
 *     tags: [TiposEvento]
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
 *               agenda:
 *                 type: boolean
 *               tarefa:
 *                 type: boolean
 *     responses:
 *       200:
 *         description: Tipo de evento atualizado
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/TipoEvento'
 *       404:
 *         description: Tipo de evento não encontrado
 */
router.put('/tipo-eventos/:id', tipoEventoController_1.updateTipoEvento);
/**
 * @swagger
 * /api/tipo-eventos/{id}:
 *   delete:
 *     summary: Remove um tipo de evento
 *     tags: [TiposEvento]
 *     parameters:
 *       - in: path
 *         name: id
 *         schema:
 *           type: integer
 *         required: true
 *     responses:
 *       204:
 *         description: Tipo de evento removido
 *       404:
 *         description: Tipo de evento não encontrado
 */
router.delete('/tipo-eventos/:id', tipoEventoController_1.deleteTipoEvento);
exports.default = router;
