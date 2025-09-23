"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const authController_1 = require("../controllers/authController");
const authMiddleware_1 = require("../middlewares/authMiddleware");
const router = (0, express_1.Router)();
/**
 * @swagger
 * tags:
 *   - name: Autenticação
 *     description: Endpoints para autenticação de usuários
 */
/**
 * @swagger
 * /api/auth/register:
 *   post:
 *     summary: Cria uma nova conta administrativa
 *     tags: [Autenticação]
 *     security: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - name
 *               - email
 *               - company
 *               - password
 *             properties:
 *               name:
 *                 type: string
 *                 description: Nome completo do administrador
 *               email:
 *                 type: string
 *                 format: email
 *               company:
 *                 type: string
 *                 description: Nome da empresa a ser criada ou reutilizada
 *               password:
 *                 type: string
 *                 format: password
 *               phone:
 *                 type: string
 *                 description: Telefone de contato (opcional)
 *     responses:
 *       201:
 *         description: Conta criada com sucesso
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 user:
 *                   type: object
 *                 empresa:
 *                   type: object
 *                 perfil:
 *                   type: object
 *       400:
 *         description: Dados inválidos
 *       409:
 *         description: E-mail já cadastrado
 */
router.post('/auth/register', authController_1.register);
/**
 * @swagger
 * /api/auth/login:
 *   post:
 *     summary: Autentica um usuário e retorna um token Bearer
 *     tags: [Autenticação]
 *     security: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - email
 *               - senha
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *               senha:
 *                 type: string
 *     responses:
 *       200:
 *         description: Token de acesso gerado com sucesso
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 token:
 *                   type: string
 *                 expiresIn:
 *                   type: integer
 *                   description: Expiração do token em segundos
 *                 user:
 *                   type: object
 *                   properties:
 *                     id:
 *                       type: integer
 *                     nome_completo:
 *                       type: string
 *                     email:
 *                       type: string
 *                     perfil:
 *                       type: integer
 *       400:
 *         description: Requisição inválida
 *       401:
 *         description: Credenciais inválidas
 */
router.post('/auth/login', authController_1.login);
/**
 * @swagger
 * /api/auth/me:
 *   get:
 *     summary: Retorna os dados do usuário autenticado
 *     tags: [Autenticação]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Dados do usuário autenticado
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 id:
 *                   type: integer
 *                 nome_completo:
 *                   type: string
 *                 email:
 *                   type: string
 *                 perfil:
 *                   type: integer
 *                 status:
 *                   type: boolean
 *       401:
 *         description: Token ausente ou inválido
 *       404:
 *         description: Usuário não encontrado
 */
router.get('/auth/me', authMiddleware_1.authenticateRequest, authController_1.getCurrentUser);
/**
 * @swagger
 * /api/auth/refresh:
 *   post:
 *     summary: Renova o token de acesso do usuário autenticado
 *     tags: [Autenticação]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Novo token de acesso gerado com sucesso
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 token:
 *                   type: string
 *                 expiresIn:
 *                   type: integer
 *                   description: Expiração do token em segundos
 *       401:
 *         description: Token ausente ou inválido
 */
router.post('/auth/refresh', authMiddleware_1.authenticateRequest, authController_1.refreshToken);
exports.default = router;
