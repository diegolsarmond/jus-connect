import { Router } from 'express';
import {
  listClienteAtributos,
  createClienteAtributo,
  updateClienteAtributo,
  deleteClienteAtributo,
} from '../controllers/clienteAtributoController';

const router = Router();

/**
 * @swagger
 * tags:
 *   - name: ClienteAtributos
 *     description: Endpoints para gerenciamento de atributos personalizados dos clientes
 * components:
 *   schemas:
 *     ClienteAtributo:
 *       type: object
 *       properties:
 *         id:
 *           type: integer
 *         cliente_id:
 *           type: integer
 *         tipo_documento_id:
 *           type: integer
 *         tipo_documento_nome:
 *           type: string
 *         valor:
 *           type: string
 *         datacadastro:
 *           type: string
 *           format: date-time
 */

/**
 * @swagger
 * /api/clientes/{clienteId}/atributos:
 *   get:
 *     summary: Lista os atributos personalizados de um cliente
 *     tags: [ClienteAtributos]
 *     parameters:
 *       - in: path
 *         name: clienteId
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Lista de atributos personalizados do cliente
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/ClienteAtributo'
 */
router.get('/clientes/:clienteId/atributos', listClienteAtributos);

/**
 * @swagger
 * /api/clientes/{clienteId}/atributos:
 *   post:
 *     summary: Cria um novo atributo personalizado para o cliente
 *     tags: [ClienteAtributos]
 *     parameters:
 *       - in: path
 *         name: clienteId
 *         required: true
 *         schema:
 *           type: integer
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - idtipodocumento
 *               - valor
 *             properties:
 *               idtipodocumento:
 *                 type: integer
 *               valor:
 *                 type: string
 *     responses:
 *       201:
 *         description: Atributo personalizado criado com sucesso
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ClienteAtributo'
 */
router.post('/clientes/:clienteId/atributos', createClienteAtributo);

/**
 * @swagger
 * /api/clientes/{clienteId}/atributos/{id}:
 *   put:
 *     summary: Atualiza um atributo personalizado do cliente
 *     tags: [ClienteAtributos]
 *     parameters:
 *       - in: path
 *         name: clienteId
 *         required: true
 *         schema:
 *           type: integer
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - idtipodocumento
 *               - valor
 *             properties:
 *               idtipodocumento:
 *                 type: integer
 *               valor:
 *                 type: string
 *     responses:
 *       200:
 *         description: Atributo personalizado atualizado
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ClienteAtributo'
 */
router.put('/clientes/:clienteId/atributos/:id', updateClienteAtributo);

/**
 * @swagger
 * /api/clientes/{clienteId}/atributos/{id}:
 *   delete:
 *     summary: Remove um atributo personalizado do cliente
 *     tags: [ClienteAtributos]
 *     parameters:
 *       - in: path
 *         name: clienteId
 *         required: true
 *         schema:
 *           type: integer
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       204:
 *         description: Atributo personalizado removido com sucesso
 */
router.delete('/clientes/:clienteId/atributos/:id', deleteClienteAtributo);

export default router;
