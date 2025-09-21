import { Router } from 'express';
import {
  listOportunidades,
  listOportunidadesByFase,
  getOportunidadeById,
  listEnvolvidosByOportunidade,
  createOportunidade,
  updateOportunidade,
  updateOportunidadeStatus,
  updateOportunidadeEtapa,
  deleteOportunidade,
  listOportunidadeFaturamentos,
  listOportunidadeParcelas,
  createOportunidadeFaturamento,
} from '../controllers/oportunidadeController';

const router = Router();

/**
 * @swagger
 * tags:
 *   - name: Oportunidades
 *     description: Endpoints para gerenciamento de oportunidades
 * components:
 *   schemas:
 *     OportunidadeEnvolvido:
 *       type: object
 *       properties:
 *         id:
 *           type: integer
 *         oportunidade_id:
 *           type: integer
 *         nome:
 *           type: string
 *         documento:
 *           type: string
 *         telefone:
 *           type: string
 *         endereco:
 *           type: string
 *         relacao:
 *           type: string
 *     Oportunidade:
 *       type: object
 *       properties:
 *         id:
 *           type: integer
 *         tipo_processo_id:
 *           type: integer
 *         area_atuacao_id:
 *           type: integer
 *         responsavel_id:
 *           type: integer
 *         numero_processo_cnj:
 *           type: string
 *         numero_protocolo:
 *           type: string
 *         vara_ou_orgao:
 *           type: string
 *         comarca:
 *           type: string
 *         fase_id:
 *           type: integer
 *         etapa_id:
 *           type: integer
 *         prazo_proximo:
 *           type: string
 *           format: date
 *         status_id:
 *           type: integer
 *         solicitante_id:
 *           type: integer
 *         valor_causa:
 *           type: number
 *         valor_honorarios:
 *           type: number
 *         percentual_honorarios:
 *           type: number
 *         forma_pagamento:
 *           type: string
 *         qtde_parcelas:
 *           type: integer
 *         contingenciamento:
 *           type: string
 *         detalhes:
 *           type: string
 *         documentos_anexados:
 *           type: integer
 *         criado_por:
 *           type: integer
 *         data_criacao:
 *           type: string
 *           format: date-time
 *         ultima_atualizacao:
 *           type: string
 *           format: date-time
 *         envolvidos:
 *           type: array
 *           items:
 *             $ref: '#/components/schemas/OportunidadeEnvolvido'
 */

/**
 * @swagger
 * /api/oportunidades:
 *   get:
 *     summary: Lista todas as oportunidades
 *     tags: [Oportunidades]
 *     responses:
 *       200:
 *         description: Lista de oportunidades
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/Oportunidade'
 */
router.get('/oportunidades', listOportunidades);

/**
 * @swagger
 * /api/oportunidades/fase/{faseId}:
 *   get:
 *     summary: Lista oportunidades por fluxo de trabalho
 *     tags: [Oportunidades]
 *     parameters:
 *       - in: path
 *         name: faseId
 *         schema:
 *           type: integer
 *         required: true
 *     responses:
 *       200:
 *         description: Lista de oportunidades filtradas por fase
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/Oportunidade'
 */
router.get('/oportunidades/fase/:faseId', listOportunidadesByFase);

/**
 * @swagger
 * /api/oportunidades/{id}:
 *   get:
 *     summary: Obtém uma oportunidade pelo ID
 *     tags: [Oportunidades]
 *     parameters:
 *       - in: path
 *         name: id
 *         schema:
 *           type: integer
 *         required: true
 *     responses:
 *       200:
 *         description: Dados da oportunidade
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Oportunidade'
 *       404:
 *         description: Oportunidade não encontrada
 */
router.get('/oportunidades/:id', getOportunidadeById);

/**
 * @swagger
 * /api/oportunidades/{id}/envolvidos:
 *   get:
 *     summary: Lista os envolvidos de uma oportunidade
 *     tags: [Oportunidades]
 *     parameters:
 *       - in: path
 *         name: id
 *         schema:
 *           type: integer
 *         required: true
 *     responses:
 *       200:
 *         description: Lista de envolvidos da oportunidade
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/OportunidadeEnvolvido'
 */
router.get('/oportunidades/:id/envolvidos', listEnvolvidosByOportunidade);

