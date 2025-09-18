"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const chatController_1 = require("../controllers/chatController");
const router = (0, express_1.Router)();
/**
 * @swagger
 * tags:
 *   - name: Conversas
 *     description: Endpoints para gerenciamento de conversas e mensagens registradas no sistema
 * components:
 *   schemas:
 *     ChatMessageAttachment:
 *       type: object
 *       properties:
 *         id:
 *           type: string
 *           description: Identificador único do anexo
 *         type:
 *           type: string
 *           description: Tipo de arquivo do anexo
 *           enum: [image]
 *         url:
 *           type: string
 *           format: uri
 *           description: URL pública para download do arquivo
 *         name:
 *           type: string
 *           description: Nome amigável do arquivo
 *     ChatMessage:
 *       type: object
 *       properties:
 *         id:
 *           type: string
 *         conversationId:
 *           type: string
 *         sender:
 *           type: string
 *           enum: [me, contact]
 *           description: Indica se a mensagem foi enviada pelo operador ou pelo contato
 *         content:
 *           type: string
 *         timestamp:
 *           type: string
 *           format: date-time
 *         status:
 *           type: string
 *           enum: [sent, delivered, read]
 *         type:
 *           type: string
 *           enum: [text, image]
 *         attachments:
 *           type: array
 *           nullable: true
 *           items:
 *             $ref: '#/components/schemas/ChatMessageAttachment'
 *     ConversationLastMessage:
 *       type: object
 *       properties:
 *         id:
 *           type: string
 *         content:
 *           type: string
 *           description: Conteúdo completo armazenado para a pré-visualização
 *         preview:
 *           type: string
 *           description: Texto reduzido apresentado na listagem de conversas
 *         timestamp:
 *           type: string
 *           format: date-time
 *         sender:
 *           type: string
 *           enum: [me, contact]
 *         type:
 *           type: string
 *           enum: [text, image]
 *         status:
 *           type: string
 *           enum: [sent, delivered, read]
 *     ConversationSummary:
 *       type: object
 *       properties:
 *         id:
 *           type: string
 *         name:
 *           type: string
 *         avatar:
 *           type: string
 *           description: Avatar calculado para o contato
 *         shortStatus:
 *           type: string
 *         description:
 *           type: string
 *         unreadCount:
 *           type: integer
 *           format: int32
 *         pinned:
 *           type: boolean
 *         lastMessage:
 *           $ref: '#/components/schemas/ConversationLastMessage'
 *           nullable: true
 *     MessagePage:
 *       type: object
 *       properties:
 *         messages:
 *           type: array
 *           items:
 *             $ref: '#/components/schemas/ChatMessage'
 *         nextCursor:
 *           type: string
 *           format: date-time
 *           nullable: true
 *           description: Cursor a ser enviado na próxima requisição para continuar a paginação
 *     CreateConversationRequest:
 *       type: object
 *       description: Payload utilizado para criar ou atualizar conversas. Informe pelo menos contactIdentifier ou id.
 *       properties:
 *         id:
 *           type: string
 *           description: Identificador interno da conversa; caso omitido utiliza-se contactIdentifier
 *         contactIdentifier:
 *           type: string
 *           description: Identificador do contato associado à conversa
 *         contactName:
 *           type: string
 *         description:
 *           type: string
 *         shortStatus:
 *           type: string
 *         avatar:
 *           type: string
 *         pinned:
 *           type: boolean
 *         metadata:
 *           type: object
 *           nullable: true
 *           additionalProperties: true
 *     SendMessageRequest:
 *       type: object
 *       required:
 *         - content
 *       properties:
 *         content:
 *           type: string
 *           description: Conteúdo textual da mensagem a ser enviada
 *         type:
 *           type: string
 *           enum: [text, image]
 *           description: Tipo de mensagem. Por padrão envia mensagem de texto
 *         attachments:
 *           type: array
 *           items:
 *             $ref: '#/components/schemas/ChatMessageAttachment'
 *           description: Lista de anexos a ser enviada junto com a mensagem
 *           nullable: true
 *     ErrorResponse:
 *       type: object
 *       properties:
 *         error:
 *           type: string
 *           description: Mensagem detalhando o motivo do erro

 */
