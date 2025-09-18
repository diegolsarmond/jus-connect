"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const oportunidadeDocumentoController_1 = require("../controllers/oportunidadeDocumentoController");
const router = (0, express_1.Router)();
/**
 * @openapi
 * /api/oportunidades/{id}/documentos:
 *   post:
 *     summary: Cria um documento para a oportunidade a partir de um modelo
 *     tags: [Oportunidades]
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
 *       404:
 *         description: Oportunidade ou template não encontrado
 */
router.post('/oportunidades/:id/documentos', oportunidadeDocumentoController_1.createOpportunityDocumentFromTemplate);
exports.default = router;
