import { AiProviderError } from './errors';
import type { ApiKeyEnvironment } from '../integrationApiKeyService';
import { escapeHtml } from '../../utils/html';

interface GeminiGenerationParams {
  apiKey: string;
  documentType: string;
  prompt: string;
  environment: ApiKeyEnvironment;
}

interface GeminiCandidatePart {
  text?: string;
}

interface GeminiCandidate {
  content?: {
    parts?: GeminiCandidatePart[];
  };
}

interface GeminiResponsePayload {
  candidates?: GeminiCandidate[];
  error?: {
    message?: string;
  };
}

interface FetchResponseLike {
  ok: boolean;
  status: number;
  text(): Promise<string>;
}

export interface GeminiStructuredSection {
  title?: unknown;
  paragraphs?: unknown;
  bullets?: unknown;
  items?: unknown;
  points?: unknown;
}

export interface GeminiStructuredResponse {
  intro?: unknown;
  summary?: unknown;
  overview?: unknown;
  sections?: unknown;
  highlights?: unknown;
  directives?: unknown;
  topics?: unknown;
  conclusion?: unknown;
  finalThoughts?: unknown;
  recommendations?: unknown;
  additionalNotes?: unknown;
  notes?: unknown;
  disclaimer?: unknown;
}

const GEMINI_API_BASE_URL = 'https://generativelanguage.googleapis.com/v1beta/models';
const GEMINI_MODEL_BY_ENVIRONMENT: Record<ApiKeyEnvironment, string> = {
  producao: 'gemini-2.5-flash',
  homologacao: 'gemini-2.5-flash',

};

function mapGeminiStatusToHttp(status: number): number {
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
}

function extractGeminiErrorMessage(payload: unknown, status: number): string {
  if (payload && typeof payload === 'object') {
    const errorObject = (payload as { error?: { message?: unknown }; message?: unknown }).error;
    const message = errorObject?.message ?? (payload as { message?: unknown }).message;
    if (typeof message === 'string' && message.trim().length > 0) {
      return message.trim();
    }
  }
  return `Gemini API request failed with status ${status}`;
}

function buildGeminiPrompt(documentType: string, prompt: string): string {
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
}

function toSafeString(value: unknown): string | null {
  if (typeof value === 'string') {
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : null;
  }
  if (typeof value === 'number' || typeof value === 'boolean') {
    return String(value);
  }
  if (value && typeof value === 'object' && 'text' in (value as { text?: unknown })) {
    const potential = (value as { text?: unknown }).text;
    if (typeof potential === 'string') {
      const trimmed = potential.trim();
      return trimmed.length > 0 ? trimmed : null;
    }
  }
  return null;
}

function toStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return value
    .map(item => toSafeString(item))
    .filter((item): item is string => typeof item === 'string' && item.length > 0);
}

function firstNonEmptyString(values: unknown[]): string | null {
  for (const value of values) {
    const normalized = toSafeString(value);
    if (normalized) {
      return normalized;
    }
  }
  return null;
}

function cleanGeminiJsonPayload(text: string): string {
  let cleaned = text.trim();
  cleaned = cleaned.replace(/^```(?:json)?\s*/i, '');
  cleaned = cleaned.replace(/```\s*$/i, '');
  return cleaned.trim();
}

export function parseGeminiStructuredResponse(text: string): GeminiStructuredResponse | null {
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
    return parsed as GeminiStructuredResponse;
  } catch (error) {
    return null;
  }
}

export function buildHtmlFromGeminiStructuredResponse(
  documentType: string,
  payload: GeminiStructuredResponse,
): string {
  const htmlParts: string[] = [`<p><strong>${escapeHtml(documentType)}</strong></p>`];

  const intro = firstNonEmptyString([payload.intro, payload.summary, payload.overview]);
  if (intro) {
    htmlParts.push(`<p>${escapeHtml(intro)}</p>`);
  }

  const sections: GeminiStructuredSection[] = Array.isArray(payload.sections)
    ? (payload.sections as GeminiStructuredSection[])
    : [];

  sections.forEach(section => {
    const title = firstNonEmptyString([section.title]);
    if (title) {
      htmlParts.push(`<p><strong>${escapeHtml(title)}</strong></p>`);
    }

    const paragraphs = toStringArray(section.paragraphs);
    paragraphs.forEach(paragraph => {
      htmlParts.push(`<p>${escapeHtml(paragraph)}</p>`);
    });

    const bulletCandidates = [section.bullets, section.items, section.points];
    const bullets = toStringArray(bulletCandidates.find(value => Array.isArray(value)) ?? []);
    if (bullets.length > 0) {
      htmlParts.push('<ul>');
      bullets.forEach(item => {
        htmlParts.push(`<li>${escapeHtml(item)}</li>`);
      });
      htmlParts.push('</ul>');
    }
  });

  const highlights = toStringArray(payload.highlights ?? payload.directives ?? payload.topics);
  if (highlights.length > 0) {
    htmlParts.push('<p>Principais pontos considerados:</p>');
    htmlParts.push('<ul>');
    highlights.forEach(item => {
      htmlParts.push(`<li>${escapeHtml(item)}</li>`);
    });
    htmlParts.push('</ul>');
  }

  const conclusion = firstNonEmptyString([payload.conclusion, payload.finalThoughts, payload.recommendations]);
  if (conclusion) {
    htmlParts.push(`<p>${escapeHtml(conclusion)}</p>`);
  }

  const notes = toStringArray(payload.additionalNotes ?? payload.notes ?? payload.disclaimer);
  notes.forEach(note => {
    htmlParts.push(`<p>${escapeHtml(note)}</p>`);
  });

  return htmlParts.join('');
}

