"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.generateTextWithIntegration = generateTextWithIntegration;
const integrationApiKeyService_1 = __importDefault(require("../services/integrationApiKeyService"));
const providerLabels = {
    gemini: 'Gemini',
    openai: 'OpenAI',
    waha: 'WAHA',
};
const integrationService = new integrationApiKeyService_1.default();
function escapeHtml(value) {
    return value
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
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
        const providerLabel = providerLabels[integration.provider];
        const normalizedDocumentType = toTitleCase(documentType.trim());
        const normalizedPrompt = prompt.trim();
        const highlights = buildHighlights(normalizedPrompt);
        const introParagraph = `Em atendimento à solicitação apresentada, elaboramos o presente ${normalizedDocumentType.toLowerCase()} com base nas orientações fornecidas.`;
        const approachParagraph = 'O texto prioriza clareza, objetividade e coerência jurídica, estruturando os argumentos de modo progressivo para facilitar a revisão.';
        const conclusionParagraph = 'Revise o conteúdo, ajuste os dados específicos do caso concreto e complemente com informações adicionais antes de finalizar o documento.';
        const htmlParts = [
            `<p><strong>${escapeHtml(normalizedDocumentType)}</strong></p>`,
            `<p>${escapeHtml(introParagraph)}</p>`,
            `<p>${escapeHtml(approachParagraph)}</p>`,
        ];
        if (highlights.length > 0) {
            htmlParts.push('<p>Diretrizes consideradas:</p>');
            htmlParts.push('<ul>');
            highlights.forEach(item => {
                htmlParts.push(`<li>${escapeHtml(item)}</li>`);
            });
            htmlParts.push('</ul>');
        }
        else {
            htmlParts.push(`<p>${escapeHtml(normalizedPrompt)}</p>`);
        }
        htmlParts.push(`<p>${escapeHtml(conclusionParagraph)}</p>`);
        htmlParts.push(`<p>${escapeHtml(`Integração utilizada: ${providerLabel}.`)}</p>`);
        try {
            await integrationService.update(parsedIntegrationId, { lastUsed: new Date() });
        }
        catch (updateError) {
            console.error('Failed to update integration lastUsed timestamp:', updateError);
        }
        return res.json({
            content: htmlParts.join(''),
            documentType: normalizedDocumentType,
            provider: integration.provider,
        });
    }
    catch (error) {
        console.error('Failed to generate AI content:', error);
        return res.status(500).json({ error: 'Internal server error' });
    }
}
