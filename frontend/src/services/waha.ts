import { getApiUrl } from '@/lib/api';
import {
  WAHAConfig,
  ChatOverview,
  Message,
  SendTextRequest,
  SendImageRequest,
  SendImageResponse,
  SendFileRequest,
  SendFileResponse,
  SendVoiceRequest,
  SendVoiceResponse,
  WAHAResponse,
  SessionStatus,
} from '@/types/waha';

const JSON_CONTENT_TYPE_REGEX = /application\/json|\+json/i;

const SESSION_RECOVERY_MESSAGE =
  'A sessão do WhatsApp ficou inválida. Desconecte o dispositivo e gere um novo QR Code para restabelecer a conexão.';

export const WAHA_SESSION_RECOVERY_MESSAGE = SESSION_RECOVERY_MESSAGE;

const extractWahaErrorMessage = (rawBody: string, status: number): string => {
  const trimmed = rawBody.trim();

  if (!trimmed) {
    return `WAHA respondeu com status ${status}.`;
  }

  if (trimmed.startsWith('<')) {
    return SESSION_RECOVERY_MESSAGE;
  }

  try {
    const parsed = JSON.parse(trimmed) as Record<string, unknown> | string;
    if (typeof parsed === 'string') {
      return parsed;
    }

    const messageCandidate = parsed?.message ?? parsed?.error ?? parsed?.detail;
    if (typeof messageCandidate === 'string' && messageCandidate.trim().length > 0) {
      return messageCandidate.trim();
    }
  } catch (error) {
    // Ignore JSON parse errors and fall back to returning the trimmed text below.
  }

  return trimmed;
};

const buildWahaErrorMessage = (status: number, rawBody: string): string => {
  const extracted = extractWahaErrorMessage(rawBody, status);

  if (status === 422) {
    if (!extracted || extracted === SESSION_RECOVERY_MESSAGE) {
      return SESSION_RECOVERY_MESSAGE;
    }
    return `${SESSION_RECOVERY_MESSAGE} Detalhes: ${extracted}`;
  }

  return extracted;
};

export class WAHARequestError extends Error {
  status?: number;

  constructor(message: string, status?: number) {
    super(message);
    this.name = 'WAHARequestError';
    this.status = status;
  }
}

const resolveIntegrationId = (): number => {
  const rawValue = (import.meta.env.VITE_WAHA_INTEGRATION_ID as string | undefined)?.trim();
  if (!rawValue) {
    return 1;
  }

  const parsed = Number(rawValue);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return 1;
  }

  return Math.floor(parsed);
};

const WAHA_INTEGRATION_ID = resolveIntegrationId();

const DEFAULT_WAHA_SESSION = (
  import.meta.env.VITE_WAHA_SESSION as string | undefined
)?.trim() || 'QuantumTecnologia01';

const isNonEmptyString = (value: unknown): value is string =>
  typeof value === 'string' && value.trim().length > 0;

const normalizeBaseUrl = (url: string): string => url.replace(/\/+$/, '');

const isSafeBlobUrl = (value: string): boolean => /^(blob:|data:)/i.test(value);

const createObjectUrlFromBlob = (blob: Blob): string => URL.createObjectURL(blob);

type IntegrationApiKeyPayload = {
  apiUrl?: unknown;
  key?: unknown;
  environment?: unknown;
  metadata?: unknown;
};

type RawRecord = Record<string, unknown>;

const isRawRecord = (value: unknown): value is RawRecord =>
  typeof value === 'object' && value !== null;

const readString = (record: RawRecord | null | undefined, key: string): string | undefined => {
  if (!record) {
    return undefined;
  }
  const value = record[key];
  return typeof value === 'string' ? value : undefined;
};

const toNumber = (value: unknown): number | undefined => {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === 'string' && value.trim().length > 0) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : undefined;
  }
  return undefined;
};

const readNumber = (record: RawRecord | null | undefined, key: string): number | undefined =>
  record ? toNumber(record[key]) : undefined;

const toBoolean = (value: unknown): boolean | undefined => {
  if (typeof value === 'boolean') {
    return value;
  }
  if (typeof value === 'number') {
    return value !== 0;
  }
  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase();
    if (['true', '1', 'yes', 'y'].includes(normalized)) {
      return true;
    }
    if (['false', '0', 'no', 'n'].includes(normalized)) {
      return false;
    }
  }
  return undefined;
};

