"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const chatController_1 = require("../controllers/chatController");
const wahaIntegrationController_1 = require("../controllers/wahaIntegrationController");
const wahaChatProxyController_1 = require("../controllers/wahaChatProxyController");
const router = (0, express_1.Router)();
/**
 * @swagger
 * tags:
 *   - name: Conversas
 *     description: Endpoints para gerenciamento de conversas e integrações de mensagens
 *   - name: Integrações
 *     description: Integrações com plataformas externas de comunicação
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
 *           description: Identificador do contato ou chat no provedor externo
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

 *     WahaIntegrationConfig:
 *       type: object
 *       required:
 *         - baseUrl
 *         - apiKey
 *         - isActive
 *         - createdAt
 *         - updatedAt
 *       properties:
 *         baseUrl:
 *           type: string
 *           format: uri
 *           description: URL base do servidor WAHA, sem barra no final
 *         apiKey:
 *           type: string
 *           description: Chave utilizada para autenticar as requisições ao WAHA
 *         webhookSecret:
 *           type: string
 *           nullable: true
 *           description: Segredo opcional para validação do webhook recebido
 *         isActive:
 *           type: boolean
 *           description: Indica se a integração está ativa para envio/recebimento de mensagens
 *         createdAt:
 *           type: string
 *           format: date-time
 *           description: Data de criação do registro de configuração
 *         updatedAt:
 *           type: string
 *           format: date-time
 *           description: Data da última atualização da configuração
 */
/**
 * @swagger
 * /api/conversations:
 *   get:
 *     summary: Lista conversas sincronizadas com o WAHA
 *     tags: [Conversas]
 *     parameters:
 *       - in: query
 *         name: session
 *         schema:
 *           type: string
 *         description: Identificador da sessão WAHA (ex.: QuantumTecnologia01) para filtrar a consulta remota.
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 200
 *         description: Quantidade máxima de chats retornados por sessão ao consultar o WAHA (padrão 30).
 *       - in: query
 *         name: source
 *         schema:
 *           type: string
 *           enum: [waha, local]
 *         description: Define a origem dos dados. Utilize `local` para ignorar o WAHA e retornar apenas registros persistidos.
 *     summary: Lista todas as conversas cadastradas
 *     tags: [Conversas]
 *     responses:
 *       200:
 *         description: Lista de conversas ordenadas pela atividade mais recente
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/ConversationSummary'
 *       400:
 *         description: Parâmetros inválidos para consulta remota
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       502:
 *         description: Falha ao consultar o WAHA
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'

 *       500:
 *         description: Erro interno ao listar conversas
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
router.get('/conversations', chatController_1.listConversationsHandler);
router.get('/chats', wahaChatProxyController_1.listWahaChatsProxyHandler);
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
 *     summary: Envia uma mensagem através da integração WAHA
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
 *       503:
 *         description: Integração WAHA não configurada ou desativada
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       502:
 *         description: Erro ao entregar a mensagem ao provedor
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
/**
 * @swagger
 * /api/webhooks/waha:
 *   post:
 *     summary: Recebe eventos de mensagens do WAHA
 *     tags: [Integrações]
 *     requestBody:
 *       required: true
 *       description: Payload de webhook encaminhado pelo servidor WAHA
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             additionalProperties: true
 *     responses:
 *       204:
 *         description: Webhook processado com sucesso
 *       400:
 *         description: Payload inválido recebido
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       401:
 *         description: Falha na validação da assinatura do webhook
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       503:
 *         description: Integração WAHA desativada ou não configurada
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       500:
 *         description: Erro inesperado ao processar o webhook
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
router.post('/webhooks/waha', chatController_1.wahaWebhookHandler);
/**
 * @swagger
 * /api/integrations/waha:
 *   get:
 *     summary: Obtém a configuração atual da integração com o WAHA
 *     tags: [Integrações]
 *     responses:
 *       200:
 *         description: Configuração encontrada ou null caso não exista
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/WahaIntegrationConfig'
 *               nullable: true
 *             examples:
 *               configurado:
 *                 summary: Configuração ativa
 *                 value:
 *                   baseUrl: https://waha.example.com
 *                   apiKey: super-secret
 *                   webhookSecret: webhook-secret
 *                   isActive: true
 *                   createdAt: '2024-05-05T12:00:00.000Z'
 *                   updatedAt: '2024-05-06T08:30:00.000Z'
 *               naoConfigurado:
 *                 summary: Configuração ausente
 *                 value: null
 *       500:
 *         description: Erro interno ao carregar a configuração
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'

 */
router.get('/integrations/waha', wahaIntegrationController_1.getWahaConfigHandler);
/**
 * @swagger
 * /api/integrations/waha:
 *   put:
 *     summary: Cria ou atualiza a configuração da integração com o WAHA
 *     tags: [Integrações]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - baseUrl
 *               - apiKey
 *             properties:
 *               baseUrl:
 *                 type: string
 *                 format: uri
 *                 example: https://waha.example.com
 *               apiKey:
 *                 type: string
 *                 example: super-secret
 *               webhookSecret:
 *                 type: string
 *                 nullable: true
 *                 example: webhook-secret
 *               isActive:
 *                 type: boolean
 *                 example: true
 *     responses:
 *       200:
 *         description: Configuração salva com sucesso
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/WahaIntegrationConfig'
 *       400:
 *         description: Dados inválidos enviados para configuração
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       500:
 *         description: Erro interno ao salvar a configuração
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'

 */
router.put('/integrations/waha', wahaIntegrationController_1.updateWahaConfigHandler);
exports.default = router;
