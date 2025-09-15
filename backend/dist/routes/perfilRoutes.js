"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const perfilController_1 = require("../controllers/perfilController");
const router = (0, express_1.Router)();
/**
 * @swagger
 * tags:
 *   - name: Perfis
 *     description: Endpoints para gerenciamento de perfis
 * components:
 *   schemas:
 *     Perfil:
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
 * /api/perfis:
 *   get:
 *     summary: Lista todos os perfis
 *     tags: [Perfis]
 *     responses:
 *       200:
 *         description: Lista de perfis
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/Perfil'
 */
router.get('/perfis', perfilController_1.listPerfis);
/**
 * @swagger
 * /api/perfis:
 *   post:
 *     summary: Cria um novo perfil
 *     tags: [Perfis]
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
 *         description: Perfil criado
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Perfil'
 */
router.post('/perfis', perfilController_1.createPerfil);
/**
 * @swagger
 * /api/perfis/{id}:
 *   put:
 *     summary: Atualiza um perfil existente
 *     tags: [Perfis]
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
 *         description: Perfil atualizado
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Perfil'
 *       404:
 *         description: Perfil não encontrado
 */
router.put('/perfis/:id', perfilController_1.updatePerfil);
/**
 * @swagger
 * /api/perfis/{id}:
 *   delete:
 *     summary: Remove um perfil
 *     tags: [Perfis]
 *     parameters:
 *       - in: path
 *         name: id
 *         schema:
 *           type: integer
 *         required: true
 *     responses:
 *       204:
 *         description: Perfil removido
 *       404:
 *         description: Perfil não encontrado
 */
router.delete('/perfis/:id', perfilController_1.deletePerfil);
exports.default = router;
