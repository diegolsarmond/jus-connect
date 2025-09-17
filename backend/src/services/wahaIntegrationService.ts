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
  sessionId?: string;
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

function parseIncomingMessage(candidate: any, inheritedSessionId?: string): NormalizedIncomingMessage | null {
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
    candidate.chat?.remoteJid,
    candidate.from,
    candidate.to,
    candidate.remoteJid,
    candidate.author,
    candidate.key?.remoteJid,
    candidate.key?.participant,
    candidate._data?.from,
    candidate._data?.remoteJid,
    candidate._data?.Info?.Chat,
  );
  if (!conversationIdCandidate) {
    return null;
  }

  const messageIdCandidate = firstNonEmpty(
    candidate.id,
    candidate.messageId,
    candidate.message_id,
    candidate._id,
    candidate.key?.id,
    candidate.message?.key?.id,
    candidate._data?.id,
    candidate._data?.key?.id,
    candidate._data?.Info?.ID,
    candidate.media?.Info?.ID,
  );

  const externalIdCandidate = firstNonEmpty(
    candidate.externalId,
    candidate.key?.id,
    candidate.messageId,
    candidate.message_id,
    candidate.id,
    candidate._data?.Info?.ID,
  );

  if (!messageIdCandidate && !externalIdCandidate) {
    return null;
  }

  const timestampCandidate = firstNonEmpty(
    candidate.timestamp,
    candidate.ts,
    candidate.sentAt,
    candidate.sent_at,
    candidate.messageTimestamp,
    candidate.message?.timestamp,
    candidate.message?.messageTimestamp,
    candidate._data?.t,
    candidate._data?.timestamp,
    candidate._data?.Info?.Timestamp,
    candidate._data?.Info?.MessageTimestamp,
  );
  const timestamp = normalizeTimestamp(timestampCandidate);

  const contentCandidate = firstNonEmpty(
    typeof candidate.text === 'object' ? candidate.text?.body : candidate.text,
    candidate.body,
    candidate.message?.conversation,
    candidate.message?.text,
    candidate.message?.extendedTextMessage?.text,
    candidate.message?.message?.conversation,
    candidate.message?.message?.extendedTextMessage?.text,
    candidate.caption,
    candidate._data?.body,
    candidate.media?.Message?.conversation,
  );
  const rawContent = typeof contentCandidate === 'string' ? contentCandidate.trim() : '';

  const typeCandidate = firstNonEmpty(
    candidate.type,
    candidate.message?.type,
    candidate._data?.type,
    candidate.media?.Info?.Type,
  );
  const attachments = collectAttachments(candidate, normalizeMessageType(typeCandidate, false));
  const type = normalizeMessageType(typeCandidate, Boolean(attachments && attachments.length > 0));

  const senderNameCandidate = firstNonEmpty(
    candidate.senderName,
    candidate.sender?.name,
    candidate.chat?.name,
    candidate.pushName,
    candidate.notifyName,
    candidate._data?.pushName,
    candidate._data?.notifyName,
  );

  const content = rawContent || (attachments && attachments.length > 0 ? 'Arquivo recebido' : 'Mensagem recebida');

  const sessionCandidate = firstNonEmpty(
    candidate.session,
    candidate.sessionId,
    candidate.session_id,
    candidate.metadata?.session,
    candidate.context?.session,
    candidate.me?.session,
    inheritedSessionId,
  );

  return {
    conversationId: String(conversationIdCandidate),
    messageId: String(messageIdCandidate ?? externalIdCandidate ?? `waha-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`),
    externalId: externalIdCandidate ? String(externalIdCandidate) : undefined,
    content,
    timestamp,
    type,
    senderName: senderNameCandidate ? String(senderNameCandidate) : undefined,
    attachments,
    sessionId: sessionCandidate ? String(sessionCandidate) : undefined,
  };
}

interface CandidateWrapper {
  node: any;
  sessionId?: string;
}

function collectCandidates(payload: any, predicate: (value: any) => boolean): CandidateWrapper[] {
  const results: CandidateWrapper[] = [];
  const visited = new Set<any>();

  const visit = (value: any, inheritedSession?: string) => {
    if (!value || typeof value !== 'object' || visited.has(value)) {
      return;
    }
    visited.add(value);

    const sessionCandidate = firstNonEmpty(
      value.session,
      value.payload?.session,
      value.data?.session,
      value.context?.session,
      inheritedSession,
    );
    const sessionId = sessionCandidate ? String(sessionCandidate) : inheritedSession;

    if (predicate(value)) {
      results.push({ node: value, sessionId });
    }

    const childSources: unknown[] = [value.payload, value.data, value.value, value.body];
    const arrayProps = ['messages', 'message', 'statuses', 'entries', 'entry', 'changes', 'items', 'events', 'records'];

    for (const prop of arrayProps) {
      const candidate = (value as Record<string, unknown>)[prop];
      for (const item of toArray<any>(candidate)) {
        if (item && typeof item === 'object') {
          visit(item, sessionId);
        }
      }
    }

    for (const child of childSources) {
      if (!child) {
        continue;
      }
      if (Array.isArray(child)) {
        for (const item of child) {
          if (item && typeof item === 'object') {
            visit(item, sessionId);
          }
        }
      } else if (typeof child === 'object') {
        visit(child, sessionId);
      }
    }
  };

  if (Array.isArray(payload)) {
    for (const item of payload) {
      visit(item);
    }
  } else {
    visit(payload);
  }

  return results;
}

