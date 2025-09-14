import { Router } from 'express';
import {
  listTarefas,
  getTarefaById,
  createTarefa,
  updateTarefa,
  deleteTarefa,
} from '../controllers/tarefaController';

const router = Router();

/**
 * @swagger
 * tags:
 *   - name: Tarefas
 *     description: Endpoints para gerenciamento de tarefas
 * components:
 *   schemas:
 *     Tarefa:
 *       type: object
 *       properties:
 *         id:
 *           type: integer
 *         id_oportunidades:
 *           type: integer
 *         titulo:
 *           type: string
 *         descricao:
 *           type: string
 *         data:
 *           type: string
 *           format: date
 *         hora:
 *           type: string
 *           format: time
 *         dia_inteiro:
 *           type: boolean
 *         prioridade:
 *           type: integer
 *         mostrar_na_agenda:
 *           type: boolean
 *         privada:
 *           type: boolean
 *         recorrente:
 *           type: boolean
 *         repetir_quantas_vezes:
 *           type: integer
 *         repetir_cada_unidade:
 *           type: string
 *         repetir_intervalo:
 *           type: integer
 *         criado_em:
 *           type: string
 *           format: date-time
 *         atualizado_em:
 *           type: string
 *           format: date-time
 *         concluido:
 *           type: boolean
 */

/**
 * @swagger
 * /api/tarefas:
 *   get:
 *     summary: Lista todas as tarefas
 *     tags: [Tarefas]
 *     responses:
 *       200:
 *         description: Lista de tarefas
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/Tarefa'
 */
router.get('/tarefas', listTarefas);

/**
 * @swagger
 * /api/tarefas/{id}:
 *   get:
 *     summary: Obter tarefa por ID
 *     tags: [Tarefas]
 *     parameters:
 *       - in: path
 *         name: id
 *         schema:
 *           type: integer
 *         required: true
 *     responses:
 *       200:
 *         description: Tarefa encontrada
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Tarefa'
 *       404:
 *         description: Tarefa não encontrada
 */
router.get('/tarefas/:id', getTarefaById);

/**
 * @swagger
 * /api/tarefas:
 *   post:
 *     summary: Cria uma nova tarefa
 *     tags: [Tarefas]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/Tarefa'
 *     responses:
 *       201:
 *         description: Tarefa criada
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Tarefa'
 */
router.post('/tarefas', createTarefa);

/**
 * @swagger
 * /api/tarefas/{id}:
 *   put:
 *     summary: Atualiza uma tarefa
 *     tags: [Tarefas]
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
 *             $ref: '#/components/schemas/Tarefa'
 *     responses:
 *       200:
 *         description: Tarefa atualizada
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Tarefa'
 *       404:
 *         description: Tarefa não encontrada
 */
router.put('/tarefas/:id', updateTarefa);

/**
 * @swagger
 * /api/tarefas/{id}:
 *   delete:
 *     summary: Remove uma tarefa
 *     tags: [Tarefas]
 *     parameters:
 *       - in: path
 *         name: id
 *         schema:
 *           type: integer
 *         required: true
 *     responses:
 *       204:
 *         description: Tarefa removida
 *       404:
 *         description: Tarefa não encontrada
 */
router.delete('/tarefas/:id', deleteTarefa);

export default router;