const readBoolean = (record: RawRecord | null | undefined, key: string): boolean | undefined =>
  record ? toBoolean(record[key]) : undefined;

const normalizeTimestamp = (value: unknown): number | undefined => {
  const numeric = toNumber(value);
  if (typeof numeric !== 'number') {
    return undefined;
  }
  return numeric > 1e12 ? numeric : numeric * 1000;
};

const toLowerCase = (value: unknown): string => (typeof value === 'string' ? value.toLowerCase() : '');

const documentExtensions = [
  '.pdf',
  '.doc',
  '.docx',
  '.xls',
  '.xlsx',
  '.ppt',
  '.pptx',
  '.txt',
  '.csv',
  '.zip',
  '.rar',
  '.7z',
  '.tar',
  '.gz',
  '.xml',
  '.json',
  '.odt',
  '.ods',
  '.odp',
];

const detectMessageType = (raw: RawRecord | null | undefined): 'text' | 'image' | 'audio' | 'document' => {
  if (!raw) {
    return 'text';
  }

  const typeValue = toLowerCase(readString(raw, 'type'));
  const mime = toLowerCase(readString(raw, 'mimetype') ?? readString(raw, 'mimeType'));
  const fileName = toLowerCase(readString(raw, 'filename') ?? readString(raw, 'fileName'));

  if (typeValue === 'audio' || typeValue === 'ptt' || typeValue === 'voice') {
    return 'audio';
  }
  if (mime.startsWith('audio/')) {
    return 'audio';
  }
  if ([
    '.ogg',
    '.mp3',
    '.m4a',
    '.wav',
    '.aac',
  ].some((extension) => fileName.endsWith(extension))) {
    return 'audio';
  }

  if (typeValue === 'image' || mime.startsWith('image/')) {
    return 'image';
  }
  if (typeValue === 'sticker') {
    return 'image';
  }
  if ([
    '.png',
    '.jpg',
    '.jpeg',
    '.gif',
    '.webp',
    '.heic',
  ].some((extension) => fileName.endsWith(extension))) {
    return 'image';
  }

  if (typeValue === 'document' || typeValue === 'file') {
    return 'document';
  }

  if (typeValue === 'video' || mime.startsWith('video/')) {
    return 'document';
  }

  if (mime && !mime.startsWith('image/') && !mime.startsWith('audio/')) {
    return 'document';
  }

  if (documentExtensions.some((extension) => fileName.endsWith(extension))) {
    return 'document';
  }

  if (raw['hasMedia'] === true || toBoolean(raw['hasMedia']) === true) {
    return 'document';
  }

  return 'text';
};

const createDataUrlFromBase64 = (payload: string, mimeType?: string): string | undefined => {
  const trimmed = payload.trim();
  if (!trimmed) {
    return undefined;
  }
  if (trimmed.startsWith('data:')) {
    return trimmed;
  }

  const normalized = trimmed.replace(/\s+/g, '');
  const resolvedMime = mimeType && mimeType.trim().length > 0 ? mimeType.trim() : 'application/octet-stream';
  return `data:${resolvedMime};base64,${normalized}`;
};

const pickMediaUrl = (raw: RawRecord | null | undefined): string | undefined => {
  if (!raw) {
    return undefined;
  }

  const nestedRecords: RawRecord[] = [raw];
  const media = isRawRecord(raw['media']) ? raw['media'] : null;
  if (media) {
    nestedRecords.push(media);
  }
  const mediaData = isRawRecord(raw['mediaData']) ? raw['mediaData'] : null;
  if (mediaData) {
    nestedRecords.push(mediaData);
  }

  const urlCandidates = ['mediaUrl', 'url', 'mediaURL', 'fileUrl', 'directPath', 'filePath', 'path'];
  for (const record of nestedRecords) {
    for (const key of urlCandidates) {
      const candidate = readString(record, key);
      if (candidate && candidate.trim().length > 0) {
        return candidate.trim();
      }
    }
  }

  const body = readString(raw, 'body');
  if (body && body.startsWith('data:')) {
    return body;
  }

  const base64Candidates = ['data', 'base64', 'base64Data', 'mediaData', 'content'];
  for (const record of nestedRecords) {
    for (const key of base64Candidates) {
      const payload = readString(record, key);
      if (!payload) {
        continue;
      }

      const mimeType =
        readString(record, 'mimetype') ??
        readString(record, 'mimeType') ??
        readString(raw, 'mimetype') ??
        readString(raw, 'mimeType');
      const dataUrl = createDataUrlFromBase64(payload, mimeType ?? undefined);
      if (dataUrl) {
        return dataUrl;
      }
    }
  }

  return undefined;
};

