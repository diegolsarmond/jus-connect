"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getAsaasCustomerStatus = void 0;
const asaasCustomerService_1 = __importDefault(require("../services/asaasCustomerService"));
const db_1 = __importDefault(require("../services/db"));
const authUser_1 = require("../utils/authUser");
const asaasCustomerService = new asaasCustomerService_1.default();
function parseClienteId(value) {
    const parsed = Number(value);
    if (!Number.isInteger(parsed) || parsed <= 0) {
        return null;
    }
    return parsed;
}
const getAsaasCustomerStatus = async (req, res) => {
    const { clienteId: clienteIdParam } = req.params;
    const clienteId = parseClienteId(clienteIdParam);
    if (!clienteId) {
        return res.status(400).json({ error: 'Identificador de cliente inválido.' });
    }
    try {
        if (!req.auth) {
            return res.status(401).json({ error: 'Token inválido.' });
        }
        const empresaLookup = await (0, authUser_1.fetchAuthenticatedUserEmpresa)(req.auth.userId);
        if (!empresaLookup.success) {
            return res.status(empresaLookup.status).json({ error: empresaLookup.message });
        }
        const { empresaId } = empresaLookup;
        if (empresaId === null) {
            return res
                .status(400)
                .json({ error: 'Usuário autenticado não possui empresa vinculada.' });
        }
        const clienteResult = await db_1.default.query('SELECT id FROM public.clientes WHERE id = $1 AND idempresa IS NOT DISTINCT FROM $2', [clienteId, empresaId]);
        if (clienteResult.rowCount === 0) {
            return res.status(404).json({ error: 'Cliente não encontrado' });
        }
        const status = await asaasCustomerService.ensureCustomer(clienteId);
        return res.json(status);
    }
    catch (error) {
        console.error('Falha ao recuperar status do cliente Asaas:', error);
        return res.status(500).json({ error: 'Internal server error' });
    }
};
exports.getAsaasCustomerStatus = getAsaasCustomerStatus;
