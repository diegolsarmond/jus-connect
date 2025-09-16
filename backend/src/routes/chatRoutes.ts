import { Router } from 'express';
import {
  createConversationHandler,
  getConversationMessagesHandler,
  listConversationsHandler,
  markConversationReadHandler,
  sendConversationMessageHandler,
  wahaWebhookHandler,
} from '../controllers/chatController';
import {
  getWahaConfigHandler,
  updateWahaConfigHandler,
} from '../controllers/wahaIntegrationController';

const router = Router();

/**
 * @swagger
 * tags:
 *   - name: Conversas
 *     description: Endpoints para gerenciamento de conversas e integrações de mensagens
 *   - name: Integrações
 *     description: Integrações com plataformas externas de comunicação
 * components:
 *   schemas:
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

router.get('/conversations', listConversationsHandler);
router.post('/conversations', createConversationHandler);
router.get('/conversations/:conversationId/messages', getConversationMessagesHandler);
router.post('/conversations/:conversationId/messages', sendConversationMessageHandler);
router.post('/conversations/:conversationId/read', markConversationReadHandler);
router.post('/webhooks/waha', wahaWebhookHandler);

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
 */
router.get('/integrations/waha', getWahaConfigHandler);

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
 *       500:
 *         description: Erro interno ao salvar a configuração
 */
router.put('/integrations/waha', updateWahaConfigHandler);

export default router;