const ackNameToStatus = (value: unknown): Message['ack'] | undefined => {
  if (typeof value !== 'string') {
    return undefined;
  }
  switch (value.trim().toUpperCase()) {
    case 'READ':
      return 'READ';
    case 'DELIVERED':
      return 'DELIVERED';
    case 'SENT':
      return 'SENT';
    case 'PENDING':
      return 'PENDING';
    default:
      return undefined;
  }
};

const ackCodeToStatus = (value: unknown): Message['ack'] | undefined => {
  const code = toNumber(value);
  switch (code) {
    case 3:
      return 'READ';
    case 2:
      return 'DELIVERED';
    case 1:
      return 'SENT';
    case 0:
      return 'PENDING';
    default:
      return undefined;
  }
};

const sanitizeOverviewLastMessage = (raw: RawRecord | null | undefined): ChatOverview['lastMessage'] | undefined => {
  if (!raw) {
    return undefined;
  }

  const timestamp = normalizeTimestamp(raw['timestamp']);
  if (typeof timestamp !== 'number') {
    return undefined;
  }

  const type = detectMessageType(raw);
  const body = readString(raw, 'body');
  const preview = body && body.trim().length > 0
    ? body
    : type === 'image'
      ? 'Imagem'
      : type === 'audio'
        ? 'Mensagem de áudio'
        : type === 'document'
          ? 'Documento'
          : 'Nova conversa';

  return {
    id: readString(raw, 'id'),
    body: preview,
    timestamp,
    fromMe: readBoolean(raw, 'fromMe') ?? false,
    type,
    ack: readNumber(raw, 'ack'),
    ackName: readString(raw, 'ackName'),
  };
};

const sanitizeChatOverview = (raw: unknown): ChatOverview | null => {
  if (!isRawRecord(raw)) {
    return null;
  }

  const id = readString(raw, 'id');
  if (!id || id === 'status@broadcast') {
    return null;
  }

  if (raw['name'] === null) {
    return null;
  }

  const name = readString(raw, 'name') ?? 'Unknown Chat';
  const avatar = readString(raw, 'avatar');
  const picture = readString(raw, 'picture');
  const lastMessage = sanitizeOverviewLastMessage(isRawRecord(raw['lastMessage']) ? raw['lastMessage'] : null);
  const unreadCount = readNumber(raw, 'unreadCount');

  const overview: ChatOverview = {
    id,
    name,
    isGroup: id.includes('@g.us'),
    unreadCount: typeof unreadCount === 'number' ? unreadCount : 0,
  };

  const resolvedAvatar = avatar ?? picture;
  if (resolvedAvatar) {
    overview.avatar = resolvedAvatar;
  }
  const resolvedPicture = picture ?? avatar;
  if (resolvedPicture) {
    overview.picture = resolvedPicture;
  }
  if (lastMessage) {
    overview.lastMessage = lastMessage;
  }

  const archived = readBoolean(raw, 'archived');
  if (typeof archived === 'boolean') {
    overview.archived = archived;
  }
  const pinned = readBoolean(raw, 'pinned');
  if (typeof pinned === 'boolean') {
    overview.pinned = pinned;
  }

  return overview;
};

