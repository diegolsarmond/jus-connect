import { WAHAConfig, ChatOverview, Message, SendTextRequest, WAHAResponse, SessionStatus } from '@/types/waha';

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

const detectMessageType = (raw: RawRecord | null | undefined): 'text' | 'image' | 'audio' => {
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

  if ((raw['hasMedia'] === true || toBoolean(raw['hasMedia']) === true) && !mime) {
    return 'image';
  }

  return 'text';
};

const pickMediaUrl = (raw: RawRecord | null | undefined): string | undefined => {
  if (!raw) {
    return undefined;
  }

  const candidates = ['mediaUrl', 'url', 'mediaURL', 'fileUrl', 'directPath', 'filePath', 'path'];
  for (const key of candidates) {
    const candidate = readString(raw, key);
    if (candidate && candidate.trim().length > 0) {
      return candidate;
    }
  }
  const body = readString(raw, 'body');
  if (body && body.startsWith('data:')) {
    return body;
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
    filename: readString(raw, 'filename') ?? readString(raw, 'fileName'),
    caption: readString(raw, 'caption'),
    mimeType: readString(raw, 'mimetype') ?? readString(raw, 'mimeType'),
  };
};

class WAHAService {
  private config: WAHAConfig;

  constructor() {
    // WAHA API Configuration
    this.config = {
      baseUrl: 'https://waha.quantumtecnologia.com.br',
      apiKey: '4YF9gDywbivQWAP_JpGZsGTVgVz3gP55T1hXbYAg8y8',
      session: 'QuantumTecnologia01'
    };
  }

  private async makeRequest<T>(
    endpoint: string, 
    options: RequestInit = {}
  ): Promise<WAHAResponse<T>> {
    try {
      const url = `${this.config.baseUrl}${endpoint}`;
      const response = await fetch(url, {
        ...options,
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json',
          'X-Api-Key': this.config.apiKey,
          ...options.headers,
        },
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      return { data, status: response.status };
    } catch (error) {
      console.error('WAHA API Error:', error);
      return { 
        error: error instanceof Error ? error.message : 'Unknown error',
        status: 500 
      };
    }
  }

  // Get session status
  async getSessionStatus(): Promise<WAHAResponse<SessionStatus>> {
    return this.makeRequest<SessionStatus>(`/api/sessions/${this.config.session}`);
  }

  // Get chats overview
  async getChatsOverview(limit = 50, offset = 0): Promise<WAHAResponse<ChatOverview[]>> {
    const params = new URLSearchParams({
      limit: limit.toString(),
      offset: offset.toString(),
    });
    
    const response = await this.makeRequest<unknown[]>(`/api/${this.config.session}/chats/overview?${params}`);

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
    
    const response = await this.makeRequest<unknown[]>(`/api/${this.config.session}/chats/${chatId}/messages?${params}`);

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
    const payload: SendTextRequest = {
      ...request,
      session: this.config.session,
    };

    return this.makeRequest<Message>('/api/sendText', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  }

  // Mark messages as read
  async markAsRead(chatId: string, messages = 30): Promise<WAHAResponse<void>> {
    const params = new URLSearchParams({
      messages: messages.toString(),
    });
    
    return this.makeRequest<void>(`/api/${this.config.session}/chats/${chatId}/messages/read?${params}`, {
      method: 'POST',
    });
  }

  // Get chat info
  async getChatInfo(chatId: string): Promise<WAHAResponse<Record<string, unknown>>> {
    return this.makeRequest<Record<string, unknown>>(`/api/${this.config.session}/chats/${chatId}`);
  }

  // Get QR Code for authentication (if needed)
  async getQRCode(): Promise<WAHAResponse<{ mimetype: string; data: string }>> {
    return this.makeRequest(`/api/${this.config.session}/auth/qr?format=image`);
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
export default WAHAService;