"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const clienteController_1 = require("../controllers/clienteController");
const asaasCustomerController_1 = require("../controllers/asaasCustomerController");
const router = (0, express_1.Router)();
/**
 * @swagger
 * tags:
 *   - name: Clientes
 *     description: Endpoints para gerenciamento de clientes
 * components:
 *   schemas:
 *     Cliente:
 *       type: object
 *       properties:
 *         id:
 *           type: integer
 *         nome:
 *           type: string
 *         tipo:
 *           type: integer
 *         documento:
 *           type: string
 *         email:
 *           type: string
 *         telefone:
 *           type: string
 *         cep:
 *           type: string
 *         rua:
 *           type: string
 *         numero:
 *           type: string
 *         complemento:
 *           type: string
 *         bairro:
 *           type: string
 *         cidade:
 *           type: string
 *         uf:
 *           type: string
 *         ativo:
 *           type: boolean
 *         idempresa:
 *           type: integer
 *         datacadastro:
 *           type: string
 *           format: date-time
 */
/**
 * @swagger
 * /api/clientes:
 *   get:
 *     summary: Lista todos os clientes
 *     tags: [Clientes]
 *     responses:
 *       200:
 *         description: Lista de clientes
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/Cliente'
 */
router.get('/clientes', clienteController_1.listClientes);
/**
 * @swagger
 * /api/clientes/ativos/total:
 *   get:
 *     summary: Retorna o total de clientes ativos
 *     tags: [Clientes]
 *     responses:
 *       200:
 *         description: Total de clientes ativos
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 total_clientes_ativos:
 *                   type: integer
 */
router.get('/clientes/ativos/total', clienteController_1.countClientesAtivos);
/**
 * @swagger
 * /api/clientes/{id}:
 *   get:
 *     summary: Obtém um cliente pelo ID
 *     tags: [Clientes]
 *     parameters:
 *       - in: path
 *         name: id
 *         schema:
 *           type: integer
 *         required: true
 *     responses:
 *       200:
 *         description: Dados do cliente
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Cliente'
 *       404:
 *         description: Cliente não encontrado
 */
router.get('/clientes/:id', clienteController_1.getClienteById);
/**
 * @swagger
 * /api/clientes:
 *   post:
 *     summary: Cria um novo cliente
 *     tags: [Clientes]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               nome:
 *                 type: string
 *               tipo:
 *                 type: integer
 *               documento:
 *                 type: string
 *               email:
 *                 type: string
 *               telefone:
 *                 type: string
 *               cep:
 *                 type: string
 *               rua:
 *                 type: string
 *               numero:
 *                 type: string
 *               complemento:
 *                 type: string
 *               bairro:
 *                 type: string
 *               cidade:
 *                 type: string
 *               uf:
 *                 type: string
 *               ativo:
 *                 type: boolean
 *     responses:
 *       201:
 *         description: Cliente criado
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Cliente'
 */
router.post('/clientes', clienteController_1.createCliente);
/**
 * @swagger
 * /api/asaas/customers/{clienteId}/status:
 *   get:
 *     summary: Recupera o status de sincronização do cliente com o Asaas
 *     tags: [Clientes]
 *     parameters:
 *       - in: path
 *         name: clienteId
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Status de sincronização
 *       404:
 *         description: Cliente não encontrado
 */
router.get('/asaas/customers/:clienteId/status', asaasCustomerController_1.getAsaasCustomerStatus);
/**
 * @swagger
 * /api/clientes/{id}:
 *   put:
 *     summary: Atualiza um cliente existente
 *     tags: [Clientes]
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
 *               tipo:
 *                 type: integer
 *               documento:
 *                 type: string
 *               email:
 *                 type: string
 *               telefone:
 *                 type: string
 *               cep:
 *                 type: string
 *               rua:
 *                 type: string
 *               numero:
 *                 type: string
 *               complemento:
 *                 type: string
 *               bairro:
 *                 type: string
 *               cidade:
 *                 type: string
 *               uf:
 *                 type: string
 *               ativo:
 *                 type: boolean
 *     responses:
 *       200:
 *         description: Cliente atualizado
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Cliente'
 *       404:
 *         description: Cliente não encontrado
 */
router.put('/clientes/:id', clienteController_1.updateCliente);
/**
 * @swagger
 * /api/clientes/{id}:
 *   delete:
 *     summary: Remove um cliente
 *     tags: [Clientes]
 *     parameters:
 *       - in: path
 *         name: id
 *         schema:
 *           type: integer
 *         required: true
 *     responses:
 *       204:
 *         description: Cliente removido
 *       404:
 *         description: Cliente não encontrado
 */
router.delete('/clientes/:id', clienteController_1.deleteCliente);
exports.default = router;
