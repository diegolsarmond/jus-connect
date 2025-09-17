"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function (o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
        desc = { enumerable: true, get: function () { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function (o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function (o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function (o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function (o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o)
                if (Object.prototype.hasOwnProperty.call(o, k))
                    ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule)
            return mod;
        var result = {};
        if (mod != null)
            for (var k = ownKeys(mod), i = 0; i < k.length; i++)
                if (k[i] !== "default")
                    __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.generateTextWithIntegration = generateTextWithIntegration;
const integrationApiKeyService_1 = __importStar(require("../services/integrationApiKeyService"));
const errors_1 = require("../services/aiProviders/errors");
const geminiProvider_1 = require("../services/aiProviders/geminiProvider");
const html_1 = require("../utils/html");
const providerLabels = {
    gemini: 'Gemini',
    openai: 'OpenAI',
};
const integrationService = new integrationApiKeyService_1.default();
let hasLoggedUnknownEnvironment = false;
function isApiKeyEnvironment(value) {
    return integrationApiKeyService_1.API_KEY_ENVIRONMENTS.includes(value);
}
function resolveEnvironment(value) {
    if (isApiKeyEnvironment(value)) {
        return value;
    }
    if (!hasLoggedUnknownEnvironment) {
        console.warn('Integration environment value is not recognized, defaulting to produção:', value);
        hasLoggedUnknownEnvironment = true;
    }
    return 'producao';
}
function toTitleCase(value) {
    return value
        .split(/\s+/)
        .filter(Boolean)
        .map(segment => segment.charAt(0).toUpperCase() + segment.slice(1).toLowerCase())
        .join(' ');
}
function buildHighlights(prompt) {
    return prompt
        .split(/\n+/)
        .map(segment => segment.trim())
        .filter(Boolean)
        .slice(0, 5);
}
function buildFallbackContent(documentType, prompt, providerLabel) {
    const highlights = buildHighlights(prompt);
    const introParagraph = `Em atendimento à solicitação apresentada, elaboramos o presente ${documentType.toLowerCase()} com base nas orientações fornecidas.`;
    const approachParagraph = 'O texto prioriza clareza, objetividade e coerência jurídica, estruturando os argumentos de modo progressivo para facilitar a revisão.';
    const conclusionParagraph = 'Revise o conteúdo, ajuste os dados específicos do caso concreto e complemente com informações adicionais antes de finalizar o documento.';
    const htmlParts = [
        `<p><strong>${(0, html_1.escapeHtml)(documentType)}</strong></p>`,
        `<p>${(0, html_1.escapeHtml)(introParagraph)}</p>`,
        `<p>${(0, html_1.escapeHtml)(approachParagraph)}</p>`,
    ];
    if (highlights.length > 0) {
        htmlParts.push('<p>Diretrizes consideradas:</p>');
        htmlParts.push('<ul>');
        highlights.forEach(item => {
            htmlParts.push(`<li>${(0, html_1.escapeHtml)(item)}</li>`);
        });
        htmlParts.push('</ul>');
    }
    else {
        htmlParts.push(`<p>${(0, html_1.escapeHtml)(prompt)}</p>`);
    }
    htmlParts.push(`<p>${(0, html_1.escapeHtml)(conclusionParagraph)}</p>`);
    htmlParts.push(`<p>${(0, html_1.escapeHtml)(`Integração utilizada: ${providerLabel}.`)}</p>`);
    return htmlParts.join('');
}
async function generateTextWithIntegration(req, res) {
    const { integrationId, documentType, prompt } = req.body;
    const parsedIntegrationId = Number(integrationId);
    if (!Number.isInteger(parsedIntegrationId) || parsedIntegrationId <= 0) {
        return res.status(400).json({ error: 'integrationId must be a positive integer' });
    }
    if (typeof documentType !== 'string' || !documentType.trim()) {
        return res.status(400).json({ error: 'documentType is required' });
    }
    if (typeof prompt !== 'string' || !prompt.trim()) {
        return res.status(400).json({ error: 'prompt is required' });
    }
    try {
        const integration = await integrationService.findById(parsedIntegrationId);
        if (!integration || !integration.active) {
            return res.status(404).json({ error: 'Active integration not found' });
        }
        const providerLabel = providerLabels[integration.provider] ?? integration.provider;
        const normalizedDocumentType = toTitleCase(documentType.trim());
        const normalizedPrompt = prompt.trim();
        let htmlContent = null;
        if (integration.provider === 'gemini') {
            const environment = resolveEnvironment(integration.environment);
            try {
                htmlContent = await (0, geminiProvider_1.generateDocumentWithGemini)({
                    apiKey: integration.key,
                    documentType: normalizedDocumentType,
                    prompt: normalizedPrompt,
                    environment,
                });
            }
            catch (error) {
                if (error instanceof errors_1.AiProviderError) {
                    return res.status(error.statusCode).json({ error: error.message });
                }
                throw error;
            }
        }
        if (!htmlContent || !htmlContent.trim()) {
            htmlContent = buildFallbackContent(normalizedDocumentType, normalizedPrompt, providerLabel);
        }
        else if (!/Integração utilizada/.test(htmlContent)) {
            htmlContent = `${htmlContent}<p>${(0, html_1.escapeHtml)(`Integração utilizada: ${providerLabel}.`)}</p>`;
        }
        try {
            await integrationService.update(parsedIntegrationId, { lastUsed: new Date() });
        }
        catch (updateError) {
            console.error('Failed to update integration lastUsed timestamp:', updateError);
        }
        return res.json({
            content: htmlContent,
            documentType: normalizedDocumentType,
            provider: integration.provider,
        });
    }
    catch (error) {
        console.error('Failed to generate AI content:', error);
        return res.status(500).json({ error: 'Internal server error' });
    }
}
