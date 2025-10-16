import { Readable } from 'node:stream';
import type { MessageAttachment } from './chatService';
import { isPublicFileAccessEnabled, saveUploadedFile } from './fileStorageService';
import type { UploadedFile } from '../middlewares/uploadMiddleware';

export interface WahaConfig {
  baseUrl: string;
  apiKey: string;
  session: string;
}

const DEFAULT_WAHA_SESSION = (process.env.WAHA_SESSION ?? '').trim() || 'QuantumTecnologia01';

let cachedConfig: { baseUrl: string; apiKey: string; session: string } | null = null;

const sanitizeString = (value: string | null | undefined): string | null => {
  if (typeof value !== 'string') {
    return null;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
};

const normalizeBaseUrl = (value: string): string => value.replace(/\/+$/, '');

const getFetchImplementation = (): typeof fetch => {
  const fetchImpl = (globalThis as { fetch?: typeof fetch }).fetch;
  if (!fetchImpl) {
    throw new Error('Fetch API is not available in the current environment.');
  }
  return fetchImpl;
};

export const getWahaConfig = async (sessionOverride?: string | null): Promise<WahaConfig> => {
  if (!cachedConfig) {
    const baseUrl = sanitizeString(process.env.WAHA_BASE_URL);
    const apiKey = sanitizeString(process.env.WAHA_API_KEY);
    const session = sanitizeString(process.env.WAHA_SESSION) ?? DEFAULT_WAHA_SESSION;

    if (!baseUrl) {
      throw new Error('WAHA_BASE_URL não foi configurado.');
    }

    if (!apiKey) {
      throw new Error('WAHA_API_KEY não foi configurado.');
    }

    cachedConfig = {
      baseUrl: normalizeBaseUrl(baseUrl),
      apiKey,
      session,
    };
  }

  const override = sanitizeString(sessionOverride);

  return {
    baseUrl: cachedConfig.baseUrl,
    apiKey: cachedConfig.apiKey,
    session: override ?? cachedConfig.session,
  } satisfies WahaConfig;
};

const parseContentDispositionFilename = (headerValue: string | null): string | undefined => {
  if (!headerValue) {
    return undefined;
  }

  const segments = headerValue
    .split(';')
    .map((part) => part.trim())
    .filter(Boolean);

  for (const segment of segments) {
    const [key, rawValue] = segment.split('=');
    if (!rawValue) {
      continue;
    }

    if (key.toLowerCase() === 'filename') {
      return rawValue.replace(/^"|"$/g, '');
    }

    if (key.toLowerCase() === 'filename*') {
      const parts = rawValue.split("'", 3);
      if (parts.length === 3) {
        return decodeURIComponent(parts[2]);
      }
    }
  }

  return undefined;
};

const buildUploadedFile = (buffer: Buffer, originalname: string, mimeType: string): UploadedFile => ({
  fieldname: 'file',
  originalname,
  encoding: '7bit',
  mimetype: mimeType,
  size: buffer.length,
  buffer,
  destination: '',
  filename: originalname,
  path: '',
  stream: Readable.from(buffer),
});

const ensureAbsoluteUrl = (candidate: string, baseUrl: string): string | null => {
  try {
    return new URL(candidate, baseUrl).toString();
  } catch (error) {
    console.error('Não foi possível compor URL absoluta para mídia do WAHA', error, { candidate });
    return null;
  }
};

type DownloadOptions = {
  config: WahaConfig;
  sessionId: string;
  messageId?: string | null;
  candidateUrl?: string | null;
};

type DownloadResult = {
  buffer: Buffer;
  mimeType: string;
  fileName: string;
};

const attemptDownload = async (
  url: string,
  headers: Record<string, string>,
  fetchImpl: typeof fetch,
  fallbackName: string,
  fallbackMime: string,
): Promise<DownloadResult | null> => {
  try {
    const response = await fetchImpl(url, { headers });
    if (!response.ok) {
      return null;
    }

    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const contentType = response.headers.get('content-type') ?? fallbackMime;
    const fileName =
      parseContentDispositionFilename(response.headers.get('content-disposition')) ?? fallbackName;

    return {
      buffer,
      mimeType: contentType || fallbackMime,
      fileName,
    };
  } catch (error) {
    console.error('Falha ao baixar mídia do WAHA', error, { url });
    return null;
  }
};

const downloadMedia = async (
  options: DownloadOptions,
  fallbackName: string,
  fallbackMime: string,
): Promise<DownloadResult | null> => {
  const fetchImpl = getFetchImplementation();
  const headers = {
    Accept: '*/*',
    'X-Api-Key': options.config.apiKey,
  } satisfies Record<string, string>;

  const candidates: string[] = [];

  if (options.messageId) {
    const encodedSession = encodeURIComponent(options.sessionId);
    const encodedMessage = encodeURIComponent(options.messageId);
    candidates.push(`/api/${encodedSession}/messages/${encodedMessage}/download-media`);
  }

  if (options.candidateUrl) {
    candidates.push(options.candidateUrl);
  }

  for (const candidate of candidates) {
    const absolute = candidate.startsWith('http://') || candidate.startsWith('https://')
      ? candidate
      : ensureAbsoluteUrl(candidate, options.config.baseUrl);

    if (!absolute) {
      continue;
    }

    const result = await attemptDownload(absolute, headers, fetchImpl, fallbackName, fallbackMime);
    if (result) {
      return result;
    }
  }

  return null;
};

type AttachmentContext = {
  attachments: MessageAttachment[];
  messageId?: string | null;
  sessionId?: string | null;
};

export const persistWahaAttachments = async ({
  attachments,
  messageId,
  sessionId,
}: AttachmentContext): Promise<MessageAttachment[]> => {
  if (!attachments.length) {
    return attachments;
  }

  let config: WahaConfig;
  try {
    config = await getWahaConfig(sessionId);
  } catch (error) {
    console.error('Falha ao carregar configuração do WAHA', error);
    return attachments;
  }

  const resolvedSession = sanitizeString(sessionId) ?? config.session;
  const results: MessageAttachment[] = [];

  for (const attachment of attachments) {
    const fallbackName = attachment.name || 'arquivo';
    const fallbackMime = attachment.mimeType || 'application/octet-stream';

    const download = await downloadMedia(
      {
        config,
        sessionId: resolvedSession,
        messageId,
        candidateUrl: attachment.downloadUrl ?? attachment.url,
      },
      fallbackName,
      fallbackMime,
    );

    if (!download) {
      results.push(attachment);
      continue;
    }

    try {
      const uploadedFile = buildUploadedFile(download.buffer, download.fileName || fallbackName, download.mimeType);
      const stored = await saveUploadedFile(uploadedFile);
      const accessibleUrl =
        stored.url ?? (isPublicFileAccessEnabled() ? `/uploads/${stored.key}` : null);

      results.push({
        ...attachment,
        url: accessibleUrl ?? attachment.url,
        downloadUrl: accessibleUrl ?? attachment.downloadUrl ?? attachment.url,
        name: stored.name || download.fileName || fallbackName,
        mimeType: stored.mimeType || download.mimeType || fallbackMime,
      });
    } catch (error) {
      console.error('Falha ao armazenar mídia do WAHA', error);
      results.push(attachment);
    }
  }

  return results;
};
