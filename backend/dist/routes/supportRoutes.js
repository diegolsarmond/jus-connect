"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const supportController_1 = require("../controllers/supportController");
const router = (0, express_1.Router)();
/**
 * @swagger
 * tags:
 *   - name: Suporte
 *     description: Endpoints para solicitações de suporte
 */
/**
 * @swagger
 * /api/support:
 *   post:
 *     summary: Cria uma nova solicitação de suporte
 *     tags: [Suporte]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               subject:
 *                 type: string
 *               description:
 *                 type: string
 *     responses:
 *       201:
 *         description: Solicitação criada
 */
router.post('/support', supportController_1.createSupportRequest);
exports.default = router;