function isMessageCandidate(value: any): boolean {
  if (!value || typeof value !== 'object') {
    return false;
  }
  return (
    typeof value.from !== 'undefined' ||
    typeof value.to !== 'undefined' ||
    typeof value.chatId !== 'undefined' ||
    typeof value.remoteJid !== 'undefined' ||
    typeof value.author !== 'undefined' ||
    typeof value.body === 'string' ||
    typeof value.text === 'string' ||
    typeof value.message === 'object' ||
    typeof value._data === 'object'
  );
}

function collectMessageCandidates(payload: any): CandidateWrapper[] {
  return collectCandidates(payload, isMessageCandidate);
}

function normalizeWebhookMessages(payload: unknown): NormalizedIncomingMessage[] {
  const candidates = collectMessageCandidates(payload);
  const normalized: NormalizedIncomingMessage[] = [];
  for (const candidate of candidates) {
    const parsed = parseIncomingMessage(candidate.node, candidate.sessionId);
    if (parsed) {
      normalized.push(parsed);
    }
  }
  return normalized;
}

function isStatusCandidate(value: any): boolean {
  if (!value || typeof value !== 'object') {
    return false;
  }
  if (
    typeof value.ack !== 'undefined' ||
    typeof value.status !== 'undefined' ||
    typeof value.state !== 'undefined' ||
    typeof value.deliveryStatus !== 'undefined'
  ) {
    return true;
  }
  if (typeof value.event === 'string') {
    const normalized = value.event.toLowerCase();
    return normalized.includes('status') || normalized.includes('ack');
  }
  return false;
}

function collectStatusCandidates(payload: any): CandidateWrapper[] {
  return collectCandidates(payload, isStatusCandidate);
}

function normalizeStatusUpdates(payload: unknown): StatusUpdate[] {
  const candidates = collectStatusCandidates(payload);
  const updates: StatusUpdate[] = [];
  for (const candidate of candidates) {
    const value = candidate.node;
    if (!value || typeof value !== 'object') {
      continue;
    }
    const externalIdCandidate = firstNonEmpty(
      value.id,
      value.messageId,
      value.message_id,
      value.key?.id,
      value.status?.id,
      value._data?.Info?.ID,
    );
    if (!externalIdCandidate) {
      continue;
    }
    const statusCandidate = firstNonEmpty(
      value.status,
      value.state,
      value.ack,
      value.deliveryStatus,
    );
    updates.push({
      externalId: String(externalIdCandidate),
      status: normalizeStatus(statusCandidate),
    });
  }
  return updates;
}

function resolveConversationContext(conversation: ConversationDetails): { chatId: string; sessionId: string } {
  const metadata = (conversation.metadata ?? {}) as Record<string, unknown>;
  const chatIdCandidate = firstNonEmpty(
    metadata.chatId,
    metadata.chat_id,
    metadata.id,
    metadata.remoteJid,
    metadata.contactIdentifier,
    conversation.contactIdentifier,
    conversation.id,
  );
  if (!chatIdCandidate || !String(chatIdCandidate).trim()) {
    throw new ChatValidationError('Conversation is missing WAHA chat identifier');
  }

  const sessionCandidate = firstNonEmpty(
    metadata.session,
    metadata.sessionId,
    metadata.session_id,
    metadata.wahaSession,
    metadata.integrationSession,
  );
  if (!sessionCandidate || !String(sessionCandidate).trim()) {
    throw new ChatValidationError('Conversation is missing WAHA session information');
  }

  return {
    chatId: String(chatIdCandidate).trim(),
    sessionId: String(sessionCandidate).trim(),
  };
}

function resolveSendTextEndpoint(baseUrl: string): string {
  const normalized = baseUrl.replace(/\/$/, '');
  const lower = normalized.toLowerCase();
  if (lower.endsWith('/api/sendtext') || lower.endsWith('/sendtext')) {
    return normalized;
  }
  if (lower.endsWith('/api')) {
    return `${normalized}/sendText`;
  }
  return `${normalized}/api/sendText`;
}

function buildSendTextPayload(chatId: string, sessionId: string, payload: SendMessageInput): Record<string, unknown> {
  return {
    chatId,
    session: sessionId,
    text: payload.content,
    linkPreview: true,
  };
}

function extractMessageMetadata(data: unknown): { id?: string; timestamp?: Date } {
  if (!data || typeof data !== 'object') {
    return {};
  }
  const root = data as Record<string, unknown>;
  const messages = toArray<any>(root.messages);
  const candidate = messages[0] ?? root;
  const id = firstNonEmpty(
    candidate?.id,
    candidate?.messageId,
    candidate?.message_id,
    candidate?._data?.Info?.ID,
    root.id,
  );
  const timestampCandidate = firstNonEmpty(
    candidate?.timestamp,
    candidate?.ts,
    candidate?.sentAt,
    candidate?.messageTimestamp,
    candidate?._data?.Info?.Timestamp,
  );
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

    const { chatId, sessionId } = resolveConversationContext(conversation);

    if (payload.attachments && payload.attachments.length > 0) {
      throw new ChatValidationError('WAHA sendText endpoint does not support attachments');
    }
    if (payload.type && payload.type !== 'text') {
      throw new ChatValidationError('Only text messages are supported by the WAHA integration');
    }

    const endpoint = resolveSendTextEndpoint(config.baseUrl);
    const requestBody = buildSendTextPayload(chatId, sessionId, payload);

    const headers = {
      Authorization: `Bearer ${config.apiKey}`,
      'X-Api-Key': config.apiKey,
      Accept: 'application/json',
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
      const metadata: Record<string, unknown> = {
        provider: 'waha',
        chatId: message.conversationId,
      };
      if (message.sessionId) {
        metadata.session = message.sessionId;
      }
      const conversation = await this.chatService.ensureConversation({
        id: message.conversationId,
        contactIdentifier: message.conversationId,
        contactName: message.senderName ?? message.conversationId,
        metadata,
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
