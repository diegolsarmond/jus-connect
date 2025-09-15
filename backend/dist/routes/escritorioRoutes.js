"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const escritorioController_1 = require("../controllers/escritorioController");
const router = (0, express_1.Router)();
/**
 * @swagger
 * tags:
 *   - name: Escritorios
 *     description: Endpoints para gerenciamento de escritórios
 * components:
 *   schemas:
 *     Escritorio:
 *       type: object
 *       properties:
 *         id:
 *           type: integer
 *         nome:
 *           type: string
 *         empresa:
 *           type: integer
 *         ativo:
 *           type: boolean
 *         datacriacao:
 *           type: string
 *           format: date-time
 */
/**
 * @swagger
 * /api/escritorios:
 *   get:
 *     summary: Lista todos os escritórios
 *     tags: [Escritorios]
 *     responses:
 *       200:
 *         description: Lista de escritórios
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/Escritorio'
 */
router.get('/escritorios', escritorioController_1.listEscritorios);
/**
 * @swagger
 * /api/escritorios:
 *   post:
 *     summary: Cria um novo escritório
 *     tags: [Escritorios]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               nome:
 *                 type: string
 *               empresa:
 *                 type: integer
 *               ativo:
 *                 type: boolean
 *     responses:
 *       201:
 *         description: Escritório criado
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Escritorio'
 */
router.post('/escritorios', escritorioController_1.createEscritorio);
/**
 * @swagger
 * /api/escritorios/{id}:
 *   put:
 *     summary: Atualiza um escritório existente
 *     tags: [Escritorios]
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
 *               empresa:
 *                 type: integer
 *               ativo:
 *                 type: boolean
 *     responses:
 *       200:
 *         description: Escritório atualizado
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Escritorio'
 *       404:
 *         description: Escritório não encontrado
 */
router.put('/escritorios/:id', escritorioController_1.updateEscritorio);
/**
 * @swagger
 * /api/escritorios/{id}:
 *   delete:
 *     summary: Remove um escritório
 *     tags: [Escritorios]
 *     parameters:
 *       - in: path
 *         name: id
 *         schema:
 *           type: integer
 *         required: true
 *     responses:
 *       204:
 *         description: Escritório removido
 *       404:
 *         description: Escritório não encontrado
 */
router.delete('/escritorios/:id', escritorioController_1.deleteEscritorio);
exports.default = router;
