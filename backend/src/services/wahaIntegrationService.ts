import http from 'http';
import https from 'https';
import { IncomingHttpHeaders } from 'http';
import { URL } from 'url';
import ChatService, {
  ChatMessage,
  ChatMessageStatus,
  ChatMessageType,
  ConversationDetails,
  MessageAttachment,
  SendMessageInput,
  ValidationError as ChatValidationError,
} from './chatService';
import WahaConfigService, {
  ValidationError as ConfigValidationError,
} from './wahaConfigService';

export class IntegrationNotConfiguredError extends Error {
  constructor(message = 'WAHA integration is not configured') {
    super(message);
    this.name = 'IntegrationNotConfiguredError';
  }
}

export class WebhookAuthorizationError extends Error {
  constructor(message = 'Invalid webhook signature') {
    super(message);
    this.name = 'WebhookAuthorizationError';
  }
}

type QueryHeaders = IncomingHttpHeaders;

interface HttpResponse<T = unknown> {
  status: number;
  headers: QueryHeaders;
  data: T | string | null;
}

interface RequestOptions {
  method?: string;
  headers?: Record<string, string>;
  body?: unknown;
  timeoutMs?: number;
}

class HttpClient {
  constructor(private readonly defaultTimeout = 10000) {}

  async postJson<T = unknown>(
    url: string,
    body: unknown,
    headers: Record<string, string>,
  ): Promise<HttpResponse<T>> {
    const combinedHeaders = { 'Content-Type': 'application/json', ...headers };
    return this.request<T>(url, { method: 'POST', headers: combinedHeaders, body });
  }

  async request<T = unknown>(url: string, options: RequestOptions = {}): Promise<HttpResponse<T>> {
    const parsedUrl = new URL(url);
    const isHttps = parsedUrl.protocol === 'https:';
    const transport = isHttps ? https : http;
    const headers = options.headers ? { ...options.headers } : {};
    const method = options.method ?? 'GET';
    const timeoutMs = options.timeoutMs ?? this.defaultTimeout;

    let payload: string | undefined;
    if (options.body !== undefined) {
      payload = typeof options.body === 'string' ? options.body : JSON.stringify(options.body);
      headers['Content-Length'] = Buffer.byteLength(payload).toString();
    }

    const requestOptions: http.RequestOptions = {
      method,
      headers,
    };

    return new Promise<HttpResponse<T>>((resolve, reject) => {
      const req = transport.request(parsedUrl, requestOptions, (res) => {
        const chunks: Buffer[] = [];
        res.on('data', (chunk) => {
          chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
        });
        res.on('end', () => {
          const raw = Buffer.concat(chunks).toString();
          const contentType = res.headers['content-type'] ?? '';
          let data: unknown = raw;
          if (raw && typeof raw === 'string' && /json/i.test(String(contentType))) {
            try {
              data = JSON.parse(raw);
            } catch (error) {
              data = raw;
            }
          }
          resolve({
            status: res.statusCode ?? 0,
            headers: res.headers,
            data: data as T | string | null,
          });
        });
      });

      req.on('error', (error) => reject(error));
      req.setTimeout(timeoutMs, () => {
        req.destroy(new Error(`Request timed out after ${timeoutMs}ms`));
      });

      if (payload) {
        req.write(payload);
      }
      req.end();
    });
  }
}

interface NormalizedIncomingMessage {
  conversationId: string;
  messageId: string;
  externalId?: string;
  content: string;
  timestamp: Date;
  type: ChatMessageType;
  senderName?: string;
  attachments?: MessageAttachment[];
}

interface StatusUpdate {
  externalId: string;
  status: ChatMessageStatus;
}

function firstNonEmpty(...values: unknown[]): unknown {
  for (const value of values) {
    if (typeof value === 'string') {
      const trimmed = value.trim();
      if (trimmed) {
        return trimmed;
      }
      continue;
    }
    if (typeof value === 'number' && !Number.isNaN(value)) {
      return value;
    }
    if (value instanceof Date) {
      return value;
    }
  }
  return undefined;
}

function toArray<T>(value: unknown): T[] {
  if (!value) {
    return [];
  }
  if (Array.isArray(value)) {
    return value as T[];
  }
  return [value as T];
}

function normalizeTimestamp(value: unknown): Date {
  if (value instanceof Date) {
    return value;
  }
  if (typeof value === 'number') {
    if (value > 1e12) {
      return new Date(value);
    }
    return new Date(value * 1000);
  }
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!trimmed) {
      return new Date();
    }
    const numeric = Number(trimmed);
    if (!Number.isNaN(numeric)) {
      return normalizeTimestamp(numeric);
    }
    const parsed = new Date(trimmed);
    if (!Number.isNaN(parsed.getTime())) {
      return parsed;
    }
  }
  return new Date();
}

