import { Router } from 'express';
import {
  listAgendas,
  createAgenda,
  updateAgenda,
  deleteAgenda,
} from '../controllers/agendaController';

const router = Router();

/**
 * @swagger
 * tags:
 *   - name: Agenda
 *     description: Endpoints para gerenciamento de agendas
 * components:
 *   schemas:
 *     Agenda:
 *       type: object
 *       properties:
 *         id:
 *           type: integer
 *         titulo:
 *           type: string
 *         tipo:
 *           type: integer
 *         descricao:
 *           type: string
 *         data:
 *           type: string
 *           format: date
 *         hora_inicio:
 *           type: string
 *           format: time
 *         hora_fim:
 *           type: string
 *           format: time
 *         cliente:
 *           type: integer
 *         tipo_local:
 *           type: string
 *         local:
 *           type: string
 *         lembrete:
 *           type: boolean
 *         status:
 *           type: integer
 *         datacadastro:
 *           type: string
 *           format: date-time
 */

/**
 * @swagger
 * /api/agendas:
 *   get:
 *     summary: Lista todas as agendas
 *     tags: [Agenda]
 *     responses:
 *       200:
 *         description: Lista de agendas
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/Agenda'
 */
router.get('/agendas', listAgendas);

/**
 * @swagger
 * /api/agendas:
 *   post:
 *     summary: Cria uma nova agenda
 *     tags: [Agenda]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               titulo:
 *                 type: string
 *               tipo:
 *                 type: integer
 *               descricao:
 *                 type: string
 *               data:
 *                 type: string
 *                 format: date
 *               hora_inicio:
 *                 type: string
 *                 format: time
 *               hora_fim:
 *                 type: string
 *                 format: time
 *               cliente:
 *                 type: integer
 *               tipo_local:
 *                 type: string
 *               local:
 *                 type: string
 *               lembrete:
 *                 type: boolean
 *               status:
 *                 type: integer
 *     responses:
 *       201:
 *         description: Agenda criada
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Agenda'
 */
router.post('/agendas', createAgenda);

/**
 * @swagger
 * /api/agendas/{id}:
 *   put:
 *     summary: Atualiza uma agenda existente
 *     tags: [Agenda]
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
 *               titulo:
 *                 type: string
 *               tipo:
 *                 type: integer
 *               descricao:
 *                 type: string
 *               data:
 *                 type: string
 *                 format: date
 *               hora_inicio:
 *                 type: string
 *                 format: time
 *               hora_fim:
 *                 type: string
 *                 format: time
 *               cliente:
 *                 type: integer
 *               tipo_local:
 *                 type: string
 *               local:
 *                 type: string
 *               lembrete:
 *                 type: boolean
 *               status:
 *                 type: integer
 *     responses:
 *       200:
 *         description: Agenda atualizada
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Agenda'
 *       404:
 *         description: Agenda não encontrada
 */
router.put('/agendas/:id', updateAgenda);

/**
 * @swagger
 * /api/agendas/{id}:
 *   delete:
 *     summary: Remove uma agenda
 *     tags: [Agenda]
 *     parameters:
 *       - in: path
 *         name: id
 *         schema:
 *           type: integer
 *         required: true
 *     responses:
 *       204:
 *         description: Agenda removida
 *       404:
 *         description: Agenda não encontrada
 */
router.delete('/agendas/:id', deleteAgenda);

export default router;