/**
 * @swagger
 * /api/oportunidades/{id}/parcelas:
 *   get:
 *     summary: Lista as parcelas registradas da oportunidade
 *     tags: [Oportunidades]
 *     parameters:
 *       - in: path
 *         name: id
 *         schema:
 *           type: integer
 *         required: true
 *     responses:
 *       200:
 *         description: Lista de parcelas da oportunidade
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 type: object
 *                 properties:
 *                   id:
 *                     type: integer
 *                   oportunidade_id:
 *                     type: integer
 *                   numero_parcela:
 *                     type: integer
 *                   valor:
 *                     type: number
 *                   valor_pago:
 *                     type: number
 *                   status:
 *                     type: string
 *                   data_prevista:
 *                     type: string
 *                     format: date
 *                   quitado_em:
 *                     type: string
 *                     format: date-time
 *                   faturamento_id:
 *                     type: integer
 *                   criado_em:
 *                     type: string
 *                     format: date-time
 *                   atualizado_em:
 *                     type: string
 *                     format: date-time
 */
router.get('/oportunidades/:id/parcelas', listOportunidadeParcelas);

/**
 * @swagger
 * /api/oportunidades/{id}/faturamentos:
 *   get:
 *     summary: Lista os faturamentos registrados para uma oportunidade
 *     tags: [Oportunidades]
 *     parameters:
 *       - in: path
 *         name: id
 *         schema:
 *           type: integer
 *         required: true
 *     responses:
 *       200:
 *         description: Lista de faturamentos registrados
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 type: object
 *                 properties:
 *                   id:
 *                     type: integer
 *                   oportunidade_id:
 *                     type: integer
 *                   forma_pagamento:
 *                     type: string
 *                   condicao_pagamento:
 *                     type: string
 *                   valor:
 *                     type: number
 *                   parcelas:
 *                     type: integer
 *                   observacoes:
 *                     type: string
 *                   data_faturamento:
 *                     type: string
 *                     format: date-time
 *                   criado_em:
 *                     type: string
 *                     format: date-time
 */
router.get('/oportunidades/:id/faturamentos', listOportunidadeFaturamentos);

/**
 * @swagger
 * /api/oportunidades/{id}/faturamentos:
 *   post:
 *     summary: Registra um faturamento para a oportunidade
 *     tags: [Oportunidades]
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
 *             properties:
 *               forma_pagamento:
 *                 type: string
 *               condicao_pagamento:
 *                 type: string
 *                 enum: ["À vista", "Parcelado"]
 *               valor:
 *                 type: number
 *               parcelas:
 *                 type: integer
 *               parcelas_ids:
 *                 type: array
 *                 items:
 *                   type: integer
 *                 description: Lista opcional de IDs de parcelas pendentes para atualizar como quitadas.
 *               observacoes:
 *                 type: string
 *               data_faturamento:
 *                 type: string
 *                 format: date
 *     responses:
 *       201:
 *         description: Faturamento registrado com sucesso
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 id:
 *                   type: integer
 *                 oportunidade_id:
 *                   type: integer
 *                 forma_pagamento:
 *                   type: string
 *                 condicao_pagamento:
 *                   type: string
 *                 valor:
 *                   type: number
 *                 parcelas:
 *                   type: integer
 *                 observacoes:
 *                   type: string
 *                 data_faturamento:
 *                   type: string
 *                   format: date-time
 *                 criado_em:
 *                   type: string
 *                   format: date-time
 */
router.post('/oportunidades/:id/faturamentos', createOportunidadeFaturamento);

