import { Request, Response } from 'express';
import IntegrationApiKeyService, {
  API_KEY_ENVIRONMENTS,
  type ApiKeyEnvironment,
} from '../services/integrationApiKeyService';
import { AiProviderError } from '../services/aiProviders/errors';
import { generateDocumentWithGemini } from '../services/aiProviders/geminiProvider';
import { escapeHtml } from '../utils/html';
import { fetchAuthenticatedUserEmpresa } from '../utils/authUser';
import { buildErrorResponse } from '../utils/errorResponse';

const DEFAULT_AI_BACKGROUND_PROMPT = `Contexto:
Você atuará como advogado(a) responsável por elaborar minutas jurídicas estruturadas e adequadas ao caso apresentado.

Estrutura esperada:
1. Cabeçalho e qualificação das partes com campos [PREENCHER] para dados variáveis.
2. Seções temáticas que exponham fatos, fundamentos jurídicos (incluindo referências normativas e jurisprudenciais pertinentes) e pedidos ou cláusulas específicas.
3. Orientações práticas ou condicionantes relevantes ao documento.

Diretrizes adicionais:
- Utilize linguagem técnica, objetiva e compatível com a praxe forense brasileira.
- Garanta que cada seção tenha parágrafos coesos e, quando apropriado, listas para obrigações, condições ou etapas.
- Insira fundamentos legais com referências claras (ex.: artigos de lei, súmulas, precedentes) sempre que couber.
- Finalize com um checklist de validação contendo itens em formato de lista com campos [PREENCHER] para informações que o usuário deve confirmar.
- Destaque eventuais prazos ou alertas relevantes ao documento.
`;

const DOCUMENT_TYPE_BACKGROUND_PROMPTS: Record<string, string> = {
  contrato:
    'Para contratos, detalhe cláusulas essenciais como objeto, obrigações das partes, prazo, pagamento, garantias, penalidades e foro, sempre deixando campos [PREENCHER] para dados específicos.',
  peticao:
    'Para petições, inclua síntese dos fatos, fundamentação jurídica com dispositivos aplicáveis, pedidos bem delimitados e orientações sobre documentos anexos obrigatórios.',
};

function composeSummaryPrompt(documentType: string, userPrompt: string): string {
  const segments = [
    'Você é um assistente jurídico encarregado de sintetizar movimentações processuais.',
    'Produza um resumo objetivo em tópicos curtos, enfatizando decisões, prazos e providências necessárias.',
    'Utilize no máximo cinco tópicos e responda em português claro e profissional.',
    `Tipo de resumo: ${documentType.trim()}.`,
    userPrompt.trim(),
  ];

  return segments.filter(Boolean).join('\n\n');
}

function composeAiPrompt(
  documentType: string,
  userPrompt: string,
  options: { summary?: boolean } = {},
): string {
  const normalizedType = documentType.trim().toLowerCase();
  if (options.summary || normalizedType.includes('resumo')) {
    return composeSummaryPrompt(documentType, userPrompt);
  }

  const backgroundSegments = [DEFAULT_AI_BACKGROUND_PROMPT.trim()];
  const contextualBackground = DOCUMENT_TYPE_BACKGROUND_PROMPTS[normalizedType];

  if (contextualBackground) {
    backgroundSegments.push(contextualBackground);
  }

  backgroundSegments.push(`Tipo de documento: ${documentType.trim()}.`);

  const segments = [...backgroundSegments, userPrompt.trim()].filter(Boolean);
  return segments.join('\n\n');
}

const providerLabels: Record<string, string> = {
  gemini: 'Gemini',
  openai: 'OpenAI',
};

const integrationService = new IntegrationApiKeyService();
let hasLoggedUnknownEnvironment = false;

async function resolveEmpresaId(req: Request, res: Response): Promise<number | null> {
  if (!req.auth) {
    res.status(401).json({ error: 'Token inválido.' });
    return null;
  }

  try {
    const lookup = await fetchAuthenticatedUserEmpresa(req.auth.userId);

    if (!lookup.success) {
      res.status(lookup.status).json({ error: lookup.message });
      return null;
    }

    if (lookup.empresaId === null) {
      res.status(400).json({ error: 'Usuário não está vinculado a uma empresa.' });
      return null;
    }

    return lookup.empresaId;
  } catch (error) {
    console.error('Failed to resolve authenticated user empresa:', error);
    res.status(500).json({ error: 'Erro interno do servidor.' });
    return null;
  }
}

function isApiKeyEnvironment(value: string): value is ApiKeyEnvironment {
  return API_KEY_ENVIRONMENTS.includes(value as ApiKeyEnvironment);
}

