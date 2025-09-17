"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.listWahaChatsProxyHandler = void 0;
const wahaChatFetcher_1 = require("../services/wahaChatFetcher");
const listWahaChatsProxyHandler = async (_req, res) => {
    try {
        const conversations = await (0, wahaChatFetcher_1.listWahaConversations)();
        res.json(conversations);
    }
    catch (error) {
        if (error instanceof wahaChatFetcher_1.WahaRequestError) {
            if (error.status === 401 || error.status === 403) {
                return res.status(error.status).json({
                    error: 'Falha de autenticação com o WAHA. Verifique as credenciais configuradas.',
                });
            }
            const status = error.status && error.status >= 400 && error.status < 600 ? error.status : 502;
            return res.status(status).json({
                error: error.status === undefined
                    ? 'Integração com o WAHA não configurada. Defina WAHA_BASE_URL e WAHA_TOKEN.'
                    : 'Não foi possível consultar as conversas no WAHA.',
            });
        }
        console.error('Erro inesperado ao listar conversas do WAHA', error);
        res.status(500).json({ error: 'Erro interno ao consultar o WAHA' });
    }
};
exports.listWahaChatsProxyHandler = listWahaChatsProxyHandler;
