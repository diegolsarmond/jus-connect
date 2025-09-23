"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const userProfileController_1 = require("../controllers/userProfileController");
const router = (0, express_1.Router)();
/**
 * @swagger
 * tags:
 *   - name: MeuPerfil
 *     description: Endpoints para gerenciamento do perfil do usuário autenticado
 */
/**
 * @swagger
 * /api/me/profile:
 *   get:
 *     summary: Recupera o perfil do usuário autenticado
 *     tags: [MeuPerfil]
 *     responses:
 *       200:
 *         description: Dados do perfil do usuário
 *   patch:
 *     summary: Atualiza informações do perfil do usuário
 *     tags: [MeuPerfil]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             description: Campos a serem atualizados no perfil
 *     responses:
 *       200:
 *         description: Perfil atualizado
 */
router.get('/me/profile', userProfileController_1.getMyProfile);
router.patch('/me/profile', userProfileController_1.updateMyProfile);
/**
 * @swagger
 * /api/me/profile/audit-logs:
 *   get:
 *     summary: Lista eventos de auditoria do perfil do usuário
 *     tags: [MeuPerfil]
 *     parameters:
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *         description: Quantidade de registros retornados
 *       - in: query
 *         name: offset
 *         schema:
 *           type: integer
 *         description: Deslocamento da consulta
 *     responses:
 *       200:
 *         description: Lista de eventos de auditoria
 */
router.get('/me/profile/audit-logs', userProfileController_1.listMyAuditLogs);
/**
 * @swagger
 * /api/me/profile/sessions:
 *   get:
 *     summary: Lista sessões e dispositivos do usuário
 *     tags: [MeuPerfil]
 *     responses:
 *       200:
 *         description: Lista de sessões
 */
router.get('/me/profile/sessions', userProfileController_1.listMySessions);
/**
 * @swagger
 * /api/me/profile/sessions/{sessionId}/revoke:
 *   post:
 *     summary: Revoga uma sessão específica do usuário
 *     tags: [MeuPerfil]
 *     parameters:
 *       - in: path
 *         name: sessionId
 *         schema:
 *           type: integer
 *         required: true
 *         description: Identificador da sessão
 *     responses:
 *       200:
 *         description: Sessão revogada com sucesso
 *       404:
 *         description: Sessão não encontrada
 */
router.post('/me/profile/sessions/:sessionId/revoke', userProfileController_1.revokeMySession);
/**
 * @swagger
 * /api/me/profile/sessions/revoke-all:
 *   post:
 *     summary: Revoga todas as sessões ativas do usuário
 *     tags: [MeuPerfil]
 *     responses:
 *       200:
 *         description: Total de sessões revogadas
 */
router.post('/me/profile/sessions/revoke-all', userProfileController_1.revokeAllMySessions);
exports.default = router;
