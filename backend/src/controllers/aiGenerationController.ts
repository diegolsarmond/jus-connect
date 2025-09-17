import { Request, Response } from 'express';
import IntegrationApiKeyService from '../services/integrationApiKeyService';
import { AiProviderError } from '../services/aiProviders/errors';
import { generateDocumentWithGemini } from '../services/aiProviders/geminiProvider';
import { escapeHtml } from '../utils/html';

const providerLabels: Record<string, string> = {
  gemini: 'Gemini',
  openai: 'OpenAI',
};

const integrationService = new IntegrationApiKeyService();

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

function buildFallbackContent(documentType: string, prompt: string, providerLabel: string): string {
  const highlights = buildHighlights(prompt);

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
  htmlParts.push(`<p>${escapeHtml(`Integração utilizada: ${providerLabel}.`)}</p>`);

  return htmlParts.join('');
}

export async function generateTextWithIntegration(req: Request, res: Response) {
  const { integrationId, documentType, prompt } = req.body as {
    integrationId?: unknown;
    documentType?: unknown;
    prompt?: unknown;
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

  try {
    const integration = await integrationService.findById(parsedIntegrationId);
    if (!integration || !integration.active) {
      return res.status(404).json({ error: 'Active integration not found' });
    }

    const providerLabel = providerLabels[integration.provider] ?? integration.provider;
    const normalizedDocumentType = toTitleCase(documentType.trim());
    const normalizedPrompt = prompt.trim();
    let htmlContent: string | null = null;

    if (integration.provider === 'gemini') {
      try {
        htmlContent = await generateDocumentWithGemini({
          apiKey: integration.key,
          documentType: normalizedDocumentType,
          prompt: normalizedPrompt,
          environment: integration.environment,
        });
      } catch (error) {
        if (error instanceof AiProviderError) {
          return res.status(error.statusCode).json({ error: error.message });
        }
        throw error;
      }
    }

    if (!htmlContent || !htmlContent.trim()) {
      htmlContent = buildFallbackContent(normalizedDocumentType, normalizedPrompt, providerLabel);
    } else if (!/Integração utilizada/.test(htmlContent)) {
      htmlContent = `${htmlContent}<p>${escapeHtml(`Integração utilizada: ${providerLabel}.`)}</p>`;
    }

    try {
      await integrationService.update(parsedIntegrationId, { lastUsed: new Date() });
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
    return res.status(500).json({ error: 'Internal server error' });
  }
}