function normalizeMessageType(value: unknown, hasImageAttachment: boolean): ChatMessageType {
  if (value === 'image' || value === 'IMAGE') {
    return 'image';
  }
  return hasImageAttachment ? 'image' : 'text';
}

function normalizeStatus(value: unknown): ChatMessageStatus {
  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase();
    if (['read', 'seen', 'viewed'].includes(normalized)) {
      return 'read';
    }
    if (['delivered', 'arrived', 'received'].includes(normalized)) {
      return 'delivered';
    }
    return 'sent';
  }
  if (typeof value === 'number') {
    if (value >= 3) {
      return 'read';
    }
    if (value >= 2) {
      return 'delivered';
    }
    return 'sent';
  }
  return 'sent';
}

function collectAttachments(candidate: any, _type: ChatMessageType): MessageAttachment[] | undefined {
  const attachments: MessageAttachment[] = [];

  const attachmentArray = toArray<any>(candidate.attachments);
  for (const item of attachmentArray) {
    if (!item || typeof item !== 'object') {
      continue;
    }
    const urlCandidate = firstNonEmpty(item.url, item.link, item.href);
    if (!urlCandidate) {
      continue;
    }
    const nameCandidate = firstNonEmpty(item.name, item.filename, 'Arquivo');
    attachments.push({
      id: String(firstNonEmpty(item.id, `att-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`)),
      type: 'image',
      url: String(urlCandidate),
      name: String(nameCandidate),
    });
  }

  if (attachments.length > 0) {
    return attachments;
  }

  const directImageUrl = firstNonEmpty(
    candidate.imageUrl,
    candidate.mediaUrl,
    candidate.media?.url,
    candidate.image?.url,
    candidate.message?.imageMessage?.url,
    candidate._data?.mediaUrl,
  );

  if (directImageUrl) {
    attachments.push({
      id: String(firstNonEmpty(candidate.id, `att-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`)),
      type: 'image',
      url: String(directImageUrl),
      name: String(firstNonEmpty(candidate.fileName, candidate.file_name, 'Imagem')),
    });
  }

  return attachments.length > 0 ? attachments : undefined;
}

function parseIncomingMessage(candidate: any): NormalizedIncomingMessage | null {
  if (!candidate || typeof candidate !== 'object') {
    return null;
  }

  const fromMe = firstNonEmpty(
    (candidate.fromMe as unknown),
    candidate.from_me,
    candidate.isFromMe,
    candidate.key?.fromMe,
  );
  if (fromMe === true || fromMe === 'true') {
    return null;
  }

  const conversationIdCandidate = firstNonEmpty(
    candidate.conversationId,
    candidate.chatId,
    candidate.chat?.id,
    candidate.chat?.jid,
    candidate.from,
    candidate.remoteJid,
    candidate.author,
    candidate.key?.remoteJid,
    candidate._data?.from,
  );
  if (!conversationIdCandidate) {
    return null;
  }

  const messageIdCandidate = firstNonEmpty(
    candidate.id,
    candidate.messageId,
    candidate._id,
    candidate.key?.id,
    candidate.message?.key?.id,
  );

  const externalIdCandidate = firstNonEmpty(
    candidate.externalId,
    candidate.key?.id,
    candidate.messageId,
    candidate.id,
  );

  if (!messageIdCandidate && !externalIdCandidate) {
    return null;
  }

  const timestampCandidate = firstNonEmpty(
    candidate.timestamp,
    candidate.ts,
    candidate.sentAt,
    candidate.messageTimestamp,
    candidate._data?.t,
  );
  const timestamp = normalizeTimestamp(timestampCandidate);

  const contentCandidate = firstNonEmpty(
    typeof candidate.text === 'object' ? candidate.text?.body : candidate.text,
    candidate.body,
    candidate.message?.conversation,
    candidate.message?.text,
    candidate.message?.extendedTextMessage?.text,
    candidate._data?.body,
  );
  const rawContent = typeof contentCandidate === 'string' ? contentCandidate.trim() : '';

  const typeCandidate = firstNonEmpty(candidate.type, candidate.message?.type, candidate._data?.type);
  const attachments = collectAttachments(candidate, normalizeMessageType(typeCandidate, false));
  const type = normalizeMessageType(typeCandidate, Boolean(attachments && attachments.length > 0));

  const senderNameCandidate = firstNonEmpty(
    candidate.senderName,
    candidate.sender?.name,
    candidate.chat?.name,
    candidate.pushName,
    candidate.notifyName,
  );

  const content = rawContent || (attachments && attachments.length > 0 ? 'Arquivo recebido' : 'Mensagem recebida');

  return {
    conversationId: String(conversationIdCandidate),
    messageId: String(messageIdCandidate ?? externalIdCandidate ?? `waha-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`),
    externalId: externalIdCandidate ? String(externalIdCandidate) : undefined,
    content,
    timestamp,
    type,
    senderName: senderNameCandidate ? String(senderNameCandidate) : undefined,
    attachments,
  };
}

