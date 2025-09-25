import { Router } from 'express';
import {
  listProcessos,
  listProcessosByCliente,
  getProcessoById,
  createProcesso,
  updateProcesso,
  deleteProcesso,
} from '../controllers/processoController';
import {
  triggerManualJuditSync,
  getJuditRequestStatus,
} from '../controllers/juditProcessController';

const router = Router();

/**
 * @swagger
 * tags:
 *   - name: Processos
 *     description: Endpoints para gerenciamento de processos judiciais
 * components:
 *   schemas:
 *     Processo:
 *       type: object
 *       properties:
 *         id:
 *           type: integer
 *         cliente_id:
 *           type: integer
 *         numero:
 *           type: string
 *         uf:
 *           type: string
 *         municipio:
 *           type: string
 *         orgao_julgador:
 *           type: string
 *         tipo:
 *           type: string
 *         status:
 *           type: string
 *         classe_judicial:
 *           type: string
 *         assunto:
 *           type: string
 *         jurisdicao:
 *           type: string
 *         advogado_responsavel:
 *           type: string
 *         data_distribuicao:
 *           type: string
 *           format: date
 *         ultima_sincronizacao:
 *           type: string
 *           format: date-time
 *         consultas_api_count:
 *           type: integer
 *         movimentacoes_count:
 *           type: integer
 *         advogados:
 *           type: array
 *           items:
 *             type: object
 *             properties:
 *               id:
 *                 type: integer
 *               nome:
 *                 type: string
 *         criado_em:
 *           type: string
 *           format: date-time
 *         atualizado_em:
 *           type: string
 *           format: date-time
 *         cliente:
 *           type: object
 *           nullable: true
 *           properties:
 *             id:
 *               type: integer
 *             nome:
 *               type: string
 *             documento:
 *               type: string
 *             tipo:
 *               type: string
 *         judit_syncs:
 *           type: array
 *           items:
 *             $ref: '#/components/schemas/ProcessoSync'
 *         judit_responses:
 *           type: array
 *           items:
 *             $ref: '#/components/schemas/ProcessoSyncResponse'
 *         judit_audit_trail:
 *           type: array
 *           items:
 *             $ref: '#/components/schemas/ProcessoSyncAudit'
 *     ProcessoSyncIntegration:
 *       type: object
 *       properties:
 *         id:
 *           type: integer
 *         provider:
 *           type: string
 *         environment:
 *           type: string
 *         apiUrl:
 *           type: string
 *           nullable: true
 *         active:
 *           type: boolean
 *     ProcessoSync:
 *       type: object
 *       properties:
 *         id:
 *           type: integer
 *         processoId:
 *           type: integer
 *           nullable: true
 *         integrationApiKeyId:
 *           type: integer
 *           nullable: true
 *         integration:
 *           $ref: '#/components/schemas/ProcessoSyncIntegration'
 *         remoteRequestId:
 *           type: string
 *           nullable: true
 *         requestType:
 *           type: string
 *         requestedBy:
 *           type: integer
 *           nullable: true
 *         requestedAt:
 *           type: string
 *           format: date-time
 *         requestPayload:
 *           type: object
 *           additionalProperties: true
 *         requestHeaders:
 *           type: object
 *           nullable: true
 *           additionalProperties: true
 *         status:
 *           type: string
 *         statusReason:
 *           type: string
 *           nullable: true
 *         completedAt:
 *           type: string
 *           format: date-time
 *           nullable: true
 *         metadata:
 *           type: object
 *           additionalProperties: true
 *         createdAt:
 *           type: string
 *           format: date-time
 *         updatedAt:
 *           type: string
 *           format: date-time
 *     ProcessoSyncResponse:
 *       type: object
 *       properties:
 *         id:
 *           type: integer
 *         processoId:
 *           type: integer
 *           nullable: true
 *         processSyncId:
 *           type: integer
 *           nullable: true
 *         integrationApiKeyId:
 *           type: integer
 *           nullable: true
 *         integration:
 *           $ref: '#/components/schemas/ProcessoSyncIntegration'
 *         deliveryId:
 *           type: string
 *           nullable: true
 *         source:
 *           type: string
 *         statusCode:
 *           type: integer
 *           nullable: true
 *         receivedAt:
 *           type: string
 *           format: date-time
 *         payload:
 *           type: object
 *           additionalProperties: true
 *         headers:
 *           type: object
 *           nullable: true
 *           additionalProperties: true
 *         errorMessage:
 *           type: string
 *           nullable: true
 *         createdAt:
 *           type: string
 *           format: date-time
 *     ProcessoSyncAudit:
 *       type: object
 *       properties:
 *         id:
 *           type: integer
 *         processoId:
 *           type: integer
 *           nullable: true
 *         processSyncId:
 *           type: integer
 *           nullable: true
 *         processResponseId:
 *           type: integer
 *           nullable: true
 *         integrationApiKeyId:
 *           type: integer
 *           nullable: true
 *         integration:
 *           $ref: '#/components/schemas/ProcessoSyncIntegration'
 *         eventType:
 *           type: string
 *         eventDetails:
 *           type: object
 *           additionalProperties: true
 *         observedAt:
 *           type: string
 *           format: date-time
 *         createdAt:
 *           type: string
 *           format: date-time

*/