const sanitizeMessage = (chatId: string, raw: unknown): Message | null => {
  if (!isRawRecord(raw)) {
    return null;
  }

  const id = readString(raw, 'id');
  const timestamp = normalizeTimestamp(raw['timestamp']);
  if (!id || typeof timestamp !== 'number') {
    return null;
  }

  const mediaInfo = isRawRecord(raw['media']) ? raw['media'] : null;
  const mediaData = isRawRecord(raw['mediaData']) ? raw['mediaData'] : null;

  const mediaUrl = pickMediaUrl(raw);
  const hasMedia = readBoolean(raw, 'hasMedia');

  return {
    id,
    chatId,
    body: readString(raw, 'body'),
    timestamp,
    fromMe: readBoolean(raw, 'fromMe') ?? false,
    type: detectMessageType(raw),
    ack: ackNameToStatus(raw['ackName']) ?? ackCodeToStatus(raw['ack']),
    author: readString(raw, 'author') ?? readString(raw, 'participant') ?? readString(raw, 'from'),
    quotedMsgId: readString(raw, 'quotedMsgId') ?? readString(raw, 'quotedMsg') ?? readString(raw, 'quotedMessageId'),
    hasMedia: hasMedia ?? Boolean(mediaUrl),
    mediaUrl,
    filename:
      readString(raw, 'filename') ??
      readString(raw, 'fileName') ??
      readString(mediaInfo, 'filename') ??
      readString(mediaInfo, 'fileName') ??
      readString(mediaData, 'filename') ??
      readString(mediaData, 'fileName') ??
      undefined,
    caption: readString(raw, 'caption'),
    mimeType:
      readString(raw, 'mimetype') ??
      readString(raw, 'mimeType') ??
      readString(mediaInfo, 'mimetype') ??
      readString(mediaInfo, 'mimeType') ??
      readString(mediaData, 'mimetype') ??
      readString(mediaData, 'mimeType') ??
      undefined,
  };
};

class WAHAService {
  private config: WAHAConfig | null = null;
  private configPromise: Promise<WAHAConfig> | null = null;
  private sessionOverride: string | null = null;

  private async loadConfig(): Promise<WAHAConfig> {
    if (this.config) {
      return this.config;
    }

    if (!this.configPromise) {
      this.configPromise = this.fetchRemoteConfig()
        .then((resolvedConfig) => {
          this.config = resolvedConfig;
          return resolvedConfig;
        })
        .catch((error) => {
          this.configPromise = null;
          throw error;
        });
    }

    return this.configPromise;
  }

  setSessionOverride(sessionName: string | null): void {
    if (typeof sessionName !== 'string') {
      this.sessionOverride = null;
      return;
    }

    const trimmed = sessionName.trim();
    this.sessionOverride = trimmed.length > 0 ? trimmed : null;
  }

  private applySessionOverride(config: WAHAConfig): WAHAConfig {
    if (!this.sessionOverride) {
      return config;
    }

    if (config.session === this.sessionOverride) {
      return config;
    }

    return { ...config, session: this.sessionOverride };
  }

  async getResolvedConfig(): Promise<WAHAConfig> {
    const config = await this.loadConfig();
    return this.applySessionOverride(config);
  }

  private async fetchRemoteConfig(): Promise<WAHAConfig> {
    const endpoint = getApiUrl(`integrations/api-keys/${WAHA_INTEGRATION_ID}`);
    const response = await fetch(endpoint, {
      headers: { Accept: 'application/json' },
    });

    if (!response.ok) {
      throw new Error(`Falha ao carregar configurações do WAHA (status ${response.status})`);
    }

    const payload = (await response.json()) as IntegrationApiKeyPayload | null;
    const apiUrl = isNonEmptyString(payload?.apiUrl) ? payload.apiUrl.trim() : undefined;
    const apiKey = isNonEmptyString(payload?.key) ? payload.key.trim() : undefined;

    if (!apiUrl) {
      throw new Error('Configuração WAHA inválida: URL da API não foi informada.');
    }

    if (!apiKey) {
      throw new Error('Configuração WAHA inválida: chave da API não foi informada.');
    }

    const environment = isNonEmptyString(payload?.environment) ? payload.environment.trim() : undefined;
    let session: string | undefined;

    if (environment && !['producao', 'homologacao'].includes(environment.toLowerCase())) {
      session = environment;
    }

    const metadata = payload?.metadata;
    if (!session && metadata && typeof metadata === 'object') {
      const metadataRecord = metadata as Record<string, unknown>;
      const metadataSession =
        metadataRecord.session ??
        metadataRecord.wahaSession ??
        metadataRecord.whatsappSession ??
        metadataRecord.sessionName;

      if (isNonEmptyString(metadataSession)) {
        session = metadataSession.trim();
      }
    }

    return {
      baseUrl: normalizeBaseUrl(apiUrl),
      apiKey,
      session: session ?? DEFAULT_WAHA_SESSION,
    };
  }