function collectMessageCandidates(payload: any): any[] {
  const results: any[] = [];
  if (!payload) {
    return results;
  }

  const push = (value: unknown) => {
    if (value && typeof value === 'object') {
      results.push(value);
    }
  };

  for (const item of toArray<any>(payload.messages)) {
    push(item);
  }

  if (payload.message) {
    push(payload.message);
  }

  if (payload.data) {
    if (Array.isArray(payload.data)) {
      for (const item of payload.data) {
        for (const message of toArray<any>(item?.messages)) {
          push(message);
        }
      }
    } else {
      for (const message of toArray<any>(payload.data.messages)) {
        push(message);
      }
    }
  }

  if (payload.event === 'message' && payload.data) {
    push(payload.data);
  }

  for (const entry of toArray<any>(payload.entry)) {
    for (const change of toArray<any>(entry?.changes)) {
      for (const message of toArray<any>(change?.value?.messages)) {
        push(message);
      }
    }
  }

  return results;
}

function normalizeWebhookMessages(payload: unknown): NormalizedIncomingMessage[] {
  const candidates = collectMessageCandidates(payload);
  const normalized: NormalizedIncomingMessage[] = [];
  for (const candidate of candidates) {
    const parsed = parseIncomingMessage(candidate);
    if (parsed) {
      normalized.push(parsed);
    }
  }
  return normalized;
}

function collectStatusCandidates(payload: any): any[] {
  const results: any[] = [];
  if (!payload) {
    return results;
  }

  const push = (value: unknown) => {
    if (value && typeof value === 'object') {
      results.push(value);
    }
  };

  for (const status of toArray<any>(payload.statuses)) {
    push(status);
  }

  if (payload.data) {
    if (Array.isArray(payload.data)) {
      for (const item of payload.data) {
        for (const status of toArray<any>(item?.statuses)) {
          push(status);
        }
      }
    } else {
      for (const status of toArray<any>(payload.data.statuses)) {
        push(status);
      }
    }
  }

  if (payload.event === 'status' && payload.data) {
    push(payload.data);
  }

  for (const entry of toArray<any>(payload.entry)) {
    for (const change of toArray<any>(entry?.changes)) {
      for (const status of toArray<any>(change?.value?.statuses)) {
        push(status);
      }
    }
  }

  return results;
}

function normalizeStatusUpdates(payload: unknown): StatusUpdate[] {
  const candidates = collectStatusCandidates(payload);
  const updates: StatusUpdate[] = [];
  for (const candidate of candidates) {
    if (!candidate || typeof candidate !== 'object') {
      continue;
    }
    const externalIdCandidate = firstNonEmpty(
      candidate.id,
      candidate.messageId,
      candidate.message_id,
      candidate.key?.id,
      candidate.status?.id,
    );
    if (!externalIdCandidate) {
      continue;
    }
    const statusCandidate = firstNonEmpty(
      candidate.status,
      candidate.state,
      candidate.ack,
      candidate.deliveryStatus,
    );
    updates.push({
      externalId: String(externalIdCandidate),
      status: normalizeStatus(statusCandidate),
    });
  }
  return updates;
}

function resolveChatId(conversation: ConversationDetails): string {
  const metadataChatId = (conversation.metadata?.chatId ?? conversation.metadata?.chat_id ?? conversation.metadata?.id) as
    | string
    | undefined;
  if (metadataChatId && metadataChatId.trim()) {
    return metadataChatId.trim();
  }
  return conversation.contactIdentifier || conversation.id;
}

function resolveMessagesEndpoint(baseUrl: string): string {
  const normalized = baseUrl.replace(/\/$/, '');
  if (normalized.toLowerCase().endsWith('/v1/messages')) {
    return normalized;
  }
  if (normalized.toLowerCase().endsWith('/v1')) {
    return `${normalized}/messages`;
  }
  return `${normalized}/v1/messages`;
}