/**
 * @swagger
 * /api/oportunidades:
 *   post:
 *     summary: Cria uma nova oportunidade
 *     tags: [Oportunidades]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               tipo_processo_id:
 *                 type: integer
 *               area_atuacao_id:
 *                 type: integer
 *               responsavel_id:
 *                 type: integer
 *               numero_processo_cnj:
 *                 type: string
 *               numero_protocolo:
 *                 type: string
 *               vara_ou_orgao:
 *                 type: string
 *               comarca:
 *                 type: string
 *               fase_id:
 *                 type: integer
 *               etapa_id:
 *                 type: integer
 *               prazo_proximo:
 *                 type: string
 *                 format: date
 *               status_id:
 *                 type: integer
 *               solicitante_id:
 *                 type: integer
 *               valor_causa:
 *                 type: number
 *               valor_honorarios:
 *                 type: number
*               percentual_honorarios:
*                 type: number
*               forma_pagamento:
*                 type: string
 *               qtde_parcelas:
 *                 type: integer
*               contingenciamento:
*                 type: string
 *               detalhes:
 *                 type: string
 *               documentos_anexados:
 *                 type: integer
 *               criado_por:
 *                 type: integer
 *               envolvidos:
 *                 type: array
 *                 items:
 *                   type: object
 *                   properties:
 *                     nome:
 *                       type: string
 *                     cpf_cnpj:
 *                       type: string
 *                     telefone:
 *                       type: string
 *                     endereco:
 *                       type: string
 *                     relacao:
 *                       type: string
 *     responses:
 *       201:
 *         description: Oportunidade criada
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Oportunidade'
 */
router.post('/oportunidades', createOportunidade);

/**
 * @swagger
 * /api/oportunidades/{id}:
 *   put:
 *     summary: Atualiza uma oportunidade existente
 *     tags: [Oportunidades]
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
 *             properties:
 *               tipo_processo_id:
 *                 type: integer
 *               area_atuacao_id:
 *                 type: integer
 *               responsavel_id:
 *                 type: integer
 *               numero_processo_cnj:
 *                 type: string
 *               numero_protocolo:
 *                 type: string
 *               vara_ou_orgao:
 *                 type: string
 *               comarca:
 *                 type: string
 *               fase_id:
 *                 type: integer
 *               etapa_id:
 *                 type: integer
 *               prazo_proximo:
 *                 type: string
 *                 format: date
 *               status_id:
 *                 type: integer
 *               solicitante_id:
 *                 type: integer
 *               valor_causa:
 *                 type: number
 *               valor_honorarios:
 *                 type: number
*               percentual_honorarios:
*                 type: number
*               forma_pagamento:
*                 type: string
 *               qtde_parcelas:
 *                 type: integer
*               contingenciamento:
*                 type: string
 *               detalhes:
 *                 type: string
 *               documentos_anexados:
 *                 type: integer
 *               criado_por:
 *                 type: integer
 *               envolvidos:
 *                 type: array
 *                 items:
 *                   type: object
 *                   properties:
 *                     nome:
 *                       type: string
 *                     cpf_cnpj:
 *                       type: string
 *                     telefone:
 *                       type: string
 *                     endereco:
 *                       type: string
 *                     relacao:
 *                       type: string
 *     responses:
 *       200:
 *         description: Oportunidade atualizada
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Oportunidade'
 *       404:
 *         description: Oportunidade não encontrada
 */
router.put('/oportunidades/:id', updateOportunidade);

/**
 * @swagger
 * /api/oportunidades/{id}/status:
 *   patch:
 *     summary: Atualiza o status de uma oportunidade
 *     tags: [Oportunidades]
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
 *             properties:
 *               status_id:
 *                 type: integer
 *     responses:
 *       200:
 *         description: Status atualizado
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Oportunidade'
 *       404:
 *         description: Oportunidade não encontrada
 */
router.patch('/oportunidades/:id/status', updateOportunidadeStatus);

/**
 * @swagger
 * /api/oportunidades/{id}/etapa:
 *   patch:
 *     summary: Atualiza a etapa de uma oportunidade
 *     tags: [Oportunidades]
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
 *             properties:
 *               etapa_id:
 *                 type: integer
 *     responses:
 *       200:
 *         description: Etapa atualizada
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Oportunidade'
 *       404:
 *         description: Oportunidade não encontrada
 */
router.patch('/oportunidades/:id/etapa', updateOportunidadeEtapa);

/**
 * @swagger
 * /api/oportunidades/{id}:
 *   delete:
 *     summary: Remove uma oportunidade
 *     tags: [Oportunidades]
 *     parameters:
 *       - in: path
 *         name: id
 *         schema:
 *           type: integer
 *         required: true
 *     responses:
 *       204:
 *         description: Oportunidade removida
 *       404:
 *         description: Oportunidade não encontrada
 */
router.delete('/oportunidades/:id', deleteOportunidade);

export default router;

