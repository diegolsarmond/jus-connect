import { Router } from 'express';
import { createOpportunityDocumentFromTemplate } from '../controllers/oportunidadeDocumentoController';

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
 */
router.post('/oportunidades/:id/documentos', createOpportunityDocumentFromTemplate);

export default router;
