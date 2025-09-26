"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.createPlanPayment = void 0;
const db_1 = __importDefault(require("../services/db"));
const authUser_1 = require("../utils/authUser");
const integrationResolver_1 = __importStar(require("../services/asaas/integrationResolver"));
const asaasClient_1 = __importStar(require("../services/asaas/asaasClient"));
const asaasChargeService_1 = __importStar(require("../services/asaasChargeService"));
const asaasChargeService = new asaasChargeService_1.default();
function parseNumericId(value) {
    if (typeof value === 'number' && Number.isInteger(value)) {
        return value;
    }
    if (typeof value === 'string') {
        const trimmed = value.trim();
        if (!trimmed) {
            return null;
        }
        const parsed = Number.parseInt(trimmed, 10);
        if (Number.isInteger(parsed)) {
            return parsed;
        }
    }
    return null;
}
function parsePricingMode(value) {
    if (typeof value !== 'string') {
        return 'mensal';
    }
    const normalized = value.trim().toLowerCase();
    if (normalized === 'anual' || normalized === 'annual') {
        return 'anual';
    }
    return 'mensal';
}
function parsePaymentMethod(value) {
    if (typeof value !== 'string') {
        return 'PIX';
    }
    const normalized = value.trim().toLowerCase();
    if (normalized === 'boleto') {
        return 'BOLETO';
    }
    if (normalized === 'cartao' || normalized === 'cartão' || normalized === 'credit_card') {
        return 'CREDIT_CARD';
    }
    return 'PIX';
}
function sanitizeString(value) {
    if (typeof value !== 'string') {
        return null;
    }
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : null;
}
function sanitizeDocument(value) {
    const text = sanitizeString(value);
    if (!text) {
        return null;
    }
    const digits = text.replace(/\D+/g, '');
    return digits.length > 0 ? digits : null;
}
function parseCurrency(value) {
    if (typeof value === 'number' && Number.isFinite(value)) {
        return value;
    }
    if (typeof value === 'string') {
        const trimmed = value.trim();
        if (!trimmed) {
            return null;
        }
        const sanitized = trimmed.replace(/[^\d,.-]/g, '').replace(/\.(?=.*\.)/g, '');
        const normalized = sanitized.replace(',', '.');
        const parsed = Number(normalized);
        return Number.isFinite(parsed) ? parsed : null;
    }
    return null;
}
async function loadPlan(planId) {
    const result = await db_1.default.query('SELECT id, nome, valor_mensal, valor_anual FROM public.planos WHERE id = $1 LIMIT 1', [planId]);
    if (result.rowCount === 0) {
        return null;
    }
    return result.rows[0];
}
async function findEmpresaAsaasCustomerId(empresaId) {
    const result = await db_1.default.query('SELECT asaas_customer_id FROM public.empresas WHERE id = $1 LIMIT 1', [empresaId]);
    if (result.rowCount === 0) {
        return null;
    }
    const rawValue = result.rows[0]?.asaas_customer_id;
    if (typeof rawValue === 'string') {
        const trimmed = rawValue.trim();
        return trimmed ? trimmed : null;
    }
    return null;
}
async function persistEmpresaAsaasCustomerId(empresaId, customerId) {
    const normalizedId = customerId.trim();
    if (!normalizedId) {
        throw new Error('Cannot persist empty Asaas customer identifier');
    }
    const result = await db_1.default.query('UPDATE public.empresas SET asaas_customer_id = $1 WHERE id = $2', [normalizedId, empresaId]);
    if (result.rowCount === 0) {
        throw new Error('Empresa não encontrada para vincular cliente do Asaas.');
    }
}
function resolvePlanPrice(plan, pricingMode) {
    if (pricingMode === 'anual') {
        return parseCurrency(plan.valor_anual);
    }
    return parseCurrency(plan.valor_mensal);
}
function buildChargeDescription(plan, pricingMode) {
    const planName = sanitizeString(plan.nome) ?? `Plano ${plan.id}`;
    const cadenceLabel = pricingMode === 'anual' ? 'anual' : 'mensal';
    return `Assinatura ${planName} (${cadenceLabel})`;
}
function resolveDueDate(billingType) {
    const dueDate = new Date();
    if (billingType === 'BOLETO') {
        dueDate.setDate(dueDate.getDate() + 3);
    }
    return dueDate.toISOString().slice(0, 10);
}
async function createFinancialFlow({ description, value, dueDate, externalReference, }) {
    const result = await db_1.default.query(`INSERT INTO financial_flows (
        tipo,
        descricao,
        vencimento,
        valor,
        status,
        cliente_id,
        fornecedor_id,
        external_provider,
        external_reference_id
      )
      VALUES ('receita', $1, $2, $3, 'pendente', NULL, NULL, 'asaas', $4)
      RETURNING id, descricao, valor::text AS valor, vencimento::text AS vencimento, status`, [description, dueDate, value, externalReference]);
    if (result.rowCount === 0) {
        return null;
    }
    return result.rows[0];
}
const createPlanPayment = async (req, res) => {
    if (!req.auth) {
        res.status(401).json({ error: 'Token inválido.' });
        return;
    }
    const planId = parseNumericId(req.body?.planId);
    if (planId == null) {
        res.status(400).json({ error: 'Plano inválido.' });
        return;
    }
    const pricingMode = parsePricingMode(req.body?.pricingMode);
    const billingType = parsePaymentMethod(req.body?.paymentMethod);
    const companyName = sanitizeString(req.body?.billing?.companyName ?? req.body?.companyName);
    const companyDocument = sanitizeDocument(req.body?.billing?.document ?? req.body?.companyDocument);
    const billingEmail = sanitizeString(req.body?.billing?.email ?? req.body?.billingEmail);
    const notes = sanitizeString(req.body?.billing?.notes ?? req.body?.notes);
    if (!companyName) {
        res.status(400).json({ error: 'Informe a razão social ou nome do responsável pela cobrança.' });
        return;
    }
    if (!companyDocument) {
        res.status(400).json({ error: 'Informe um CPF ou CNPJ válido para gerar a cobrança no Asaas.' });
        return;
    }
    if (!billingEmail) {
        res.status(400).json({ error: 'Informe um e-mail para enviar as notificações de cobrança.' });
        return;
    }
    const empresaLookup = await (0, authUser_1.fetchAuthenticatedUserEmpresa)(req.auth.userId);
    if (!empresaLookup.success) {
        res.status(empresaLookup.status).json({ error: empresaLookup.message });
        return;
    }
    const empresaId = empresaLookup.empresaId;
    if (empresaId == null) {
        res.status(400).json({ error: 'Associe o usuário a uma empresa para gerenciar o plano.' });
        return;
    }
    const plan = await loadPlan(planId);
    if (!plan) {
        res.status(404).json({ error: 'Plano não encontrado.' });
        return;
    }
    const price = resolvePlanPrice(plan, pricingMode);
    if (price == null || price <= 0) {
        res.status(400).json({ error: 'O plano selecionado não possui valor configurado para esta recorrência.' });
        return;
    }
    const description = buildChargeDescription(plan, pricingMode);
    const dueDate = resolveDueDate(billingType);
    const externalReference = `plan-${planId}-empresa-${empresaId}-${Date.now()}`;
    let integration;
    try {
        integration = await (0, integrationResolver_1.default)();
    }
    catch (error) {
        if (error instanceof integrationResolver_1.AsaasIntegrationNotConfiguredError) {
            res.status(503).json({ error: 'Integração com o Asaas não está configurada.' });
            return;
        }
        console.error('Falha ao carregar integração do Asaas', error);
        res.status(500).json({ error: 'Não foi possível preparar a integração com o Asaas.' });
        return;
    }
    const client = new asaasClient_1.default({
        baseUrl: integration.baseUrl,
        accessToken: integration.accessToken,
    });
    const customerPayload = {
        name: companyName,
        cpfCnpj: companyDocument,
        email: billingEmail,
        externalReference: `empresa-${empresaId}`,
        observations: notes ?? undefined,
        notificationDisabled: false,
    };
    let existingCustomerId = null;
    try {
        existingCustomerId = await findEmpresaAsaasCustomerId(empresaId);
    }
    catch (error) {
        console.error('Falha ao consultar vínculo de cliente Asaas para empresa', error);
        res.status(500).json({ error: 'Não foi possível verificar o cadastro da empresa no Asaas.' });
        return;
    }
    let customerId = existingCustomerId;
    try {
        if (customerId) {
            try {
                const customer = await client.updateCustomer(customerId, customerPayload);
                customerId = customer.id;
            }
            catch (error) {
                console.error('Falha ao atualizar cliente no Asaas', error);
                if (error instanceof asaasClient_1.AsaasApiError && error.status === 404) {
                    const customer = await client.createCustomer(customerPayload);
                    customerId = customer.id;
                }
                else {
                    throw error;
                }
            }
        }
        else {
            const customer = await client.createCustomer(customerPayload);
            customerId = customer.id;
        }
    }
    catch (error) {
        console.error('Falha ao preparar cliente no Asaas', error);
        const message = error instanceof Error && 'message' in error
            ? error.message
            : 'Não foi possível preparar o cliente no Asaas.';
        res.status(502).json({ error: message });
        return;
    }
    if (!customerId) {
        res.status(502).json({ error: 'Não foi possível preparar o cliente no Asaas.' });
        return;
    }
    try {
        await persistEmpresaAsaasCustomerId(empresaId, customerId);
    }
    catch (error) {
        console.error('Falha ao persistir vínculo de cliente Asaas para empresa', error);
        res.status(500).json({ error: 'Não foi possível vincular o cliente do Asaas à empresa.' });
        return;
    }
    const flow = await createFinancialFlow({
        description,
        value: price,
        dueDate,
        externalReference,
    });
    if (!flow) {
        res.status(500).json({ error: 'Não foi possível registrar a cobrança localmente.' });
        return;
    }
    try {
        const chargeResult = await asaasChargeService.createCharge({
            financialFlowId: flow.id,
            billingType,
            value: price,
            dueDate,
            description,
            customer: customerId,
            payerEmail: billingEmail,
            payerName: companyName,
            customerDocument: companyDocument,
            metadata: {
                planId,
                pricingMode,
                empresaId,
                origin: 'plan-payment',
            },
        });
        res.status(201).json({
            plan: {
                id: plan.id,
                nome: plan.nome,
                pricingMode,
                price,
            },
            paymentMethod: billingType,
            charge: chargeResult.charge,
            flow: chargeResult.flow,
        });
    }
    catch (error) {
        if (error instanceof asaasChargeService_1.ValidationError) {
            res.status(400).json({ error: error.message });
            return;
        }
        if (error instanceof asaasChargeService_1.ChargeConflictError) {
            res.status(409).json({ error: error.message });
            return;
        }
        console.error('Falha ao criar cobrança do plano no Asaas', error);
        res.status(502).json({ error: 'Não foi possível criar a cobrança do plano no Asaas.' });
    }
};
exports.createPlanPayment = createPlanPayment;
exports.default = { createPlanPayment: exports.createPlanPayment };
