import { Router } from 'express';
import {
  listSituacoesProposta,
  createSituacaoProposta,
  updateSituacaoProposta,
  deleteSituacaoProposta,
} from '../controllers/situacaoPropostaController';

const router = Router();

const collectionPaths = [
  '/situacao-propostas',
  '/situacoes-proposta',
  '/situacoes-propostas',
  '/situacao-proposta',
];

const resourcePaths = Array.from(
  new Set(collectionPaths.map((path) => `${path.replace(/\/$/, '')}/:id`))
);


/**
 * @swagger
 * tags:
 *   - name: SituacaoProposta
 *     description: Endpoints para gerenciamento de situações da proposta
 * components:
 *   schemas:
 *     SituacaoProposta:
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
 * /api/situacao-propostas:
 *   get:
 *     summary: Lista todas as situações de proposta
 *     tags: [SituacaoProposta]
 *     responses:
 *       200:
 *         description: Lista de situações de proposta
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/SituacaoProposta'
 */

router.get('/situacao-propostas', listSituacoesProposta);

/**
 * @swagger
 * /api/situacao-propostas:
 *   post:
 *     summary: Cria uma nova situação de proposta
 *     tags: [SituacaoProposta]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/SituacaoProposta'
 *     responses:
 *       201:
 *         description: Situação de proposta criada
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/SituacaoProposta'
 */

router.post('/situacao-propostas', createSituacaoProposta);

/**
 * @swagger
 * /api/situacao-propostas/{id}:
 *   put:
 *     summary: Atualiza uma situação de proposta
 *     tags: [SituacaoProposta]
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
 *             $ref: '#/components/schemas/SituacaoProposta'
 *     responses:
 *       200:
 *         description: Situação de proposta atualizada
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/SituacaoProposta'
 *       404:
 *         description: Situação de proposta não encontrada
 */

router.put('/situacao-propostas/:id', updateSituacaoProposta);

/**
 * @swagger
 * /api/situacao-propostas/{id}:
 *   delete:
 *     summary: Remove uma situação de proposta
 *     tags: [SituacaoProposta]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       204:
 *         description: Situação de proposta removida
 *       404:
 *         description: Situação de proposta não encontrada
 */

router.delete('/situacao-propostas/:id', deleteSituacaoProposta);

export default router;
