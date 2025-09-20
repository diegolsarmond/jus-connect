import { Router } from 'express';
import {
  createIntegrationApiKey,
  deleteIntegrationApiKey,
  getIntegrationApiKey,
  listIntegrationApiKeys,
  updateIntegrationApiKey,
} from '../controllers/integrationApiKeyController';
import { generateTextWithIntegration } from '../controllers/aiGenerationController';
import { getAsaasWebhookSecret } from '../controllers/asaasIntegrationController';

const router = Router();

/**
 * @swagger
 * tags:
 *   - name: Integrações
 *     description: Gerenciamento de chaves de API para integrações de IA
 */

/**
 * @swagger
 * /api/integrations/api-keys:
 *   get:
 *     summary: Lista as chaves de API configuradas
 *     tags: [Integrações]
 *     responses:
 *       200:
 *         description: Lista de chaves de API
 */
router.get('/integrations/api-keys', listIntegrationApiKeys);

/**
 * @swagger
 * /api/integrations/api-keys/{id}:
 *   get:
 *     summary: Recupera os detalhes de uma chave de API específica
 *     tags: [Integrações]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Chave de API localizada
 *       404:
 *         description: Chave não encontrada
 */
router.get('/integrations/api-keys/:id', getIntegrationApiKey);

/**
 * @swagger
 * /api/integrations/api-keys:
 *   post:
 *     summary: Cadastra uma nova chave de API
 *     tags: [Integrações]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - provider
 *               - key
 *               - environment
 *             properties:
 *               provider:
 *                 type: string
 *                 enum: [gemini, openai]
 *               apiUrl:
 *                 type: string
 *                 format: uri
 *                 description: URL base da API utilizada pela integração
 *               key:
 *                 type: string
 *               environment:
 *                 type: string
 *                 enum: [producao, homologacao]
 *               active:
 *                 type: boolean
 *               lastUsed:
 *                 type: string
 *                 format: date-time
 *     responses:
 *       201:
 *         description: Chave criada
 */
router.post('/integrations/api-keys', createIntegrationApiKey);

/**
 * @swagger
 * /api/integrations/api-keys/{id}:
 *   patch:
 *     summary: Atualiza uma chave de API existente
 *     tags: [Integrações]
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
 *               provider:
 *                 type: string
 *                 enum: [gemini, openai]
 *               apiUrl:
 *                 type: string
 *                 format: uri
 *               key:
 *                 type: string
 *               environment:
 *                 type: string
 *                 enum: [producao, homologacao]
 *               active:
 *                 type: boolean
 *               lastUsed:
 *                 type: string
 *                 format: date-time
 *     responses:
 *       200:
 *         description: Chave atualizada
 *       404:
 *         description: Chave não encontrada
 */
router.patch('/integrations/api-keys/:id', updateIntegrationApiKey);

/**
 * @swagger
 * /api/integrations/api-keys/{id}:
 *   delete:
 *     summary: Remove uma chave de API
 *     tags: [Integrações]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       204:
 *         description: Chave removida com sucesso
 *       404:
 *         description: Chave não encontrada
 */
router.delete('/integrations/api-keys/:id', deleteIntegrationApiKey);

/**
 * @swagger
 * /api/integrations/ai/generate:
 *   post:
 *     summary: Gera um texto com IA utilizando uma integração cadastrada
 *     tags: [Integrações]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - integrationId
 *               - documentType
 *               - prompt
 *             properties:
 *               integrationId:
 *                 type: integer
 *               documentType:
 *                 type: string
 *               prompt:
 *                 type: string
 *     responses:
 *       200:
 *         description: Texto gerado com sucesso
 *       400:
 *         description: Requisição inválida
 *       404:
 *         description: Integração não encontrada ou inativa
 */
router.post('/integrations/ai/generate', generateTextWithIntegration);

router.get('/integrations/asaas/credentials/:credentialId/webhook-secret', getAsaasWebhookSecret);

export default router;
