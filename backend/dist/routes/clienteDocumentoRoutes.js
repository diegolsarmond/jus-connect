"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const clienteDocumentoController_1 = require("../controllers/clienteDocumentoController");
const router = (0, express_1.Router)();
/**
 * @swagger
 * tags:
 *   - name: ClienteDocumentos
 *     description: Gerenciamento de documentos dos clientes
 */
/**
 * @swagger
 * /api/clientes/{clienteId}/documentos:
 *   get:
 *     summary: Lista documentos do cliente
 *     tags: [ClienteDocumentos]
 *   post:
 *     summary: Adiciona documento ao cliente
 *     tags: [ClienteDocumentos]
 */
router
    .route('/clientes/:clienteId/documentos')
    .get(clienteDocumentoController_1.listClienteDocumentos)
    .post(clienteDocumentoController_1.createClienteDocumento);
/**
 * @swagger
 * /api/clientes/{clienteId}/documentos/{id}:
 *   delete:
 *     summary: Remove documento do cliente
 *     tags: [ClienteDocumentos]
 */
router.delete('/clientes/:clienteId/documentos/:id', clienteDocumentoController_1.deleteClienteDocumento);
exports.default = router;
