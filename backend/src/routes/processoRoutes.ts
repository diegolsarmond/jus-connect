import { Router } from 'express';
import {
  listProcessos,
  listProcessosByCliente,
  getProcessoById,
  getProcessoMovimentacoes,
  createProcesso,
  updateProcesso,
  deleteProcesso,
} from '../controllers/processoController';

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
 *         datajud_tipo_justica:
 *           type: string
 *           nullable: true
 *         datajud_alias:
 *           type: string
 *           nullable: true
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
 *               - orgao_julgador
 *             properties:
 *               cliente_id:
 *                 type: integer
 *               numero:
 *                 type: string
 *               uf:
 *                 type: string
 *               municipio:
 *                 type: string
 *               orgao_julgador:
 *                 type: string
 *               datajud_tipo_justica:
 *                 type: string
 *               datajud_alias:
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
 * /api/processos/{id}/movimentacoes:
 *   get:
 *     summary: Lista as movimentações do processo via Datajud
 *     tags: [Processos]
 *     parameters:
 *       - in: path
 *         name: id
 *         schema:
 *           type: integer
 *         required: true
 *     responses:
 *       200:
 *         description: Movimentações obtidas com sucesso
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 type: object
 *                 properties:
 *                   codigo:
 *                     type: integer
 *                     nullable: true
 *                   nome:
 *                     type: string
 *                   descricao:
 *                     type: string
 *                   dataHora:
 *                     type: string
 *                     format: date-time
 *                     nullable: true
 *       400:
 *         description: Identificador inválido
 *       404:
 *         description: Processo não encontrado
 *       502:
 *         description: Erro ao consultar a API pública do Datajud
 */
router.get('/processos/:id/movimentacoes', getProcessoMovimentacoes);

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
 *               - orgao_julgador
 *             properties:
 *               cliente_id:
 *                 type: integer
 *               numero:
 *                 type: string
 *               uf:
 *                 type: string
 *               municipio:
 *                 type: string
 *               orgao_julgador:
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
