import { Router } from 'express';
import {
  listClienteDocumentos,
  createClienteDocumento,
  deleteClienteDocumento,
} from '../controllers/clienteDocumentoController';

const router = Router();

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
  .get(listClienteDocumentos)
  .post(createClienteDocumento);

/**
 * @swagger
 * /api/clientes/{clienteId}/documentos/{id}:
 *   delete:
 *     summary: Remove documento do cliente
 *     tags: [ClienteDocumentos]
 */
router.delete('/clientes/:clienteId/documentos/:id', deleteClienteDocumento);

export default router;