function resolveEnvironment(value: string): ApiKeyEnvironment {
  if (isApiKeyEnvironment(value)) {
    return value;
  }

  if (!hasLoggedUnknownEnvironment) {
    console.warn('Integration environment value is not recognized, defaulting to produção:', value);
    hasLoggedUnknownEnvironment = true;
  }
  return 'producao';
}

function toTitleCase(value: string): string {
  return value
    .split(/\s+/)
    .filter(Boolean)
    .map(segment => segment.charAt(0).toUpperCase() + segment.slice(1).toLowerCase())
    .join(' ');
}

function buildHighlights(prompt: string): string[] {
  return prompt
    .split(/\n+/)
    .map(segment => segment.trim())
    .filter(Boolean)
    .slice(0, 5);
}

function buildFallbackContent(
  documentType: string,
  prompt: string,
  _providerLabel: string,
  options: { summary?: boolean } = {},
): string {
  const normalizedType = documentType.trim().toLowerCase();
  const highlights = buildHighlights(prompt);

  if (options.summary || normalizedType.includes('resumo')) {
    const itens = highlights.length > 0 ? highlights : [prompt.trim()].filter(Boolean);
    if (!itens.length) {
      return '- Sem conteúdo disponível para resumo.';
    }

    const linhas = itens.slice(0, 5).map(item => `- ${item}`);
    return ['Resumo automático da movimentação:', ...linhas].join('\n');
  }

  const introParagraph = `Em atendimento à solicitação apresentada, elaboramos o presente ${documentType.toLowerCase()} com base nas orientações fornecidas.`;
  const approachParagraph =
    'O texto prioriza clareza, objetividade e coerência jurídica, estruturando os argumentos de modo progressivo para facilitar a revisão.';
  const conclusionParagraph =
    'Revise o conteúdo, ajuste os dados específicos do caso concreto e complemente com informações adicionais antes de finalizar o documento.';

  const htmlParts: string[] = [
    `<p><strong>${escapeHtml(documentType)}</strong></p>`,
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
  } else {
    htmlParts.push(`<p>${escapeHtml(prompt)}</p>`);
  }

  htmlParts.push(`<p>${escapeHtml(conclusionParagraph)}</p>`);

  return htmlParts.join('');
}

export async function generateTextWithIntegration(req: Request, res: Response) {
  const { integrationId, documentType, prompt, mode } = req.body as {
    integrationId?: unknown;
    documentType?: unknown;
    prompt?: unknown;
    mode?: unknown;
  };

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

  if (mode !== undefined) {
    const validModes = ['summary', 'default'];
    if (typeof mode !== 'string' || !validModes.includes(mode.toLowerCase())) {
      return res.status(400).json({ error: "mode must be 'summary' or 'default' when provided" });
    }
  }

  const empresaId = await resolveEmpresaId(req, res);
  if (empresaId === null) {
    return;
  }

  try {
    const integration = await integrationService.findById(parsedIntegrationId, { empresaId });
    if (!integration || !integration.active) {
      return res.status(404).json({ error: 'Active integration not found' });
    }

    const providerLabel = providerLabels[integration.provider] ?? integration.provider;
    const normalizedDocumentType = toTitleCase(documentType.trim());
    const normalizedPrompt = prompt.trim();
    const isSummaryRequest =
      (typeof mode === 'string' && mode.toLowerCase() === 'summary') ||
      normalizedDocumentType.toLowerCase().includes('resumo');
    let htmlContent: string | null = null;

    if (integration.provider === 'gemini') {
      const environment = resolveEnvironment(integration.environment);
      try {
        htmlContent = await generateDocumentWithGemini({
          apiKey: integration.key,
          documentType: normalizedDocumentType,
          prompt: composeAiPrompt(normalizedDocumentType, normalizedPrompt, { summary: isSummaryRequest }),
          environment,
        });
      } catch (error) {
        if (error instanceof AiProviderError) {
          return res
            .status(error.statusCode)
            .json(
              buildErrorResponse(
                error,
                'Falha ao gerar conteúdo com o provedor de IA.',
                { expose: error.statusCode >= 400 && error.statusCode < 500 }
              )
            );
        }
        throw error;
      }
    }

    if (!htmlContent || !htmlContent.trim()) {
      htmlContent = buildFallbackContent(normalizedDocumentType, normalizedPrompt, providerLabel, {
        summary: isSummaryRequest,
      });
    }

    try {
      await integrationService.update(parsedIntegrationId, { lastUsed: new Date() }, { empresaId });
    } catch (updateError) {
      console.error('Failed to update integration lastUsed timestamp:', updateError);
    }

    return res.json({
      content: htmlContent,
      documentType: normalizedDocumentType,
      provider: integration.provider,
    });
  } catch (error) {
    console.error('Failed to generate AI content:', error);
    return res.status(500).json({ error: 'Erro interno do servidor.' });
  }
}
