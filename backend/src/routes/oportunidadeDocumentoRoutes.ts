import { Router } from 'express';
import {
  createOpportunityDocumentFromTemplate,
  deleteOpportunityDocument,
  getOpportunityDocument,
  listOpportunityDocuments,
} from '../controllers/oportunidadeDocumentoController';

const router = Router();

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
 *   get:
 *     summary: Lista os documentos gerados para a oportunidade
 *     tags: [Oportunidades]
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
 */
router
  .route('/oportunidades/:id/documentos')
  .post(createOpportunityDocumentFromTemplate)
  .get(listOpportunityDocuments);

/**
 * @openapi
 * /api/oportunidades/{id}/documentos/{documentId}:
 *   get:
 *     summary: Recupera um documento específico da oportunidade
 *     tags: [Oportunidades]
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
 *       404:
 *         description: Documento não encontrado
 *   delete:
 *     summary: Remove um documento específico da oportunidade
 *     tags: [Oportunidades]
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
 *       404:
 *         description: Documento não encontrado
 */
router
  .route('/oportunidades/:id/documentos/:documentId')
  .get(getOpportunityDocument)
  .delete(deleteOpportunityDocument);

export default router;