/**
 * @swagger
 * /api/conversations:
 *   get:
 *     summary: Lista conversas cadastradas no sistema
 *     tags:
 *       - Conversas
 *     responses:
 *       200:
 *         description: Lista de conversas ordenadas pela atividade mais recente
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/ConversationSummary'
 *       500:
 *         description: Erro interno ao listar conversas
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
router.get('/conversations', chatController_1.listConversationsHandler);
/**
 * @swagger
 * /api/conversations:
 *   post:
 *     summary: Cria ou atualiza uma conversa manualmente
 *     tags: [Conversas]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/CreateConversationRequest'
 *           examples:
 *             default:
 *               summary: Exemplo de criação de conversa
 *               value:
 *                 contactIdentifier: 5511999999999@c.us
 *                 contactName: Cliente Teste
 *                 shortStatus: Novo lead
 *                 pinned: false
 *     responses:
 *       201:
 *         description: Conversa criada ou atualizada com sucesso
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ConversationSummary'
 *       400:
 *         description: Dados inválidos enviados para criação da conversa
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       500:
 *         description: Erro interno ao criar a conversa
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
router.post('/conversations', chatController_1.createConversationHandler);
/**
 * @swagger
 * /api/conversations/{conversationId}:
 *   patch:
 *     summary: Atualiza metadados de uma conversa existente
 *     tags: [Conversas]
 *     parameters:
 *       - in: path
 *         name: conversationId
 *         required: true
 *         schema:
 *           type: string
 *         description: Identificador da conversa que será atualizada
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               responsibleId:
 *                 type: integer
 *                 nullable: true
 *               tags:
 *                 type: array
 *                 items:
 *                   type: string
 *               clientName:
 *                 type: string
 *                 nullable: true
 *               isLinkedToClient:
 *                 type: boolean
 *               customAttributes:
 *                 type: array
 *                 items:
 *                   type: object
 *               internalNotes:
 *                 type: array
 *                 items:
 *                   type: object
 *               isPrivate:
 *                 type: boolean
 *     responses:
 *       200:
 *         description: Conversa atualizada com sucesso
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ConversationSummary'
 *       400:
 *         description: Dados inválidos enviados para atualização da conversa
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       404:
 *         description: Conversa não encontrada
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
router.patch('/conversations/:conversationId', chatController_1.updateConversationHandler);
/**
 * @swagger
 * /api/conversations/{conversationId}/messages:
 *   get:
 *     summary: Lista mensagens de uma conversa
 *     tags: [Conversas]
 *     parameters:
 *       - in: path
 *         name: conversationId
 *         required: true
 *         schema:
 *           type: string
 *         description: Identificador da conversa
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 100
 *         description: Quantidade máxima de mensagens retornadas por página (padrão 20)
 *       - in: query
 *         name: cursor
 *         schema:
 *           type: string
 *           format: date-time
 *         description: Cursor utilizado para paginação reversa das mensagens
 *     responses:
 *       200:
 *         description: Página de mensagens retornada com sucesso
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/MessagePage'
 *       404:
 *         description: Conversa não encontrada
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       500:
 *         description: Erro interno ao listar mensagens
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
router.get('/conversations/:conversationId/messages', chatController_1.getConversationMessagesHandler);
/**
 * @swagger
 * /api/conversations/{conversationId}/messages:
 *   post:
 *     summary: Registra uma nova mensagem enviada pelo operador
 *     tags: [Conversas]
 *     parameters:
 *       - in: path
 *         name: conversationId
 *         required: true
 *         schema:
 *           type: string
 *         description: Identificador da conversa
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/SendMessageRequest'
 *           examples:
 *             texto:
 *               summary: Envio de mensagem de texto
 *               value:
 *                 content: Olá, podemos ajudar?
 *             imagem:
 *               summary: Envio de imagem com legenda
 *               value:
 *                 content: Veja o documento em anexo
 *                 type: image
 *                 attachments:
 *                   - id: file-123
 *                     type: image
 *                     name: comprovante.png
 *                     url: https://example.com/comprovante.png
 *     responses:
 *       201:
 *         description: Mensagem registrada e enviada ao provedor
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ChatMessage'
 *       400:
 *         description: Dados inválidos para envio da mensagem
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       500:
 *         description: Erro interno ao registrar a mensagem
*         content:
*           application/json:
*             schema:
*               $ref: '#/components/schemas/ErrorResponse'
*/
router.post('/conversations/:conversationId/messages', chatController_1.sendConversationMessageHandler);
/**
 * @swagger
 * /api/conversations/{conversationId}/read:
 *   post:
 *     summary: Marca todas as mensagens da conversa como lidas
 *     tags: [Conversas]
 *     parameters:
 *       - in: path
 *         name: conversationId
 *         required: true
 *         schema:
 *           type: string
 *         description: Identificador da conversa
 *     responses:
 *       204:
 *         description: Conversa marcada como lida com sucesso
 *       404:
 *         description: Conversa não encontrada
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       500:
 *         description: Erro interno ao atualizar a conversa
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
router.post('/conversations/:conversationId/read', chatController_1.markConversationReadHandler);
exports.default = router;
