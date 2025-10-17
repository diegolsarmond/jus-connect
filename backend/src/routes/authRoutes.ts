import { Router } from 'express';
import {
  changePassword,
  confirmEmail,
  getCurrentUser,
  login,
  resendEmailConfirmation,
  requestPasswordReset,
  refreshToken,
  register,
} from '../controllers/authController';
import supabaseAuthMiddleware from '../middlewares/supabaseAuthMiddleware';
import createRateLimiter from '../middlewares/rateLimitMiddleware';

const router = Router();

const sensitiveIpRateLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000,
  maxAttempts: 20,
});

const loginRateLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000,
  maxAttempts: 10,
  keyGenerator: (req) => {
    const segments: string[] = [req.ip || 'unknown'];
    const body = req.body as { email?: unknown } | undefined;

    if (body && typeof body.email === 'string') {
      segments.push(body.email.trim().toLowerCase());
    }

    return segments.join('|');
  },
});

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
router.post('/auth/register', sensitiveIpRateLimiter, register);

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
router.post('/auth/confirm-email', sensitiveIpRateLimiter, confirmEmail);

router.post('/auth/resend-email-confirmation', sensitiveIpRateLimiter, resendEmailConfirmation);

router.post('/auth/request-password-reset', sensitiveIpRateLimiter, requestPasswordReset);

/**
 * @swagger
 * /api/auth/login:
 *   post:
 *     summary: Valida um usuário autenticado via Supabase
 *     tags: [Autenticação]
 *     security: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - supabaseUid
 *             properties:
 *               supabaseUid:
 *                 type: string
 *                 description: Identificador único do usuário no Supabase
 *               email:
 *                 type: string
 *                 format: email
 *     responses:
 *       200:
 *         description: Dados do usuário retornados com sucesso
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
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
 *                     modulos:
 *                       type: array
 *                       items:
 *                         type: string
 *                     subscription:
 *                       type: object
 *                     mustChangePassword:
 *                       type: boolean
 *                     viewAllConversations:
 *                       type: boolean
 *       400:
 *         description: Requisição inválida
 *       401:
 *         description: Credenciais inválidas
 */
router.post('/auth/login', loginRateLimiter, login);

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
router.post('/auth/change-password', supabaseAuthMiddleware, changePassword);

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
router.get('/auth/me', supabaseAuthMiddleware, getCurrentUser);

/**
 * @swagger
 * /api/auth/refresh:
 *   post:
 *     summary: Fluxo de renovação local desativado
 *     tags: [Autenticação]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       410:
 *         description: Requisição não suportada. Utilize o token fornecido pelo Supabase.
 */
router.post('/auth/refresh', supabaseAuthMiddleware, refreshToken);

export default router;
