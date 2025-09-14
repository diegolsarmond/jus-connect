import { Router } from 'express';
import {
  listUsuarios,
  getUsuarioById,
  createUsuario,
  updateUsuario,
  deleteUsuario,
} from '../controllers/usuarioController';

const router = Router();

/**
 * @swagger
 * tags:
 *   - name: Usuarios
 *     description: Endpoints para gerenciamento de usuários
 * components:
 *   schemas:
 *     Usuario:
 *       type: object
 *       properties:
 *         id:
 *           type: integer
 *         nome_completo:
 *           type: string
 *         cpf:
 *           type: string
 *         email:
 *           type: string
 *         perfil:
 *           type: string
 *         empresa:
 *           type: string
 *         escritorio:
 *           type: string
 *         oab:
 *           type: string
 *         status:
 *           type: boolean
 *         senha:
 *           type: string
 *         telefone:
 *           type: string
 *         ultimo_login:
 *           type: string
 *           format: date-time
 *         observacoes:
 *           type: string
 *         datacriacao:
 *           type: string
 *           format: date-time
 */

/**
 * @swagger
 * /api/usuarios:
 *   get:
 *     summary: Lista todos os usuários
 *     tags: [Usuarios]
 *     responses:
 *       200:
 *         description: Lista de usuários
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/Usuario'
 */
router.get('/usuarios', listUsuarios);

/**
 * @swagger
 * /api/usuarios/{id}:
 *   get:
 *     summary: Obtém um usuário pelo ID
 *     tags: [Usuarios]
 *     parameters:
 *       - in: path
 *         name: id
 *         schema:
 *           type: integer
 *         required: true
 *     responses:
 *       200:
 *         description: Dados do usuário
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Usuario'
 *       404:
 *         description: Usuário não encontrado
 */
router.get('/usuarios/:id', getUsuarioById);

/**
 * @swagger
 * /api/usuarios:
 *   post:
 *     summary: Cria um novo usuário
 *     tags: [Usuarios]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               nome_completo:
 *                 type: string
 *               cpf:
 *                 type: string
 *               email:
 *                 type: string
 *               perfil:
 *                 type: integer
 *               empresa:
 *                 type: integer
 *               escritorio:
 *                 type: integer
 *               oab:
 *                 type: string
 *               status:
 *                 type: boolean
 *               senha:
 *                 type: string
 *               telefone:
 *                 type: string
 *               ultimo_login:
 *                 type: string
 *                 format: date-time
 *               observacoes:
 *                 type: string
 *     responses:
 *       201:
 *         description: Usuário criado
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Usuario'
 */
router.post('/usuarios', createUsuario);

/**
 * @swagger
 * /api/usuarios/{id}:
 *   put:
 *     summary: Atualiza um usuário existente
 *     tags: [Usuarios]
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
 *               nome_completo:
 *                 type: string
 *               cpf:
 *                 type: string
 *               email:
 *                 type: string
 *               perfil:
 *                 type: integer
 *               empresa:
 *                 type: integer
 *               escritorio:
 *                 type: integer
 *               oab:
 *                 type: string
 *               status:
 *                 type: boolean
 *               senha:
 *                 type: string
 *               telefone:
 *                 type: string
 *               ultimo_login:
 *                 type: string
 *                 format: date-time
 *               observacoes:
 *                 type: string
 *     responses:
 *       200:
 *         description: Usuário atualizado
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Usuario'
 *       404:
 *         description: Usuário não encontrado
 */
router.put('/usuarios/:id', updateUsuario);

/**
 * @swagger
 * /api/usuarios/{id}:
 *   delete:
 *     summary: Remove um usuário
 *     tags: [Usuarios]
 *     parameters:
 *       - in: path
 *         name: id
 *         schema:
 *           type: integer
 *         required: true
 *     responses:
 *       204:
 *         description: Usuário removido
 *       404:
 *         description: Usuário não encontrado
 */
router.delete('/usuarios/:id', deleteUsuario);

// Alias em inglês para compatibilidade com consumidores da API
router.get('/users', listUsuarios);
router.get('/users/:id', getUsuarioById);
router.post('/users', createUsuario);
router.put('/users/:id', updateUsuario);
router.delete('/users/:id', deleteUsuario);

export default router;

