"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.generateDocumentWithGemini = exports.convertPlainTextToHtml = exports.buildHtmlFromGeminiStructuredResponse = exports.parseGeminiStructuredResponse = void 0;
const errors_1 = require("./errors");
const html_1 = require("../../utils/html");
const GEMINI_API_BASE_URL = 'https://generativelanguage.googleapis.com/v1beta/models';
const GEMINI_MODEL_BY_ENVIRONMENT = {
    producao: 'gemini-1.5-flash',
    homologacao: 'gemini-1.5-flash',
};
const mapGeminiStatusToHttp = (status) => {
    if (status === 401 || status === 403) {
        return 401;
    }
    if (status === 429) {
        return 429;
    }
    if (status >= 500) {
        return 502;
    }
    return 502;
};
const extractGeminiErrorMessage = (payload, status) => {
    if (payload && typeof payload === 'object') {
        const errorObject = payload.error;
        const message = (errorObject === null || errorObject === void 0 ? void 0 : errorObject.message) || payload.message;
        if (typeof message === 'string' && message.trim().length > 0) {
            return message.trim();
        }
    }
    return `Gemini API request failed with status ${status}`;
};
const buildGeminiPrompt = (documentType, prompt) => {
    const sanitizedPrompt = prompt.trim();
    return [
        'Você é um assistente jurídico especializado em elaborar minutas estruturadas e coerentes.',
        'Crie um rascunho detalhado para o documento descrito a seguir, mantendo linguagem formal e objetiva.',
        'Responda exclusivamente em JSON com o formato:',
        '{',
        '  "intro": "Resumo introdutório do documento",',
        '  "sections": [',
        '    {',
        '      "title": "Título da seção",',
        '      "paragraphs": ["Parágrafo 1", "Parágrafo 2"],',
        '      "bullets": ["Item opcional 1", "Item opcional 2"]',
        '    }',
        '  ],',
        '  "highlights": ["Tópicos chave considerados"],',
        '  "conclusion": "Orientações finais"',
        '}',
        'Regras:',
        '- Utilize sempre português brasileiro.',
        '- Inclua pelo menos duas seções relevantes.',
        '- Limite cada seção a no máximo três parágrafos objetivos.',
        '- Quando apropriado, utilize listas em "bullets" para destacar pontos importantes.',
        '- Não adicione comentários fora do JSON especificado.',
        `Tipo de documento: ${documentType}.`,
        'Informações fornecidas:',
        sanitizedPrompt ? `"""${sanitizedPrompt}"""` : 'Nenhum detalhe adicional fornecido.',
    ].join('\n');
};
const toSafeString = (value) => {
    if (typeof value === 'string') {
        const trimmed = value.trim();
        return trimmed.length > 0 ? trimmed : null;
    }
    if (typeof value === 'number' || typeof value === 'boolean') {
        return String(value);
    }
    if (value && typeof value === 'object' && 'text' in value) {
        const potential = value.text;
        if (typeof potential === 'string') {
            const trimmed = potential.trim();
            return trimmed.length > 0 ? trimmed : null;
        }
    }
    return null;
};
const toStringArray = (value) => {
    if (!Array.isArray(value)) {
        return [];
    }
    return value
        .map(item => toSafeString(item))
        .filter((item) => typeof item === 'string' && item.length > 0);
};
const firstNonEmptyString = (values) => {
    for (const value of values) {
        const normalized = toSafeString(value);
        if (normalized) {
            return normalized;
        }
    }
    return null;
};
const cleanGeminiJsonPayload = (text) => {
    let cleaned = text.trim();
    cleaned = cleaned.replace(/^```(?:json)?\s*/i, '');
    cleaned = cleaned.replace(/```\s*$/i, '');
    return cleaned.trim();
};
const parseGeminiStructuredResponse = (text) => {
    if (!text.trim()) {
        return null;
    }
    const cleaned = cleanGeminiJsonPayload(text);
    if (!cleaned) {
        return null;
    }
    try {
        const parsed = JSON.parse(cleaned);
        if (!parsed || typeof parsed !== 'object') {
            return null;
        }
        return parsed;
    }
    catch (error) {
        return null;
    }
};
exports.parseGeminiStructuredResponse = parseGeminiStructuredResponse;
const buildHtmlFromGeminiStructuredResponse = (documentType, payload) => {
    const htmlParts = [`<p><strong>${(0, html_1.escapeHtml)(documentType)}</strong></p>`];
    const intro = firstNonEmptyString([payload.intro, payload.summary, payload.overview]);
    if (intro) {
        htmlParts.push(`<p>${(0, html_1.escapeHtml)(intro)}</p>`);
    }
    const sections = Array.isArray(payload.sections) ? payload.sections : [];
    sections.forEach(section => {
        const title = firstNonEmptyString([section.title]);
        if (title) {
            htmlParts.push(`<p><strong>${(0, html_1.escapeHtml)(title)}</strong></p>`);
        }
        const paragraphs = toStringArray(section.paragraphs);
        paragraphs.forEach(paragraph => {
            htmlParts.push(`<p>${(0, html_1.escapeHtml)(paragraph)}</p>`);
        });
        const bulletCandidates = [section.bullets, section.items, section.points];
        const bulletSource = bulletCandidates.find(value => Array.isArray(value)) || [];
        const bullets = toStringArray(bulletSource);
        if (bullets.length > 0) {
            htmlParts.push('<ul>');
            bullets.forEach(item => {
                htmlParts.push(`<li>${(0, html_1.escapeHtml)(item)}</li>`);
            });
            htmlParts.push('</ul>');
        }
    });
    const highlights = toStringArray(payload.highlights || payload.directives || payload.topics);
    if (highlights.length > 0) {
        htmlParts.push('<p>Principais pontos considerados:</p>');
        htmlParts.push('<ul>');
        highlights.forEach(item => {
            htmlParts.push(`<li>${(0, html_1.escapeHtml)(item)}</li>`);
        });
        htmlParts.push('</ul>');
    }
    const conclusion = firstNonEmptyString([payload.conclusion, payload.finalThoughts, payload.recommendations]);
    if (conclusion) {
        htmlParts.push(`<p>${(0, html_1.escapeHtml)(conclusion)}</p>`);
    }
    const notes = toStringArray(payload.additionalNotes || payload.notes || payload.disclaimer);
    notes.forEach(note => {
        htmlParts.push(`<p>${(0, html_1.escapeHtml)(note)}</p>`);
    });
    return htmlParts.join('');
};
exports.buildHtmlFromGeminiStructuredResponse = buildHtmlFromGeminiStructuredResponse;
const convertPlainTextToHtml = (documentType, text) => {
    const normalized = text.replace(/\r\n/g, '\n').trim();
    const htmlParts = [`<p><strong>${(0, html_1.escapeHtml)(documentType)}</strong></p>`];
    if (!normalized) {
        return htmlParts.join('');
    }
    const lines = normalized.split('\n');
    let listBuffer = [];
    const flushList = () => {
        if (listBuffer.length > 0) {
            htmlParts.push('<ul>');
            listBuffer.forEach(item => {
                htmlParts.push(`<li>${(0, html_1.escapeHtml)(item)}</li>`);
            });
            htmlParts.push('</ul>');
            listBuffer = [];
        }
    };
    lines.forEach(rawLine => {
        const line = rawLine.trim();
        if (!line) {
            flushList();
            return;
        }
        const listMatch = line.match(/^[-*•]\s*(.+)$/);
        if (listMatch) {
            listBuffer.push(listMatch[1]);
            return;
        }
        flushList();
        htmlParts.push(`<p>${(0, html_1.escapeHtml)(line)}</p>`);
    });
    flushList();
    return htmlParts.join('');
};
exports.convertPlainTextToHtml = convertPlainTextToHtml;
const generateDocumentWithGemini = async ({ apiKey, documentType, prompt, environment, }) => {
    const trimmedKey = apiKey.trim();
    if (!trimmedKey) {
        throw new errors_1.AiProviderError('A chave de API da integração não está configurada.', 400);
    }
    const model = GEMINI_MODEL_BY_ENVIRONMENT[environment] || GEMINI_MODEL_BY_ENVIRONMENT.producao;
    const url = `${GEMINI_API_BASE_URL}/${model}:generateContent?key=${encodeURIComponent(trimmedKey)}`;
    const requestBody = {
        contents: [
            {
                role: 'user',
                parts: [{ text: buildGeminiPrompt(documentType, prompt) }],
            },
        ],
        generationConfig: {
            temperature: 0.7,
            topP: 0.95,
            topK: 40,
            maxOutputTokens: 2048,
        },
    };
    let response;
    try {
        response = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(requestBody),
        });
    }
    catch (error) {
        throw new errors_1.AiProviderError(error instanceof Error ? `Falha ao contactar a API da Gemini: ${error.message}` : 'Falha ao contactar a API da Gemini.', 502);
    }
    const rawPayload = await response.text();
    let parsedPayload = null;
    if (rawPayload) {
        try {
            parsedPayload = JSON.parse(rawPayload);
        }
        catch (error) {
            if (!response.ok) {
                throw new errors_1.AiProviderError(`Gemini API request failed with status ${response.status}`, mapGeminiStatusToHttp(response.status));
            }
            throw new errors_1.AiProviderError('Resposta da Gemini em formato inválido.', 502);
        }
    }
    if (!response.ok) {
        const message = extractGeminiErrorMessage(parsedPayload, response.status);
        throw new errors_1.AiProviderError(message, mapGeminiStatusToHttp(response.status));
    }
    const candidates = (parsedPayload === null || parsedPayload === void 0 ? void 0 : parsedPayload.candidates) || [];
    const firstCandidate = candidates.find(candidate => {
        const parts = candidate.content && Array.isArray(candidate.content.parts)
            ? candidate.content.parts
            : null;
        if (!parts) {
            return false;
        }
        return parts.some(part => typeof part.text === 'string' && part.text.trim().length > 0);
    });
    if (!firstCandidate) {
        throw new errors_1.AiProviderError('A resposta da Gemini não continha conteúdo gerado.', 502);
    }
    const candidateParts = firstCandidate.content && Array.isArray(firstCandidate.content.parts)
        ? firstCandidate.content.parts
        : [];
    const combinedText = candidateParts
        .map(part => (typeof part.text === 'string' ? part.text : ''))
        .join('\n')
        .trim();
    if (!combinedText) {
        throw new errors_1.AiProviderError('A resposta da Gemini retornou texto vazio.', 502);
    }
    const structured = parseGeminiStructuredResponse(combinedText);
    if (structured) {
        const html = buildHtmlFromGeminiStructuredResponse(documentType, structured);
        if (html.trim().length > 0) {
            return html;
        }
    }
    return convertPlainTextToHtml(documentType, combinedText);
};
exports.generateDocumentWithGemini = generateDocumentWithGemini;
