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

