"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const tipoDocumentoController_1 = require("../controllers/tipoDocumentoController");
const router = (0, express_1.Router)();
/**
 * @swagger
 * tags:
 *   - name: TiposDocumento
 *     description: Endpoints para gerenciamento de tipos de documento
 * components:
 *   schemas:
 *     TipoDocumento:
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
 * /api/tipo-documentos:
 *   get:
 *     summary: Lista todos os tipos de documento
 *     tags: [TiposDocumento]
 *     responses:
 *       200:
 *         description: Lista de tipos de documento
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/TipoDocumento'
 */
router.get('/tipo-documentos', tipoDocumentoController_1.listTiposDocumento);
/**
 * @swagger
 * /api/tipo-documentos:
 *   post:
 *     summary: Cria um novo tipo de documento
 *     tags: [TiposDocumento]
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
 *         description: Tipo de documento criado
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/TipoDocumento'
 */
router.post('/tipo-documentos', tipoDocumentoController_1.createTipoDocumento);
/**
 * @swagger
 * /api/tipo-documentos/{id}:
 *   put:
 *     summary: Atualiza um tipo de documento existente
 *     tags: [TiposDocumento]
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
 *         description: Tipo de documento atualizado
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/TipoDocumento'
 *       404:
 *         description: Tipo de documento não encontrado
 */
router.put('/tipo-documentos/:id', tipoDocumentoController_1.updateTipoDocumento);
/**
 * @swagger
 * /api/tipo-documentos/{id}:
 *   delete:
 *     summary: Remove um tipo de documento
 *     tags: [TiposDocumento]
 *     parameters:
 *       - in: path
 *         name: id
 *         schema:
 *           type: integer
 *         required: true
 *     responses:
 *       204:
 *         description: Tipo de documento removido
 *       404:
 *         description: Tipo de documento não encontrado
 */
router.delete('/tipo-documentos/:id', tipoDocumentoController_1.deleteTipoDocumento);
exports.default = router;
