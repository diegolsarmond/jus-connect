import { Router } from 'express';
import { listSituacoesProcesso, createSituacaoProcesso, updateSituacaoProcesso, deleteSituacaoProcesso, } from '../controllers/situacaoProcessoController';
const router = Router();
/**
 * @swagger
 * tags:
 *   - name: SituacoesProcesso
 *     description: Endpoints para gerenciamento de situações de processo
 * components:
 *   schemas:
 *     SituacaoProcesso:
 *       type: object
 *       properties:
 *         id:
 *           type: integer
 *         nome:
 *           type: string
 *         ativo:
 *           type: boolean
 *         datacriacao:
 *           type: string
 *           format: date-time
 */
/**
 * @swagger
 * /api/situacoes-processo:
 *   get:
 *     summary: Lista todas as situações de processo
 *     tags: [SituacoesProcesso]
 *     responses:
 *       200:
 *         description: Lista de situações de processo
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/SituacaoProcesso'
 */
router.get('/situacoes-processo', listSituacoesProcesso);
/**
 * @swagger
 * /api/situacoes-processo:
 *   post:
 *     summary: Cria uma nova situação de processo
 *     tags: [SituacoesProcesso]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               nome:
 *                 type: string
 *               ativo:
 *                 type: boolean
 *     responses:
 *       201:
 *         description: Situação de processo criada
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/SituacaoProcesso'
 */
router.post('/situacoes-processo', createSituacaoProcesso);
/**
 * @swagger
 * /api/situacoes-processo/{id}:
 *   put:
 *     summary: Atualiza uma situação de processo existente
 *     tags: [SituacoesProcesso]
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
 *               nome:
 *                 type: string
 *               ativo:
 *                 type: boolean
 *     responses:
 *       200:
 *         description: Situação de processo atualizada
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/SituacaoProcesso'
 *       404:
 *         description: Situação de processo não encontrada
 */
router.put('/situacoes-processo/:id', updateSituacaoProcesso);
/**
 * @swagger
 * /api/situacoes-processo/{id}:
 *   delete:
 *     summary: Remove uma situação de processo
 *     tags: [SituacoesProcesso]
 *     parameters:
 *       - in: path
 *         name: id
 *         schema:
 *           type: integer
 *         required: true
 *     responses:
 *       204:
 *         description: Situação de processo removida
 *       404:
 *         description: Situação de processo não encontrada
 */
router.delete('/situacoes-processo/:id', deleteSituacaoProcesso);
export default router;
