import { Router } from 'express';
import {
  createSupportRequest,
  createSupportRequestMessage,
  downloadSupportRequestAttachment,
  getSupportRequest,
  listSupportRequests,
  listSupportRequestMessages,
  updateSupportRequest,
} from '../controllers/supportController';

const router = Router();

/**
 * @swagger
 * tags:
 *   - name: Suporte
 *     description: Endpoints para solicitações de suporte
 */

/**
 * @swagger
 * /api/support:
 *   get:
 *     summary: Lista solicitações de suporte
 *     tags: [Suporte]
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           minimum: 1
 *       - in: query
 *         name: pageSize
 *         schema:
 *           type: integer
 *           minimum: 1
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [open, in_progress, resolved, closed]
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Lista de solicitações de suporte
 */
router.get('/support', listSupportRequests);

/**
 * @swagger
 * /api/support:
 *   post:
 *     summary: Cria uma nova solicitação de suporte
 *     tags: [Suporte]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - subject
 *               - description
 *             properties:
 *               subject:
 *                 type: string
 *               description:
 *                 type: string
 *               requesterName:
 *                 type: string
 *               requesterEmail:
 *                 type: string
 *               status:
 *                 type: string
 *                 enum: [open, in_progress, resolved, closed]
 *     responses:
 *       201:
 *         description: Solicitação criada
 */
router.post('/support', createSupportRequest);

/**
 * @swagger
 * /api/support/{id}:
 *   get:
 *     summary: Obtém uma solicitação de suporte pelo ID
 *     tags: [Suporte]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Solicitação encontrada
 *       404:
 *         description: Solicitação não encontrada
 */
router.get('/support/:id', getSupportRequest);

/**
 * @swagger
 * /api/support/{id}/messages:
 *   get:
 *     summary: Lista as mensagens de uma solicitação de suporte
 *     tags: [Suporte]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Lista de mensagens relacionada à solicitação
 *       404:
 *         description: Solicitação não encontrada
 */
router.get('/support/:id/messages', listSupportRequestMessages);

/**
 * @swagger
 * /api/support/{id}/messages:
 *   post:
 *     summary: Registra uma nova mensagem em uma solicitação de suporte
 *     tags: [Suporte]
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
 *               message:
 *                 type: string
 *               sender:
 *                 type: string
 *                 enum: [requester, support]
 *               attachments:
 *                 type: array
 *                 items:
 *                   type: object
 *                   properties:
 *                     filename:
 *                       type: string
 *                     contentType:
 *                       type: string
 *                     size:
 *                       type: integer
 *                     data:
 *                       type: string
 *                       description: Conteúdo do arquivo em Base64
 *     responses:
 *       201:
 *         description: Mensagem registrada com sucesso
 *       404:
 *         description: Solicitação não encontrada
 */
router.post('/support/:id/messages', createSupportRequestMessage);

/**
 * @swagger
 * /api/support/{id}:
 *   patch:
 *     summary: Atualiza uma solicitação de suporte
 *     tags: [Suporte]
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
 *               subject:
 *                 type: string
 *               description:
 *                 type: string
 *               requesterName:
 *                 type: string
 *               requesterEmail:
 *                 type: string
 *               status:
 *                 type: string
 *                 enum: [open, in_progress, resolved, closed]
 *     responses:
 *       200:
 *         description: Solicitação atualizada
 *       404:
 *         description: Solicitação não encontrada
 */
router.patch('/support/:id', updateSupportRequest);

/**
 * @swagger
 * /api/support/messages/{messageId}/attachments/{attachmentId}:
 *   get:
 *     summary: Faz o download de um anexo de uma mensagem de suporte
 *     tags: [Suporte]
 *     parameters:
 *       - in: path
 *         name: messageId
 *         required: true
 *         schema:
 *           type: integer
 *       - in: path
 *         name: attachmentId
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Anexo encontrado
 *       404:
 *         description: Anexo não encontrado
 */
router.get(
  '/support/messages/:messageId/attachments/:attachmentId',
  downloadSupportRequestAttachment,
);

export default router;