export function convertPlainTextToHtml(documentType: string, text: string): string {
  const normalized = text.replace(/\r\n/g, '\n').trim();
  const htmlParts: string[] = [`<p><strong>${escapeHtml(documentType)}</strong></p>`];

  if (!normalized) {
    return htmlParts.join('');
  }

  const lines = normalized.split('\n');
  let listBuffer: string[] = [];

  const flushList = () => {
    if (listBuffer.length > 0) {
      htmlParts.push('<ul>');
      listBuffer.forEach(item => {
        htmlParts.push(`<li>${escapeHtml(item)}</li>`);
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
    htmlParts.push(`<p>${escapeHtml(line)}</p>`);
  });

  flushList();

  return htmlParts.join('');
}

export async function generateDocumentWithGemini({
  apiKey,
  documentType,
  prompt,
  environment,
}: GeminiGenerationParams): Promise<string> {
  const trimmedKey = apiKey.trim();
  if (!trimmedKey) {
    throw new AiProviderError('A chave de API da integração não está configurada.', 400);
  }

  const model = GEMINI_MODEL_BY_ENVIRONMENT[environment] ?? GEMINI_MODEL_BY_ENVIRONMENT.producao;
  const url = `${GEMINI_API_BASE_URL}/${model}:generateContent`;


  const requestBody = {
    contents: [
      {
        role: 'user',

        parts: [{ text: buildGeminiPrompt(documentType, prompt) }],
      },
    ],
    generationConfig: {
      thinkingConfig: {
        thinkingBudget: 0,
      },

    },
  };

  let response: FetchResponseLike;
  try {
    response = (await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-goog-api-key': trimmedKey,

      },
      body: JSON.stringify(requestBody),
    })) as FetchResponseLike;
  } catch (error) {
    throw new AiProviderError(
      error instanceof Error
        ? `Falha ao contactar a API da Gemini: ${error.message}`
        : 'Falha ao contactar a API da Gemini.',
      502,
    );
  }

  const rawPayload = await response.text();
  let parsedPayload: GeminiResponsePayload | null = null;

  if (rawPayload) {
    try {
      parsedPayload = JSON.parse(rawPayload) as GeminiResponsePayload;
    } catch (error) {
      if (!response.ok) {
        throw new AiProviderError(
          `Gemini API request failed with status ${response.status}`,
          mapGeminiStatusToHttp(response.status),
        );
      }
      throw new AiProviderError('Resposta da Gemini em formato inválido.', 502);
    }
  }

  if (!response.ok) {
    const message = extractGeminiErrorMessage(parsedPayload, response.status);
    throw new AiProviderError(message, mapGeminiStatusToHttp(response.status));
  }

  const candidates = parsedPayload?.candidates ?? [];
  const firstCandidate = candidates.find(candidate => {
    const parts = candidate.content?.parts;
    if (!Array.isArray(parts)) {
      return false;
    }
    return parts.some(part => typeof part.text === 'string' && part.text.trim().length > 0);
  });

  if (!firstCandidate) {
    throw new AiProviderError('A resposta da Gemini não continha conteúdo gerado.', 502);
  }

  const combinedText = firstCandidate.content?.parts
    ?.map(part => (typeof part.text === 'string' ? part.text : ''))
    .join('\n')
    .trim();

  if (!combinedText) {
    throw new AiProviderError('A resposta da Gemini retornou texto vazio.', 502);
  }

  const structured = parseGeminiStructuredResponse(combinedText);

  if (structured) {
    const html = buildHtmlFromGeminiStructuredResponse(documentType, structured);
    if (html.trim().length > 0) {
      return html;
    }
  }

  return convertPlainTextToHtml(documentType, combinedText);
}

