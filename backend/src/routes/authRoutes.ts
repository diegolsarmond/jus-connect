import { Router } from 'express';
import {
  changePassword,
  confirmEmail,
  getCurrentUser,
  login,
  refreshToken,
  register,
} from '../controllers/authController';
import { authenticateRequest } from '../middlewares/authMiddleware';

const router = Router();

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
router.post('/auth/register', register);

/**
 * @swagger
 * /api/auth/confirm-email:
 *   post:
 *     summary: Confirma o endereço de e-mail do usuário
 *     tags: [Autenticação]
 *     security: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - token
 *             properties:
 *               token:
 *                 type: string
 *                 description: Token de confirmação recebido por e-mail
 *     responses:
 *       200:
 *         description: E-mail confirmado com sucesso
 *       400:
 *         description: Token inválido ou expirado
 *       409:
 *         description: Token já utilizado
 */
router.post('/auth/confirm-email', confirmEmail);

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
router.post('/auth/login', login);

/**
 * @swagger
 * /api/auth/change-password:
 *   post:
 *     summary: Atualiza a senha utilizando a senha provisória fornecida
 *     tags: [Autenticação]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - temporaryPassword
 *               - newPassword
 *               - confirmPassword
 *             properties:
 *               temporaryPassword:
 *                 type: string
 *                 format: password
 *               newPassword:
 *                 type: string
 *                 format: password
 *               confirmPassword:
 *                 type: string
 *                 format: password
 *     responses:
 *       200:
 *         description: Senha atualizada com sucesso
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *       400:
 *         description: Dados inválidos ou senha provisória incorreta
 *       401:
 *         description: Token ausente ou inválido
 *       404:
 *         description: Usuário não encontrado
 */
router.post('/auth/change-password', authenticateRequest, changePassword);

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
router.get('/auth/me', authenticateRequest, getCurrentUser);

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
router.post('/auth/refresh', authenticateRequest, refreshToken);

export default router;
