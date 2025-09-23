"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const agendaController_1 = require("../controllers/agendaController");
const router = (0, express_1.Router)();
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
 *         id_evento:
 *           type: integer
 *         tipo_evento:
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
 *     summary: Lista todas as agendas do usuário autenticado
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
router.get('/agendas', agendaController_1.listAgendas);
/**
 * @swagger
 * /api/agendas/empresa:
 *   get:
 *     summary: Lista todas as agendas da empresa vinculada ao usuário autenticado
 *     tags: [Agenda]
 *     responses:
 *       200:
 *         description: Lista de agendas da empresa
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/Agenda'
 */
router.get('/agendas/empresa', agendaController_1.listAgendasByEmpresa);
/**
 * @swagger
 * /api/agendas/total-hoje:
 *   get:
 *     summary: Retorna o total de compromissos de hoje do usuário autenticado
 *     tags: [Agenda]
 *     responses:
 *       200:
 *         description: Total de compromissos de hoje
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 total_compromissos_hoje:
 *                   type: integer
 */
router.get('/agendas/total-hoje', agendaController_1.getTotalCompromissosHoje);
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
 *               id:
 *                 type: integer
 *               titulo:
 *                 type: string
 *               id_evento:
 *                 type: integer
 *               tipo_evento:
 *                 type: string
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
router.post('/agendas', agendaController_1.createAgenda);
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
 *                 type: string
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
router.put('/agendas/:id', agendaController_1.updateAgenda);
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
router.delete('/agendas/:id', agendaController_1.deleteAgenda);
exports.default = router;