  private async makeRequest<T>(endpoint: string, options: RequestInit = {}): Promise<WAHAResponse<T>> {
    let response: Response | null = null;

    try {
      const config = await this.getResolvedConfig();
      const url = `${config.baseUrl}${endpoint}`;
      response = await fetch(url, {
        ...options,
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json',
          'X-Api-Key': config.apiKey,
          ...options.headers,
        },
      });

      const contentType = response.headers.get('content-type') ?? '';
      const isJson = JSON_CONTENT_TYPE_REGEX.test(contentType);
      const bodyText = await response.text();

      if (!response.ok) {
        const message = buildWahaErrorMessage(response.status, bodyText);
        return { error: message, status: response.status };
      }

      if (response.status === 204 || bodyText.trim().length === 0) {
        return { status: response.status };
      }

      if (!isJson) {
        return {
          error: 'Resposta inválida do WAHA: conteúdo inesperado recebido.',
          status: response.status,
        };
      }

      try {
        const data = JSON.parse(bodyText) as T;
        return { data, status: response.status };
      } catch (error) {
        return {
          error: 'Não foi possível interpretar a resposta do WAHA.',
          status: response.status,
        };
      }
    } catch (error) {
      console.error('WAHA API Error:', error);
      const status = response?.status ?? 500;
      const message =
        status === 422
          ? SESSION_RECOVERY_MESSAGE
          : error instanceof Error
            ? error.message
            : 'Unknown error';

      return {
        error: message,
        status,
      };
    }
  }

  // Get session status
  async getSessionStatus(): Promise<WAHAResponse<SessionStatus>> {
    const config = await this.getResolvedConfig();
    return this.makeRequest<SessionStatus>(`/api/sessions/${config.session}`);
  }

  // Get chats overview
  async getChatsOverview(limit = 50, offset = 0): Promise<WAHAResponse<ChatOverview[]>> {
    const params = new URLSearchParams({
      limit: limit.toString(),
      offset: offset.toString(),
    });

    const config = await this.getResolvedConfig();
    const response = await this.makeRequest<unknown[]>(`/api/${config.session}/chats/overview?${params}`);

    if (Array.isArray(response.data)) {
      console.log('📊 Raw chats data:', response.data.length, 'chats');

      const validChats: ChatOverview[] = [];
      for (const rawChat of response.data) {
        const sanitized = sanitizeChatOverview(rawChat);
        if (sanitized) {
          console.log('🔄 Processando chat:', sanitized.name, sanitized.id);
          validChats.push(sanitized);
        } else if (isRawRecord(rawChat)) {
          console.log('🚫 Chat filtrado:', readString(rawChat, 'id'), readString(rawChat, 'name'));
        }
      }

      console.log('✅ Chats válidos processados:', validChats.length);
      return { ...response, data: validChats };
    }

    return { ...response, data: [] };
  }

  // Get messages from a chat
  async getChatMessages(
    chatId: string, 
    options: {
      limit?: number;
      offset?: number;
      downloadMedia?: boolean;
    } = {}
  ): Promise<WAHAResponse<Message[]>> {
    const params = new URLSearchParams({
      limit: (options.limit || 50).toString(),
      offset: (options.offset || 0).toString(),
      downloadMedia: (options.downloadMedia || false).toString(),
    });
    
    const config = await this.getResolvedConfig();
    const response = await this.makeRequest<unknown[]>(`/api/${config.session}/chats/${chatId}/messages?${params}`);

    if (Array.isArray(response.data)) {
      const messages = response.data
        .map((rawMessage) => sanitizeMessage(chatId, rawMessage))
        .filter((message): message is Message => Boolean(message));

      return { ...response, data: messages };
    }

    return { ...response, data: [] };
  }

  // Send text message
  async sendTextMessage(request: Omit<SendTextRequest, 'session'>): Promise<WAHAResponse<Message>> {
    const config = await this.getResolvedConfig();
    const payload: SendTextRequest = {
      ...request,
      session: config.session,
    };

    return this.makeRequest<Message>('/api/sendText', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  }

  async sendImageMessage(
    request: Omit<SendImageRequest, 'session'>,
  ): Promise<WAHAResponse<SendImageResponse>> {
    const config = await this.getResolvedConfig();
    const payload: SendImageRequest = {
      ...request,
      session: config.session,
    };

    return this.makeRequest<SendImageResponse>('/api/sendImage', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  }

  async sendFileMessage(
    request: Omit<SendFileRequest, 'session'>,
  ): Promise<WAHAResponse<SendFileResponse>> {
    const config = await this.getResolvedConfig();
    const payload: SendFileRequest = {
      ...request,
      session: config.session,
    };

    return this.makeRequest<SendFileResponse>('/api/sendFile', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  }

  async sendVoiceMessage(
    request: Omit<SendVoiceRequest, 'session'>,
  ): Promise<WAHAResponse<SendVoiceResponse>> {
    const config = await this.getResolvedConfig();
    const payload: SendVoiceRequest = {
      ...request,
      session: config.session,
    };

    return this.makeRequest<SendVoiceResponse>('/api/sendVoice', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  }

  // Mark messages as read
  async markAsRead(chatId: string, messages = 30): Promise<WAHAResponse<void>> {
    const params = new URLSearchParams({
      messages: messages.toString(),
    });

    const config = await this.getResolvedConfig();
    return this.makeRequest<void>(`/api/${config.session}/chats/${chatId}/messages/read?${params}`, {
      method: 'POST',
    });
  }

  // Get chat info
  async getChatInfo(chatId: string): Promise<WAHAResponse<Record<string, unknown>>> {
    const config = await this.getResolvedConfig();
    return this.makeRequest<Record<string, unknown>>(`/api/${config.session}/chats/${chatId}`);
  }

  // Get QR Code for authentication (if needed)
  async getQRCode(): Promise<WAHAResponse<{ mimetype: string; data: string }>> {
    const config = await this.getResolvedConfig();
    return this.makeRequest(`/api/${config.session}/auth/qr?format=image`);
  }

  // Utility method to format phone number to WhatsApp ID
  static formatPhoneToWhatsAppId(phone: string): string {
    // Remove all non-numeric characters
    const cleaned = phone.replace(/\D/g, '');
    // Add @c.us suffix for individual chats
    return `${cleaned}@c.us`;
  }

  // Utility method to extract phone number from WhatsApp ID
  static extractPhoneFromWhatsAppId(whatsappId: string): string {
    return whatsappId.replace('@c.us', '').replace('@g.us', '');
  }

  // Get webhook URL that should be configured in WAHA
  getWebhookUrl(baseUrl: string): string {
    return `${baseUrl}/api/webhook/waha`;
  }
}

export const wahaService = new WAHAService();

const resolveMediaRequestUrl = (baseUrl: string, mediaUrl: string): string | null => {
  const trimmed = mediaUrl.trim();
  if (!trimmed) {
    return null;
  }

  try {
    const resolved = new URL(trimmed, baseUrl);
    return resolved.toString();
  } catch (error) {
    console.error('Failed to resolve WAHA media URL', error);
    return null;
  }
};

const isSameOrigin = (baseUrl: string, targetUrl: string): boolean => {
  try {
    const base = new URL(baseUrl);
    const target = new URL(targetUrl);
    return base.origin === target.origin;
  } catch (error) {
    console.error('Failed to compare WAHA media origin', error);
    return false;
  }
};

export const downloadMediaBlob = async (mediaUrl: string): Promise<string> => {
  if (typeof mediaUrl !== 'string') {
    throw new Error('URL de mídia inválida.');
  }

  const trimmed = mediaUrl.trim();
  if (!trimmed) {
    throw new Error('URL de mídia inválida.');
  }

  if (isSafeBlobUrl(trimmed)) {
    return trimmed;
  }

  const config = await wahaService.getResolvedConfig();
  const resolvedUrl = resolveMediaRequestUrl(config.baseUrl, trimmed);

  if (!resolvedUrl) {
    return trimmed;
  }

  if (!isSameOrigin(config.baseUrl, resolvedUrl)) {
    return trimmed;
  }

  const response = await fetch(resolvedUrl, {
    headers: {
      'X-Api-Key': config.apiKey,
    },
  });

  const contentType = response.headers.get('content-type') ?? '';

  if (!response.ok || JSON_CONTENT_TYPE_REGEX.test(contentType)) {
    const bodyText = await response.text();

    if (!response.ok) {
      const message = buildWahaErrorMessage(response.status, bodyText);
      throw new WAHARequestError(message, response.status);
    }

    const message = extractWahaErrorMessage(bodyText, response.status ?? 200);
    throw new WAHARequestError(
      message || 'Resposta inválida ao baixar mídia do WAHA.',
      response.status,
    );
  }

  const blob = await response.blob();
  return createObjectUrlFromBlob(blob);
};

export default WAHAService;