function buildSendPayload(chatId: string, payload: SendMessageInput): Record<string, unknown> {
  const type: ChatMessageType = payload.type ?? 'text';
  const messagePayload: Record<string, unknown> = {
    type,
    text: payload.content,
  };

  if (type === 'image') {
    const attachment = payload.attachments?.[0];
    if (attachment) {
      messagePayload.image = {
        url: attachment.url,
        caption: payload.content || undefined,
        name: attachment.name,
      };
    }
  }

  if (payload.attachments && payload.attachments.length > 0) {
    messagePayload.attachments = payload.attachments;
  }

  return {
    chatId,
    type,
    text: payload.content,
    message: messagePayload,
  };
}

function extractMessageMetadata(data: unknown): { id?: string; timestamp?: Date } {
  if (!data || typeof data !== 'object') {
    return {};
  }
  const root = data as Record<string, unknown>;
  const messages = toArray<any>(root.messages);
  const candidate = messages[0] ?? root;
  const id = firstNonEmpty(candidate?.id, candidate?.messageId, candidate?.message_id, root.id);
  const timestampCandidate = firstNonEmpty(candidate?.timestamp, candidate?.ts, candidate?.sentAt, candidate?.messageTimestamp);
  const timestamp = timestampCandidate ? normalizeTimestamp(timestampCandidate) : undefined;
  return {
    id: id ? String(id) : undefined,
    timestamp,
  };
}

export default class WahaIntegrationService {
  constructor(
    private readonly chatService = new ChatService(),
    private readonly configService = new WahaConfigService(),
    private readonly httpClient = new HttpClient(),
  ) {}

  async sendMessage(conversationId: string, payload: SendMessageInput): Promise<ChatMessage> {
    const conversation = await this.chatService.getConversationDetails(conversationId);
    if (!conversation) {
      throw new ChatValidationError('Conversation not found');
    }

    let config;
    try {
      config = await this.configService.requireConfig();
    } catch (error) {
      if (error instanceof ConfigValidationError) {
        throw new IntegrationNotConfiguredError(error.message);
      }
      throw error;
    }

    const chatId = resolveChatId(conversation);
    const endpoint = resolveMessagesEndpoint(config.baseUrl);
    const requestBody = buildSendPayload(chatId, payload);

    const headers = {
      Authorization: `Bearer ${config.apiKey}`,
      'X-API-Key': config.apiKey,
    };

    const response = await this.httpClient.postJson(endpoint, requestBody, headers);
    if (response.status < 200 || response.status >= 300) {
      const message = typeof response.data === 'string'
        ? response.data
        : `WAHA request failed with status ${response.status}`;
      throw new Error(message);
    }

    const metadata = extractMessageMetadata(response.data);
    const timestamp = metadata.timestamp ?? new Date();

    return this.chatService.recordOutgoingMessage({
      id: metadata.id,
      externalId: metadata.id,
      conversationId,
      content: payload.content,
      type: payload.type ?? 'text',
      timestamp,
      attachments: payload.attachments ?? null,
    });
  }

  async handleWebhook(body: unknown, headers: IncomingHttpHeaders): Promise<void> {
    const config = await this.configService.getConfig();
    if (!config || !config.isActive) {
      throw new IntegrationNotConfiguredError();
    }

    if (config.webhookSecret) {
      const received = firstNonEmpty(
        headers['x-waha-signature'],
        headers['x-webhook-signature'],
        headers['x-webhook-secret'],
        headers['x-signature'],
      );
      if (!received || String(received) !== config.webhookSecret) {
        throw new WebhookAuthorizationError();
      }
    }

    const messages = normalizeWebhookMessages(body);
    for (const message of messages) {
      const conversation = await this.chatService.ensureConversation({
        id: message.conversationId,
        contactIdentifier: message.conversationId,
        contactName: message.senderName ?? message.conversationId,
        metadata: {
          provider: 'waha',
          chatId: message.conversationId,
        },
      });
      await this.chatService.recordIncomingMessage({
        id: message.messageId,
        externalId: message.externalId ?? message.messageId,
        conversationId: conversation.id,
        content: message.content,
        type: message.type,
        timestamp: message.timestamp,
        attachments: message.attachments ?? null,
      });
    }

    const statuses = normalizeStatusUpdates(body);
    for (const status of statuses) {
      await this.chatService.updateMessageStatusByExternalId(status.externalId, status.status);
    }
  }
}
