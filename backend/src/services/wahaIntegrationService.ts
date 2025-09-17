import http from 'http';
import https from 'https';
import { IncomingHttpHeaders } from 'http';
import { URL } from 'url';
import ChatService, {
  ChatMessage,
  ChatMessageStatus,
  ChatMessageType,
  ConversationDetails,
  ConversationSummary,
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

interface NormalizedWahaLastMessage {
  id: string;
  content: string;
  timestamp: Date;
  sender: 'me' | 'contact';
  type: ChatMessageType;
  status: ChatMessageStatus;
}

interface NormalizedWahaChat {
  id: string;
  name?: string;
  avatar?: string;
  shortStatus?: string;
  description?: string;
  unreadCount?: number;
  lastMessage?: NormalizedWahaLastMessage;
  sessionId: string;
}

function normalizeChatLimit(limit?: number): number {
  if (typeof limit !== 'number' || Number.isNaN(limit) || limit <= 0) {
    return 30;
  }
  const normalized = Math.floor(limit);
  if (normalized < 1) {
    return 1;
  }
  if (normalized > 200) {
    return 200;
  }
  return normalized;
}

function resolveChatsEndpoint(baseUrl: string, sessionId: string, limit: number): string {
  const normalized = baseUrl.replace(/\/$/, '');
  const encodedSession = encodeURIComponent(sessionId);
  const endpoint = `${normalized}/api/${encodedSession}/chats`;
  const separator = endpoint.includes('?') ? '&' : '?';
  return `${endpoint}${separator}limit=${limit}`;
}

function resolveSessionsEndpoint(baseUrl: string): string {
  const normalized = baseUrl.replace(/\/$/, '');
  return `${normalized}/api/sessions`;
}

function parseSessionIdentifiers(payload: unknown): string[] {
  const identifiers: string[] = [];
  const seen = new Set<string>();

  const pushValue = (value: unknown) => {
    if (value === undefined || value === null) {
      return;
    }
    if (typeof value === 'string') {
      const trimmed = value.trim();
      if (trimmed && !seen.has(trimmed)) {
        seen.add(trimmed);
        identifiers.push(trimmed);
      }
      return;
    }
    if (typeof value === 'number' && !Number.isNaN(value)) {
      const normalized = String(value);
      if (!seen.has(normalized)) {
        seen.add(normalized);
        identifiers.push(normalized);
      }
      return;
    }
    if (typeof value === 'object') {
      const candidate = firstNonEmpty(
        (value as Record<string, unknown>).id,
        (value as Record<string, unknown>).session,
        (value as Record<string, unknown>).sessionId,
        (value as Record<string, unknown>).session_id,
        (value as Record<string, unknown>).name,
      );
      if (candidate && String(candidate).trim()) {
        const normalized = String(candidate).trim();
        if (!seen.has(normalized)) {
          seen.add(normalized);
          identifiers.push(normalized);
        }
      }
    }
  };

  const visit = (value: unknown) => {
    if (Array.isArray(value)) {
      for (const item of value) {
        visit(item);
      }
      return;
    }
    pushValue(value);
  };

  if (Array.isArray(payload)) {
    visit(payload);
  } else if (payload && typeof payload === 'object') {
    const container = payload as Record<string, unknown>;
    const candidates = [container.data, container.sessions, container.result, container.items, container.payload];
    for (const candidate of candidates) {
      if (candidate !== undefined) {
        visit(candidate);
      }
    }
    if (identifiers.length === 0) {
      for (const value of Object.values(container)) {
        if (Array.isArray(value)) {
          visit(value);
        }
      }
    }
  } else {
    pushValue(payload);
  }

  return identifiers;
}

function extractWahaChatArray(payload: unknown): unknown[] {
  if (!payload) {
    return [];
  }
  if (Array.isArray(payload)) {
    return payload;
  }
  if (typeof payload === 'object') {
    const container = payload as Record<string, unknown>;
    const candidates = [container.data, container.chats, container.items, container.result, container.payload];
    for (const candidate of candidates) {
      if (Array.isArray(candidate)) {
        return candidate;
      }
    }
  }
  return [];
}

function parseWahaLastMessage(value: unknown): NormalizedWahaLastMessage | undefined {
  if (!value || typeof value !== 'object') {
    return undefined;
  }
  const candidate = value as Record<string, any>;

  const contentCandidate = firstNonEmpty(
    candidate.body,
    candidate.message,
    candidate.text,
    candidate.caption,
    candidate.content,
    candidate.conversation,
    candidate.displayText,
  );
  if (!contentCandidate || !String(contentCandidate).trim()) {
    return undefined;
  }

  const idCandidate = firstNonEmpty(
    candidate.id?.id,
    candidate.id?._serialized,
    candidate.id,
    candidate.messageId,
    candidate.message_id,
    candidate.key?.id,
    candidate.key?._serialized,
  );

  const timestampCandidate = firstNonEmpty(
    candidate.timestamp,
    candidate.messageTimestamp,
    candidate.time,
    candidate.t,
    candidate.sendTimestamp,
    candidate.serverTimestamp,
    candidate.Info?.Timestamp,
  );
  const timestamp = normalizeTimestamp(timestampCandidate);

  const fromMeCandidate = firstNonEmpty(
    candidate.fromMe,
    candidate.key?.fromMe,
    candidate.isFromMe,
    candidate.from_me,
  );
  const sender: 'me' | 'contact' = fromMeCandidate === true || String(fromMeCandidate).toLowerCase() === 'true'
    ? 'me'
    : 'contact';

  const typeCandidate = firstNonEmpty(candidate.type, candidate.messageType);
  const type = normalizeMessageType(typeCandidate, false);

  const statusCandidate = firstNonEmpty(candidate.ack, candidate.ackName, candidate.status);
  let status: ChatMessageStatus = 'sent';
  if (typeof statusCandidate === 'number') {
    if (statusCandidate >= 3) {
      status = 'read';
    } else if (statusCandidate >= 2) {
      status = 'delivered';
    }
  } else if (typeof statusCandidate === 'string') {
    const normalized = statusCandidate.trim().toLowerCase();
    if (['read', 'seen', 'viewed'].includes(normalized)) {
      status = 'read';
    } else if (['delivered', 'device', 'server', 'arrived'].includes(normalized)) {
      status = 'delivered';
    }
  }

  const id = idCandidate && String(idCandidate).trim() ? String(idCandidate).trim() : `msg-${timestamp.getTime()}`;

  return {
    id,
    content: String(contentCandidate),
    timestamp,
    sender,
    type,
    status,
  };
}

function normalizeWahaChat(value: unknown, sessionId: string): NormalizedWahaChat | null {
  if (!value || typeof value !== 'object') {
    return null;
  }
  const candidate = value as Record<string, any>;

  const idCandidate = firstNonEmpty(
    candidate.id,
    candidate.chatId,
    candidate.chat_id,
    candidate.jid,
    candidate.remoteJid,
    candidate.wid,
    candidate.user,
  );
  if (!idCandidate || !String(idCandidate).trim()) {
    return null;
  }
  const id = String(idCandidate).trim();

  const nameCandidate = firstNonEmpty(
    candidate.name,
    candidate.pushName,
    candidate.contactName,
    candidate.displayName,
    candidate.formattedName,
    candidate.formattedTitle,
    candidate.shortName,
  );
  const avatarCandidate = firstNonEmpty(
    candidate.avatar,
    candidate.picture,
    candidate.pictureUrl,
    candidate.profilePicUrl,
    candidate.profilePicThumbObj?.eurl,
  );
  const shortStatusCandidate = firstNonEmpty(
    candidate.shortStatus,
    candidate.status,
    candidate.state,
  );
  const descriptionCandidate = firstNonEmpty(
    candidate.description,
    candidate.about,
    candidate.bio,
  );
  const unreadCandidate = firstNonEmpty(
    candidate.unreadCount,
    candidate.unread,
    candidate.unreadMessages,
    candidate.unread_messages,
  );

  let unreadCount: number | undefined;
  if (typeof unreadCandidate === 'number' && !Number.isNaN(unreadCandidate)) {
    unreadCount = unreadCandidate;
  } else if (typeof unreadCandidate === 'string' && unreadCandidate.trim()) {
    const parsed = Number.parseInt(unreadCandidate, 10);
    if (!Number.isNaN(parsed)) {
      unreadCount = parsed;
    }
  }

  const messages = Array.isArray(candidate.messages) && candidate.messages.length > 0
    ? candidate.messages[candidate.messages.length - 1]
    : undefined;
  const lastMessageCandidate = firstNonEmpty(
    candidate.lastMessage,
    candidate.last_message,
    candidate.last_message_received,
    messages,
  );
  const lastMessage = parseWahaLastMessage(lastMessageCandidate);

  return {
    id,
    name: nameCandidate && String(nameCandidate).trim() ? String(nameCandidate).trim() : undefined,
    avatar: avatarCandidate && String(avatarCandidate).trim() ? String(avatarCandidate).trim() : undefined,
    shortStatus: shortStatusCandidate && String(shortStatusCandidate).trim()
      ? String(shortStatusCandidate).trim()
      : undefined,
    description: descriptionCandidate && String(descriptionCandidate).trim()
      ? String(descriptionCandidate).trim()
      : undefined,
    unreadCount,
    lastMessage,
    sessionId,
  };
}

function buildLastMessagePreview(content: string, type: ChatMessageType): string {
  if (type === 'image') {
    return 'Imagem recebida';
  }
  const trimmed = content.trim();
  if (!trimmed) {
    return 'Mensagem';
  }
  if (trimmed.length > 160) {
    return `${trimmed.slice(0, 159)}…`;
  }
  return trimmed;
}

function toConversationSummary(conversation: ConversationDetails): ConversationSummary {
  return {
    id: conversation.id,
    name: conversation.name,
    avatar: conversation.avatar,
    shortStatus: conversation.shortStatus,
    description: conversation.description,
    unreadCount: conversation.unreadCount,
    pinned: conversation.pinned,
    lastMessage: conversation.lastMessage,
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
    private readonly chatService: ChatService = new ChatService(),
    private readonly configService: WahaConfigService = new WahaConfigService(),
    private readonly httpClient: HttpClient = new HttpClient(),
  ) {}

  private async determineSessionIds(
    sessionId: string | undefined,
    headers: Record<string, string>,
    baseUrl: string,
  ): Promise<string[]> {
    if (sessionId && sessionId.trim()) {
      return [sessionId.trim()];
    }

    const knownSessions = await this.chatService.listKnownSessions();
    if (knownSessions.length > 0) {
      return knownSessions;
    }

    const response = await this.httpClient.request(resolveSessionsEndpoint(baseUrl), { headers });
    if (response.status >= 200 && response.status < 300) {
      const remoteSessions = parseSessionIdentifiers(response.data);
      if (remoteSessions.length > 0) {
        return remoteSessions;
      }
    }

    throw new ChatValidationError('No WAHA session available to list conversations');
  }

  async listChats(options: { sessionId?: string; limit?: number } = {}): Promise<ConversationSummary[]> {
    let config;
    try {
      config = await this.configService.requireConfig();
    } catch (error) {
      if (error instanceof ConfigValidationError) {
        throw new IntegrationNotConfiguredError(error.message);
      }
      throw error;
    }

    const limit = normalizeChatLimit(options.limit);
    const headers = {
      Authorization: `Bearer ${config.apiKey}`,
      'X-Api-Key': config.apiKey,
      Accept: 'application/json',
    };

    const sessionIds = await this.determineSessionIds(options.sessionId, headers, config.baseUrl);

    const conversations = new Map<string, ConversationSummary>();
    const order: string[] = [];

    for (const sessionId of sessionIds) {
      const endpoint = resolveChatsEndpoint(config.baseUrl, sessionId, limit);
      const response = await this.httpClient.request(endpoint, { headers });
      if (response.status < 200 || response.status >= 300) {
        const message = typeof response.data === 'string'
          ? response.data
          : `WAHA chat list failed with status ${response.status}`;
        throw new Error(message);
      }

      const chats = extractWahaChatArray(response.data)
        .map((item) => normalizeWahaChat(item, sessionId))
        .filter((item): item is NormalizedWahaChat => item !== null);

      for (const chat of chats) {
        const conversation = await this.chatService.ensureConversation({
          id: chat.id,
          contactIdentifier: chat.id,
          contactName: chat.name ?? chat.id,
          avatar: chat.avatar,
          shortStatus: chat.shortStatus,
          description: chat.description,
          metadata: {
            provider: 'waha',
            chatId: chat.id,
            session: chat.sessionId,
          },
        });

        const summary = toConversationSummary(conversation);

        if (chat.name) {
          summary.name = chat.name;
        }
        if (chat.avatar) {
          summary.avatar = chat.avatar;
        }
        if (chat.shortStatus) {
          summary.shortStatus = chat.shortStatus;
        }
        if (chat.description) {
          summary.description = chat.description;
        }
        if (typeof chat.unreadCount === 'number') {
          summary.unreadCount = chat.unreadCount;
        }
        if (chat.lastMessage) {
          summary.lastMessage = {
            id: chat.lastMessage.id,
            content: chat.lastMessage.content,
            preview: buildLastMessagePreview(chat.lastMessage.content, chat.lastMessage.type),
            timestamp: chat.lastMessage.timestamp.toISOString(),
            sender: chat.lastMessage.sender,
            type: chat.lastMessage.type,
            status: chat.lastMessage.status,
          };
        }

        if (!conversations.has(summary.id)) {
          order.push(summary.id);
        }
        conversations.set(summary.id, summary);
      }
    }

    return order.map((id) => conversations.get(id)!);
  }

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

  }
}
