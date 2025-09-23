"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const oportunidadeDocumentoController_1 = require("../controllers/oportunidadeDocumentoController");
const router = (0, express_1.Router)();
/**
 * @swagger
 * /api/oportunidades/{id}/documentos:
 *   post:
 *     summary: Cria um documento para a oportunidade a partir de um modelo
 *     tags: [Oportunidades]
 *     security:
 *       - bearerAuth: []
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
 *               templateId:
 *                 type: integer
 *             required:
 *               - templateId
 *     responses:
 *       201:
 *         description: Documento criado com sucesso
 *       400:
 *         description: Dados inválidos fornecidos
 *       401:
 *         description: Token inválido ou ausente
 *       403:
 *         description: Usuário autenticado sem empresa vinculada
 *       404:
 *         description: Oportunidade ou template não encontrado
 *   get:
 *     summary: Lista os documentos gerados para a oportunidade
 *     tags: [Oportunidades]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Lista de documentos da oportunidade
 *       400:
 *         description: Oportunidade inválida
 *       401:
 *         description: Token inválido ou ausente
 *       403:
 *         description: Usuário autenticado sem empresa vinculada
 *       404:
 *         description: Oportunidade não encontrada
 */
router
    .route('/oportunidades/:id/documentos')
    .post(oportunidadeDocumentoController_1.createOpportunityDocumentFromTemplate)
    .get(oportunidadeDocumentoController_1.listOpportunityDocuments);
/**
 * @swagger
 * /api/oportunidades/{id}/documentos/{documentId}:
 *   get:
 *     summary: Recupera um documento específico da oportunidade
 *     tags: [Oportunidades]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *       - in: path
 *         name: documentId
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Documento retornado com sucesso
 *       400:
 *         description: Parâmetros inválidos
 *       401:
 *         description: Token inválido ou ausente
 *       403:
 *         description: Usuário autenticado sem empresa vinculada
 *       404:
 *         description: Documento não encontrado
 *   delete:
 *     summary: Remove um documento específico da oportunidade
 *     tags: [Oportunidades]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *       - in: path
 *         name: documentId
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       204:
 *         description: Documento removido com sucesso
 *       400:
 *         description: Parâmetros inválidos
 *       401:
 *         description: Token inválido ou ausente
 *       403:
 *         description: Usuário autenticado sem empresa vinculada
 *       404:
 *         description: Documento não encontrado
 */
router
    .route('/oportunidades/:id/documentos/:documentId')
    .get(oportunidadeDocumentoController_1.getOpportunityDocument)
    .delete(oportunidadeDocumentoController_1.deleteOpportunityDocument);
exports.default = router;
