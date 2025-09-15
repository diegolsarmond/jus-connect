"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const tarefaResponsavelController_1 = require("../controllers/tarefaResponsavelController");
const router = (0, express_1.Router)();
// Rotas para responsáveis das tarefas
router.get('/tarefas/:id/responsaveis', tarefaResponsavelController_1.listResponsaveis);
router.post('/tarefas/:id/responsaveis', tarefaResponsavelController_1.addResponsaveis);
exports.default = router;
