import { Router } from 'express';
import {
  listEscritorios,
  createEscritorio,
  updateEscritorio,
  deleteEscritorio,
} from '../controllers/escritorioController';
import { ensureAuthenticatedEmpresa } from '../middlewares/ensureAuthenticatedEmpresa';

const router = Router();

/**
 * @swagger
 * tags:
 *   - name: Setores
 *     description: Endpoints para gerenciamento de setores (escritórios)
 * components:
 *   schemas:
 *     Setor:
 *       type: object
 *       properties:
 *         id:
 *           type: integer
 *         nome:
 *           type: string
 *         empresa:
 *           type: integer
 *         ativo:
 *           type: boolean
 *         datacriacao:
 *           type: string
 *           format: date-time
 */

/**
 * @swagger
 * /api/escritorios:
 *   get:
 *     summary: Lista todos os setores
 *     tags: [Setores]
 *     responses:
 *       200:
 *         description: Lista de setores
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/Setor'
 */
const basePaths = ['/escritorios', '/setores'];

basePaths.forEach((path) => {
  router.get(path, ensureAuthenticatedEmpresa, listEscritorios);
  router.post(path, ensureAuthenticatedEmpresa, createEscritorio);
  router.put(`${path}/:id`, ensureAuthenticatedEmpresa, updateEscritorio);
  router.delete(`${path}/:id`, ensureAuthenticatedEmpresa, deleteEscritorio);
});

/**
 * @swagger
 * /api/escritorios:
 *   post:
 *     summary: Cria um novo setor
 *     tags: [Setores]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               nome:
 *                 type: string
 *               empresa:
 *                 type: integer
 *               ativo:
 *                 type: boolean
 *     responses:
 *       201:
 *         description: Setor criado
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Setor'
 */
/**
 * @swagger
 * /api/escritorios/{id}:
 *   put:
 *     summary: Atualiza um setor existente
 *     tags: [Setores]
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
 *               nome:
 *                 type: string
 *               empresa:
 *                 type: integer
 *               ativo:
 *                 type: boolean
 *     responses:
 *       200:
 *         description: Setor atualizado
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Setor'
 *       404:
 *         description: Setor não encontrado
 */

/**
 * @swagger
 * /api/escritorios/{id}:
 *   delete:
 *     summary: Remove um setor
 *     tags: [Setores]
 *     parameters:
 *       - in: path
 *         name: id
 *         schema:
 *           type: integer
 *         required: true
 *     responses:
 *       204:
 *         description: Setor removido
 *       404:
 *         description: Setor não encontrado
 */

export default router;