/**
 * @swagger
 * /api/processos:
 *   get:
 *     summary: Lista todos os processos cadastrados
 *     tags: [Processos]
 *     responses:
 *       200:
 *         description: Lista de processos
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/Processo'
 */
router.get('/processos', listProcessos);

/**
 * @swagger
 * /api/clientes/{clienteId}/processos:
 *   get:
 *     summary: Lista processos vinculados a um cliente específico
 *     tags: [Processos]
 *     parameters:
 *       - in: path
 *         name: clienteId
 *         schema:
 *           type: integer
 *         required: true
 *     responses:
 *       200:
 *         description: Lista de processos do cliente
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/Processo'
 *       400:
 *         description: Identificador do cliente inválido
 */
router.get('/clientes/:clienteId/processos', listProcessosByCliente);

/**
 * @swagger
 * /api/processos/{id}:
 *   get:
 *     summary: Obtém os detalhes de um processo
 *     tags: [Processos]
 *     parameters:
 *       - in: path
 *         name: id
 *         schema:
 *           type: integer
 *         required: true
 *     responses:
 *       200:
 *         description: Dados do processo
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Processo'
 *       400:
 *         description: Identificador inválido
 *       404:
 *         description: Processo não encontrado
 */
router.get('/processos/:id', getProcessoById);

/**
 * @swagger

/**
 * @swagger
 * /api/processos/{id}/judit/sync:
 *   post:
 *     summary: Força sincronização manual do processo via Judit
 *     tags: [Processos]
 *     parameters:
 *       - in: path
 *         name: id
 *         schema:
 *           type: integer
 *         required: true
 *     responses:
 *       200:
 *         description: Dados da request acionada
 *       400:
 *         description: Parâmetros inválidos
 *       401:
 *         description: Não autorizado
 */
router.post('/processos/:id/judit/sync', triggerManualJuditSync);

/**
 * @swagger
 * /api/processos/{id}/judit/requests/{requestId}:
 *   get:
 *     summary: Consulta status e resultado de uma request Judit
 *     tags: [Processos]
 *     parameters:
 *       - in: path
 *         name: id
 *         schema:
 *           type: integer
 *         required: true
 *       - in: path
 *         name: requestId
 *         schema:
 *           type: string
 *         required: true
 *     responses:
 *       200:
 *         description: Status da request
 *       404:
 *         description: Request não encontrada
 */
router.get('/processos/:id/judit/requests/:requestId', getJuditRequestStatus);

/**
 * @swagger
 * /api/processos:
 *   post:
 *     summary: Cadastra um novo processo
 *     tags: [Processos]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - cliente_id
 *               - numero
 *               - uf
 *               - municipio
 *             properties:
 *               cliente_id:
 *                 type: integer
 *               numero:
 *                 type: string
 *               uf:
 *                 type: string
 *               municipio:
 *                 type: string
 *               tipo:
 *                 type: string
 *               status:
 *                 type: string
 *               classe_judicial:
 *                 type: string
 *               assunto:
 *                 type: string
 *               jurisdicao:
 *                 type: string
 *               advogado_responsavel:
 *                 type: string
 *               data_distribuicao:
 *                 type: string
 *                 format: date
 *               advogados:
 *                 type: array
 *                 items:
 *                   type: integer
 *     responses:
 *       201:
 *         description: Processo criado com sucesso
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Processo'
 *       400:
 *         description: Dados inválidos
 *       409:
 *         description: Número de processo já cadastrado
 */
router.post('/processos', createProcesso);

/**
 * @swagger

/**
 * @swagger
 * /api/processos/{id}:
 *   put:
 *     summary: Atualiza um processo existente
 *     tags: [Processos]
 *     parameters:
 *       - in: path
 *         name: id
 *         schema:
 *           type: integer
 *         required: true
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - cliente_id
 *               - numero
 *               - uf
 *               - municipio
 *             properties:
 *               cliente_id:
 *                 type: integer
 *               numero:
 *                 type: string
 *               uf:
 *                 type: string
 *               municipio:
 *                 type: string
 *               tipo:
 *                 type: string
 *               status:
 *                 type: string
 *               classe_judicial:
 *                 type: string
 *               assunto:
 *                 type: string
 *               jurisdicao:
 *                 type: string
 *               advogado_responsavel:
 *                 type: string
 *               data_distribuicao:
 *                 type: string
 *                 format: date
 *               advogados:
 *                 type: array
 *                 items:
 *                   type: integer
 *     responses:
 *       200:
 *         description: Processo atualizado
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Processo'
 *       400:
 *         description: Dados inválidos
 *       404:
 *         description: Processo não encontrado
 */
router.put('/processos/:id', updateProcesso);

/**
 * @swagger
 * /api/processos/{id}:
 *   delete:
 *     summary: Remove um processo cadastrado
 *     tags: [Processos]
 *     parameters:
 *       - in: path
 *         name: id
 *         schema:
 *           type: integer
 *         required: true
 *     responses:
 *       204:
 *         description: Processo removido
 *       400:
 *         description: Identificador inválido
 *       404:
 *         description: Processo não encontrado
 */
router.delete('/processos/:id', deleteProcesso);

export default router;
