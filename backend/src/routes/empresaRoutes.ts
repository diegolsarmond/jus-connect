import { Router } from 'express';
import {
  listEmpresas,
  createEmpresa,
  updateEmpresa,
  deleteEmpresa,
} from '../controllers/empresaController';

const router = Router();

/**
 * @swagger
 * tags:
 *   - name: Empresas
 *     description: Endpoints para gerenciamento de empresas
 * components:
 *   schemas:
 *     Empresa:
 *       type: object
 *       properties:
 *         id:
 *           type: integer
 *         nome_empresa:
 *           type: string
 *         cnpj:
 *           type: string
 *         telefone:
 *           type: string
 *         email:
 *           type: string
 *         plano:
 *           type: integer
 *         responsavel:
 *           type: integer
 *         ativo:
 *           type: boolean
 *         datacadastro:
 *           type: string
 *           format: date-time
 */

/**
 * @swagger
 * /api/empresas:
 *   get:
 *     summary: Lista todas as empresas
 *     tags: [Empresas]
 *     responses:
 *       200:
 *         description: Lista de empresas
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/Empresa'
 */
router.get('/empresas', listEmpresas);

/**
 * @swagger
 * /api/empresas:
 *   post:
 *     summary: Cria uma nova empresa
 *     tags: [Empresas]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               nome_empresa:
 *                 type: string
 *               cnpj:
 *                 type: string
 *               telefone:
 *                 type: string
 *               email:
 *                 type: string
 *               plano:
 *                 type: integer
 *               responsavel:
 *                 type: integer
 *               ativo:
 *                 type: boolean
 *     responses:
 *       201:
 *         description: Empresa criada
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Empresa'
 */
router.post('/empresas', createEmpresa);

/**
 * @swagger
 * /api/empresas/{id}:
 *   put:
 *     summary: Atualiza uma empresa existente
 *     tags: [Empresas]
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
 *               nome_empresa:
 *                 type: string
 *               cnpj:
 *                 type: string
 *               telefone:
 *                 type: string
 *               email:
 *                 type: string
 *               plano:
 *                 type: integer
 *               responsavel:
 *                 type: integer
 *               ativo:
 *                 type: boolean
 *     responses:
 *       200:
 *         description: Empresa atualizada
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Empresa'
 *       404:
 *         description: Empresa não encontrada
 */
router.put('/empresas/:id', updateEmpresa);

/**
 * @swagger
 * /api/empresas/{id}:
 *   delete:
 *     summary: Remove uma empresa
 *     tags: [Empresas]
 *     parameters:
 *       - in: path
 *         name: id
 *         schema:
 *           type: integer
 *         required: true
 *     responses:
 *       204:
 *         description: Empresa removida
 *       404:
 *         description: Empresa não encontrada
 */
router.delete('/empresas/:id', deleteEmpresa);

export default router;

