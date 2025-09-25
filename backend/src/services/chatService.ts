import { QueryResultRow } from 'pg';
import pool from './db';
import { ensureChatSchema } from './chatSchema';

export type ChatMessageSender = 'me' | 'contact';
export type ChatMessageStatus = 'sent' | 'delivered' | 'read';
export type ChatMessageType = 'text' | 'image' | 'audio';

export interface MessageAttachment {
  id: string;
  type: 'image' | 'audio';
  url: string;
  name: string;
}

export interface ChatMessage {
  id: string;
  conversationId: string;
  sender: ChatMessageSender;
  content: string;
  timestamp: string;
  status: ChatMessageStatus;
  type: ChatMessageType;
  attachments?: MessageAttachment[];
}

export interface ConversationLastMessage {
  id: string;
  content: string;
  preview: string;
  timestamp: string;
  sender: ChatMessageSender;
  type: ChatMessageType;
  status: ChatMessageStatus;
}

export interface ConversationSummary {
  id: string;
  name: string;
  avatar: string;
  shortStatus: string;
  description?: string;
  unreadCount: number;
  pinned?: boolean;
  lastMessage?: ConversationLastMessage;
  phoneNumber?: string;
  responsible?: ConversationResponsible | null;
  tags?: string[];
  isLinkedToClient?: boolean;
  clientId?: number | null;
  clientName?: string | null;
  customAttributes?: ConversationCustomAttribute[];
  isPrivate?: boolean;
  internalNotes?: ConversationInternalNote[];
}

export interface ConversationDetails extends ConversationSummary {
  contactIdentifier: string;
  metadata?: Record<string, unknown> | null;
  createdAt: string;
  updatedAt: string;
}

export interface ConversationResponsible {
  id: string;
  name: string;
  role?: string;
  avatar?: string;
}

export interface ConversationCustomAttribute {
  id: string;
  label: string;
  value: string;
}

export interface ConversationInternalNote {
  id: string;
  author: string;
  content: string;
  createdAt: string;
}

export interface MessageStatusRecord {
  conversationId: string;
  messageId: string;
  status: ChatMessageStatus;
}

export interface MessagePage {
  messages: ChatMessage[];
  nextCursor: string | null;
}

export interface CreateConversationInput {
  id?: string;
  contactIdentifier: string;
  contactName?: string | null;
  description?: string | null;
  shortStatus?: string | null;
  avatar?: string | null;
  pinned?: boolean;
  metadata?: Record<string, unknown> | null;
}

export interface RecordMessageInput {
  id?: string;
  conversationId: string;
  externalId?: string | null;
  sender: ChatMessageSender;
  content: string;
  type?: ChatMessageType;
  status?: ChatMessageStatus;
  timestamp?: Date | string;
  attachments?: MessageAttachment[] | null;
}

export interface SendMessageInput {
  content: string;
  type?: ChatMessageType;
  attachments?: MessageAttachment[];
}

export interface UpdateConversationInput {
  responsibleId?: number | null;
  tags?: string[];
  phoneNumber?: string | null;
  isLinkedToClient?: boolean;
  clientId?: number | null;
  clientName?: string | null;
  customAttributes?: ConversationCustomAttribute[];
  isPrivate?: boolean;
  internalNotes?: ConversationInternalNote[];
}

export class ValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ValidationError';
  }
}

type Queryable = {
  query: (
    text: string,
    params?: unknown[],
  ) => Promise<{ rows: QueryResultRow[]; rowCount: number }>;
};

interface ConversationRow extends QueryResultRow {
  id: string;
  contact_identifier: string;
  contact_name: string | null;
  contact_avatar: string | null;
  short_status: string | null;
  description: string | null;
  pinned: boolean;
  phone_number: string | null;
  responsible_id: number | null;
  responsible_snapshot: unknown;
  tags: unknown;
  client_id: number | string | null;
  client_name: string | null;
  is_linked_to_client: boolean | null;
  custom_attributes: unknown;
  is_private: boolean | null;
  internal_notes: unknown;
  unread_count: number;
  last_message_id: string | null;
  last_message_preview: string | null;
  last_message_timestamp: string | Date | null;
  last_message_sender: string | null;
  last_message_type: string | null;
  last_message_status: string | null;
  metadata: Record<string, unknown> | null;
  created_at: string | Date;
  updated_at: string | Date;
}

interface MessageRow extends QueryResultRow {
  id: string;
  conversation_id: string;
  external_id: string | null;
  sender: string;
  content: string;
  message_type: string;
  status: string;
  timestamp: string | Date;
  attachments: unknown;
  created_at: string | Date;
}

interface SessionRow extends QueryResultRow {
  session_id: string | null;
}

const DEFAULT_SHORT_STATUS = 'Disponível';
const DEFAULT_PAGE_SIZE = 20;
const MAX_PAGE_SIZE = 100;

function formatDate(value: string | Date | null | undefined): string {
  if (!value) {
    return new Date().toISOString();
  }
  if (value instanceof Date) {
    return value.toISOString();
  }
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return new Date().toISOString();
  }
  return parsed.toISOString();
}

function normalizeSender(value: string | null | undefined): ChatMessageSender {
  return value === 'me' ? 'me' : 'contact';
}

function normalizeStatus(value: string | null | undefined): ChatMessageStatus {
  if (value === 'delivered' || value === 'read') {
    return value;
  }
  return 'sent';
}

function normalizeMessageType(value: string | null | undefined): ChatMessageType {
  if (value === 'image' || value === 'audio') {
    return value;
  }
  return 'text';
}

const sanitizeAttachment = (value: unknown): MessageAttachment | null => {
  if (!value || typeof value !== 'object') {
    return null;
  }

  const attachment = value as {
    id?: unknown;
    url?: unknown;
    name?: unknown;
    type?: unknown;
  };

  const id = typeof attachment.id === 'string' ? attachment.id : undefined;
  const url = typeof attachment.url === 'string' ? attachment.url : undefined;
  const name = typeof attachment.name === 'string' ? attachment.name : undefined;
  const type = attachment.type === 'audio' ? 'audio' : 'image';

  if (!id || !url || !name) {
    return null;
  }

  return { id, url, name, type };
};

function parseAttachments(value: unknown): MessageAttachment[] | undefined {
  if (!value) {
    return undefined;
  }
  if (Array.isArray(value)) {
    return value
      .map(sanitizeAttachment)
      .filter((item): item is MessageAttachment => item !== null);
  }
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value);
      return Array.isArray(parsed)
        ? parsed
            .map(sanitizeAttachment)
            .filter((item): item is MessageAttachment => item !== null)
        : undefined;
    } catch (error) {
      return undefined;
    }
  }
  if (typeof value === 'object') {
    const parsed = value as { attachments?: unknown };
    if (Array.isArray(parsed.attachments)) {
      return parsed.attachments
        .map(sanitizeAttachment)
        .filter((item): item is MessageAttachment => item !== null);
    }
  }
  return undefined;
}

function truncate(value: string, length = 160): string {
  if (value.length <= length) {
    return value;
  }
  return `${value.slice(0, length - 1)}…`;
}

function buildPreview(
  content: string,
  type: ChatMessageType,
  attachments?: MessageAttachment[] | null,
): string {
  if (type === 'image') {
    const name = attachments && attachments.length > 0 ? attachments[0]!.name : undefined;
    return name ? `Imagem • ${name}` : 'Imagem recebida';
  }
  if (type === 'audio') {
    const name = attachments && attachments.length > 0 ? attachments[0]!.name : undefined;
    return name ? `Mensagem de áudio • ${name}` : 'Mensagem de áudio';
  }
  const normalized = content.trim();
  if (!normalized) {
    return 'Mensagem';
  }
  return truncate(normalized);
}

function getConversationName(row: ConversationRow): string {
  if (row.contact_name && row.contact_name.trim()) {
    return row.contact_name.trim();
  }
  if (row.contact_identifier && row.contact_identifier.trim()) {
    return row.contact_identifier.trim();
  }
  return row.id;
}

function buildAvatar(name: string): string {
  const initial = name.trim().charAt(0).toUpperCase() || 'C';
  const svg = [
    "<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 64 64'>",
    "<rect width='64' height='64' rx='8' fill='%234F46E5' />",
    `<text x='50%' y='50%' dominant-baseline='central' text-anchor='middle' font-family='Inter,Arial,sans-serif' font-size='32' fill='white'>${initial}</text>`,
    '</svg>',
  ].join('');
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

function parseJsonValue<T>(value: unknown): T | null {
  if (!value) {
    return null;
  }

  if (typeof value === 'string') {
    if (!value.trim()) {
      return null;
    }

    try {
      const parsed = JSON.parse(value);
      if (parsed && typeof parsed === 'object') {
        return parsed as T;
      }
      return null;
    } catch (error) {
      return null;
    }
  }

  if (typeof value === 'object') {
    return value as T;
  }

  return null;
}

function parseJsonArray(value: unknown): unknown[] {
  if (!value) {
    return [];
  }

  if (Array.isArray(value)) {
    return value;
  }

  const parsed = parseJsonValue<unknown[]>(value);
  return Array.isArray(parsed) ? parsed : [];
}

function parseStringArray(value: unknown): string[] {
  const array = parseJsonArray(value);
  const seen = new Set<string>();
  const result: string[] = [];

  for (const item of array) {
    if (typeof item !== 'string') {
      continue;
    }
    const trimmed = item.trim();
    if (!trimmed) {
      continue;
    }
    const key = trimmed.toLowerCase();
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    result.push(trimmed);
  }

  return result;
}

function parseCustomAttributes(value: unknown): ConversationCustomAttribute[] {
  const array = parseJsonArray(value);
  const seen = new Set<string>();
  const result: ConversationCustomAttribute[] = [];

  for (const item of array) {
    if (!item || typeof item !== 'object') {
      continue;
    }
    const entry = item as { id?: unknown; label?: unknown; value?: unknown };
    const id = typeof entry.id === 'string' ? entry.id.trim() : '';
    const label = typeof entry.label === 'string' ? entry.label.trim() : '';
    const entryValue = typeof entry.value === 'string' ? entry.value.trim() : '';

    if (!id || !label || !entryValue || seen.has(id)) {
      continue;
    }

    seen.add(id);
    result.push({ id, label, value: entryValue });
  }

  return result;
}

function ensureIsoString(value: string | Date | null | undefined): string {
  if (!value) {
    return new Date().toISOString();
  }

  if (value instanceof Date) {
    return value.toISOString();
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return new Date().toISOString();
  }

  return parsed.toISOString();
}

function parseInternalNotes(value: unknown): ConversationInternalNote[] {
  const array = parseJsonArray(value);
  const seen = new Set<string>();
  const result: ConversationInternalNote[] = [];

  for (const item of array) {
    if (!item || typeof item !== 'object') {
      continue;
    }

    const entry = item as { id?: unknown; author?: unknown; content?: unknown; createdAt?: unknown };
    const id = typeof entry.id === 'string' ? entry.id.trim() : '';
    const author = typeof entry.author === 'string' ? entry.author.trim() : '';
    const content = typeof entry.content === 'string' ? entry.content.trim() : '';
    const createdAtValue = entry.createdAt;

    if (!id || !author || !content || seen.has(id)) {
      continue;
    }

    const createdAt = ensureIsoString(
      typeof createdAtValue === 'string' || createdAtValue instanceof Date ? createdAtValue : undefined,
    );

    seen.add(id);
    result.push({ id, author, content, createdAt });
  }

  return result.sort((a, b) => a.createdAt.localeCompare(b.createdAt));
}

type ResponsibleSnapshot = {
  id?: unknown;
  name?: unknown;
  role?: unknown;
  avatar?: unknown;
} | null;

function parseResponsibleSnapshot(value: unknown): ResponsibleSnapshot {
  if (!value) {
    return null;
  }

  if (typeof value === 'string') {
    if (!value.trim()) {
      return null;
    }
    try {
      const parsed = JSON.parse(value);
      if (parsed && typeof parsed === 'object') {
        return parsed as ResponsibleSnapshot;
      }
      return null;
    } catch (error) {
      return null;
    }
  }

  if (typeof value === 'object') {
    return value as ResponsibleSnapshot;
  }

  return null;
}

function mapResponsible(row: ConversationRow): ConversationResponsible | null {
  const snapshot = parseResponsibleSnapshot(row.responsible_snapshot);

  const rawId =
    typeof snapshot?.id === 'string' && snapshot.id.trim()
      ? snapshot.id.trim()
      : typeof snapshot?.id === 'number'
        ? String(snapshot.id)
        : row.responsible_id !== null && row.responsible_id !== undefined
          ? String(row.responsible_id)
          : null;

  if (!rawId) {
    return null;
  }

  const name =
    typeof snapshot?.name === 'string' && snapshot.name.trim()
      ? snapshot.name.trim()
      : `Usuário ${rawId}`;

  const role =
    typeof snapshot?.role === 'string' && snapshot.role.trim()
      ? snapshot.role.trim()
      : undefined;

  const avatar =
    typeof snapshot?.avatar === 'string' && snapshot.avatar.trim()
      ? snapshot.avatar
      : buildAvatar(name);

  return {
    id: rawId,
    name,
    role,
    avatar,
  };
}

function mapConversation(row: ConversationRow): ConversationDetails {
  const name = getConversationName(row);
  const avatar = row.contact_avatar && row.contact_avatar.trim()
    ? row.contact_avatar
    : buildAvatar(name);
  const lastMessage = row.last_message_id
    ? {
        id: row.last_message_id,
        content: row.last_message_preview ?? '',
        preview: row.last_message_preview ?? '',
        timestamp: formatDate(row.last_message_timestamp),
        sender: normalizeSender(row.last_message_sender),
        type: normalizeMessageType(row.last_message_type),
        status: normalizeStatus(row.last_message_status),
      }
    : undefined;
  const tags = parseStringArray(row.tags).sort((a, b) => a.localeCompare(b, 'pt-BR'));
  const customAttributes = parseCustomAttributes(row.custom_attributes);
  const internalNotes = parseInternalNotes(row.internal_notes);
  let clientId: number | null = null;
  if (typeof row.client_id === 'number' && Number.isFinite(row.client_id)) {
    clientId = row.client_id;
  } else if (typeof row.client_id === 'string' && row.client_id.trim()) {
    const parsed = Number.parseInt(row.client_id, 10);
    if (Number.isFinite(parsed)) {
      clientId = parsed;
    }
  }
  const clientName =
    typeof row.client_name === 'string' && row.client_name.trim() ? row.client_name.trim() : null;
  const phoneNumber =
    typeof row.phone_number === 'string' && row.phone_number.trim() ? row.phone_number.trim() : undefined;
  const isLinkedToClient = row.is_linked_to_client === true || clientId !== null;
  const isPrivate = row.is_private === true;
  const responsible = mapResponsible(row);

  return {
    id: row.id,
    name,
    avatar,
    shortStatus: row.short_status?.trim() || DEFAULT_SHORT_STATUS,
    description: row.description?.trim() || undefined,
    unreadCount: typeof row.unread_count === 'number' ? row.unread_count : 0,
    pinned: row.pinned ?? false,
    lastMessage,
    phoneNumber,
    responsible,
    tags,
    isLinkedToClient,
    clientId,
    clientName,
    customAttributes,
    isPrivate,
    internalNotes,
    contactIdentifier: row.contact_identifier,
    metadata: row.metadata ?? null,
    createdAt: formatDate(row.created_at),
    updatedAt: formatDate(row.updated_at),
  };
}

function mapMessage(row: MessageRow): ChatMessage {
  return {
    id: row.id,
    conversationId: row.conversation_id,
    sender: normalizeSender(row.sender),
    content: row.content,
    timestamp: formatDate(row.timestamp),
    status: normalizeStatus(row.status),
    type: normalizeMessageType(row.message_type),
    attachments: parseAttachments(row.attachments),
  };
}

function normalizeConversationId(id: string | undefined, fallback: string): string {
  const value = (id ?? fallback).trim();
  if (!value) {
    throw new ValidationError('Conversation id cannot be empty');
  }
  return value;
}

function normalizeContactIdentifier(value: string | undefined): string {
  if (typeof value !== 'string') {
    throw new ValidationError('contactIdentifier is required');
  }
  const trimmed = value.trim();
  if (!trimmed) {
    throw new ValidationError('contactIdentifier is required');
  }
  return trimmed;
}

function normalizeContactName(value: string | null | undefined, _fallback: string): string | null {
  if (value === null) {
    return null;
  }
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (trimmed) {
      return trimmed;
    }
  }
  return null;
}

function normalizeMetadata(value: Record<string, unknown> | null | undefined): Record<string, unknown> | null {
  if (!value) {
    return null;
  }
  return value;
}

function normalizeBoolean(value: unknown, defaultValue: boolean): boolean {
  if (typeof value === 'boolean') {
    return value;
  }
  return defaultValue;
}

function normalizeMessageContent(value: string | undefined): string {
  if (typeof value !== 'string') {
    throw new ValidationError('Message content is required');
  }
  const trimmed = value.trim();
  if (!trimmed) {
    throw new ValidationError('Message content is required');
  }
  return trimmed;
}

function normalizeTimestamp(value: Date | string | undefined): Date {
  if (value instanceof Date) {
    return value;
  }
  if (typeof value === 'string' && value.trim()) {
    const parsed = new Date(value);
    if (!Number.isNaN(parsed.getTime())) {
      return parsed;
    }
  }
  return new Date();
}

function normalizeAttachments(value: MessageAttachment[] | null | undefined): MessageAttachment[] | null {
  if (!value) {
    return null;
  }
  const normalized = value
    .map(sanitizeAttachment)
    .filter((attachment): attachment is MessageAttachment => attachment !== null);
  return normalized.length > 0 ? normalized : null;
}

function normalizeMessageId(id: string | undefined, externalId: string | null | undefined): string {
  if (typeof id === 'string' && id.trim()) {
    return id.trim();
  }
  if (typeof externalId === 'string' && externalId.trim()) {
    return externalId.trim();
  }
  return `msg-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function computeNextCursor(messages: ChatMessage[]): string | null {
  if (messages.length === 0) {
    return null;
  }
  return messages[0]!.timestamp;
}

export default class ChatService {
  private readonly schemaReady: Promise<void>;

  constructor(
    private readonly db: Queryable = pool,
    schemaInitializer: (client: Queryable) => Promise<void> = ensureChatSchema,
  ) {
    this.schemaReady = schemaInitializer(this.db);
  }

  private async query(text: string, params?: unknown[]) {
    await this.schemaReady;
    return this.db.query(text, params);
  }

  private async loadResponsibleSnapshot(userId: number): Promise<{
    id: number;
    name: string;
    role?: string;
    avatar: string;
  } | null> {
    const result = await this.query(
      'SELECT id, nome_completo, perfil FROM public.vw_usuarios WHERE id = $1',
      [userId],
    );

    if (result.rowCount === 0) {
      return null;
    }

    const row = result.rows[0] as { id: number | string; nome_completo: string | null; perfil?: unknown };
    const resolvedId =
      typeof row.id === 'number'
        ? row.id
        : Number.parseInt(String(row.id ?? userId), 10) || userId;
    const rawName = typeof row.nome_completo === 'string' ? row.nome_completo.trim() : '';
    const name = rawName || `Usuário ${resolvedId}`;
    const rawRole = row.perfil;

    let role: string | undefined;
    if (typeof rawRole === 'string' && rawRole.trim()) {
      role = rawRole.trim();
    } else if (typeof rawRole === 'number' && Number.isFinite(rawRole)) {
      role = `Perfil ${rawRole}`;
    }

    return {
      id: resolvedId,
      name,
      role,
      avatar: buildAvatar(name),
    };
  }

  async listConversations(options?: { responsibleId?: number }): Promise<ConversationSummary[]> {
    const filters: string[] = [];
    const values: unknown[] = [];

    if (options?.responsibleId != null) {
      values.push(options.responsibleId);
      filters.push(`responsible_id = $${values.length}`);
    }

    const whereClause = filters.length > 0 ? `WHERE ${filters.join(' AND ')}` : '';

    const result = await this.query(
      `SELECT id, contact_identifier, contact_name, contact_avatar, short_status, description, pinned,
              phone_number, responsible_id, responsible_snapshot, tags, client_id, client_name, is_linked_to_client,
              custom_attributes, is_private, internal_notes,
              unread_count, last_message_id, last_message_preview, last_message_timestamp,
              last_message_sender, last_message_type, last_message_status, metadata, created_at, updated_at
         FROM chat_conversations
         ${whereClause}
         ORDER BY COALESCE(last_message_timestamp, updated_at, created_at) DESC`,
      values
    );

    return (result.rows as ConversationRow[]).map((row) => {
      const mapped = mapConversation(row);
      return {
        id: mapped.id,
        name: mapped.name,
        avatar: mapped.avatar,
        shortStatus: mapped.shortStatus,
        description: mapped.description,
        unreadCount: mapped.unreadCount,
        pinned: mapped.pinned,
        lastMessage: mapped.lastMessage,
        phoneNumber: mapped.phoneNumber,
        responsible: mapped.responsible,
        tags: mapped.tags,
        isLinkedToClient: mapped.isLinkedToClient,
        clientId: mapped.clientId,
        clientName: mapped.clientName,
        customAttributes: mapped.customAttributes,
        isPrivate: mapped.isPrivate,
        internalNotes: mapped.internalNotes,
      };
    });
  }

  async listKnownSessions(): Promise<string[]> {
    const result = await this.query(
      `SELECT DISTINCT metadata ->> 'session' AS session_id
         FROM chat_conversations
        WHERE metadata ? 'session'`,
    );

    const sessions: string[] = [];
    const seen = new Set<string>();

    for (const row of result.rows as SessionRow[]) {
      if (!row || typeof row.session_id !== 'string') {
        continue;
      }
      const trimmed = row.session_id.trim();
      if (!trimmed || seen.has(trimmed)) {
        continue;
      }
      seen.add(trimmed);
      sessions.push(trimmed);
    }

    return sessions;
  }

  async getConversationDetails(conversationId: string): Promise<ConversationDetails | null> {
    const result = await this.query(
      `SELECT id, contact_identifier, contact_name, contact_avatar, short_status, description, pinned,
              phone_number, responsible_id, responsible_snapshot, tags, client_id, client_name, is_linked_to_client,
              custom_attributes, is_private, internal_notes,
              unread_count, last_message_id, last_message_preview, last_message_timestamp,
              last_message_sender, last_message_type, last_message_status, metadata, created_at, updated_at
         FROM chat_conversations
         WHERE id = $1`,
      [conversationId]
    );

    if (result.rowCount === 0) {
      return null;
    }

    return mapConversation(result.rows[0] as ConversationRow);
  }

  async createConversation(input: CreateConversationInput): Promise<ConversationSummary> {
    const contactIdentifier = normalizeContactIdentifier(input.contactIdentifier);
    const conversationId = normalizeConversationId(input.id, contactIdentifier);
    const contactName = normalizeContactName(input.contactName ?? undefined, contactIdentifier);
    const description = input.description?.trim() || null;
    const shortStatus = input.shortStatus?.trim() || null;
    const avatar = input.avatar?.trim() || null;
    const pinned = normalizeBoolean(input.pinned, false);
    const metadata = normalizeMetadata(input.metadata);

    const result = await this.query(
      `INSERT INTO chat_conversations (
         id,
         contact_identifier,
         contact_name,
         contact_avatar,
         short_status,
         description,
         pinned,
         metadata
       )
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       ON CONFLICT (id) DO UPDATE
         SET contact_identifier = EXCLUDED.contact_identifier,
             contact_name = EXCLUDED.contact_name,
             contact_avatar = EXCLUDED.contact_avatar,
             short_status = EXCLUDED.short_status,
             description = EXCLUDED.description,
             pinned = EXCLUDED.pinned,
             metadata = EXCLUDED.metadata
       RETURNING id, contact_identifier, contact_name, contact_avatar, short_status, description, pinned,
                 phone_number, responsible_id, responsible_snapshot, tags, client_id, client_name, is_linked_to_client,
                 custom_attributes, is_private, internal_notes,
                 unread_count, last_message_id, last_message_preview, last_message_timestamp,
                 last_message_sender, last_message_type, last_message_status, metadata, created_at, updated_at`,
      [conversationId, contactIdentifier, contactName, avatar, shortStatus, description, pinned, metadata]
    );

    const mapped = mapConversation(result.rows[0] as ConversationRow);
    return {
      id: mapped.id,
      name: mapped.name,
      avatar: mapped.avatar,
      shortStatus: mapped.shortStatus,
      description: mapped.description,
      unreadCount: mapped.unreadCount,
      pinned: mapped.pinned,
      lastMessage: mapped.lastMessage,
      phoneNumber: mapped.phoneNumber,
      responsible: mapped.responsible,
      tags: mapped.tags,
      isLinkedToClient: mapped.isLinkedToClient,
      clientId: mapped.clientId,
      clientName: mapped.clientName,
      customAttributes: mapped.customAttributes,
      isPrivate: mapped.isPrivate,
      internalNotes: mapped.internalNotes,
    };
  }

  async updateConversation(
    conversationId: string,
    changes: UpdateConversationInput,
  ): Promise<ConversationSummary | null> {
    const normalizedId = typeof conversationId === 'string' ? conversationId.trim() : '';
    if (!normalizedId) {
      throw new ValidationError('Conversation id is required');
    }

    const has = (key: keyof UpdateConversationInput) => Object.prototype.hasOwnProperty.call(changes, key);

    const values: unknown[] = [normalizedId];
    const assignments: string[] = [];

    const addAssignment = (column: string, value: unknown, cast?: string) => {
      values.push(value);
      const placeholder = `$${values.length}`;
      assignments.push(`${column} = ${cast ? `${placeholder}::${cast}` : placeholder}`);
    };

    const setNull = (column: string) => {
      assignments.push(`${column} = NULL`);
    };

    if (has('responsibleId')) {
      const responsibleId = changes.responsibleId;
      if (responsibleId === null) {
        setNull('responsible_id');
        setNull('responsible_snapshot');
      } else {
        if (typeof responsibleId !== 'number' || !Number.isInteger(responsibleId)) {
          throw new ValidationError('responsibleId must be an integer');
        }

        const snapshot = await this.loadResponsibleSnapshot(responsibleId);
        if (!snapshot) {
          throw new ValidationError('Responsible user not found');
        }

        addAssignment('responsible_id', snapshot.id);
        const snapshotPayload = {
          id: String(snapshot.id),
          name: snapshot.name,
          role: snapshot.role,
          avatar: snapshot.avatar,
        };
        addAssignment('responsible_snapshot', JSON.stringify(snapshotPayload), 'jsonb');
      }
    }

    if (has('tags')) {
      const normalizedTags = parseStringArray(changes.tags ?? []).sort((a, b) => a.localeCompare(b, 'pt-BR'));
      addAssignment('tags', JSON.stringify(normalizedTags), 'jsonb');
    }

    if (has('phoneNumber')) {
      const phoneValue = changes.phoneNumber;
      if (phoneValue === null) {
        setNull('phone_number');
      } else if (typeof phoneValue === 'string') {
        const trimmed = phoneValue.trim();
        if (!trimmed) {
          setNull('phone_number');
        } else {
          addAssignment('phone_number', trimmed);
        }
      } else if (phoneValue !== undefined) {
        throw new ValidationError('phoneNumber must be a string or null');
      }
    }

    if (has('clientName')) {
      const clientValue = changes.clientName;
      if (clientValue === null) {
        setNull('client_name');
      } else if (typeof clientValue === 'string') {
        const trimmed = clientValue.trim();
        if (!trimmed) {
          setNull('client_name');
        } else {
          addAssignment('client_name', trimmed);
        }
      } else if (clientValue !== undefined) {
        throw new ValidationError('clientName must be a string or null');
      }
    }

    if (has('clientId')) {
      const clientIdValue = changes.clientId;
      if (clientIdValue === null) {
        setNull('client_id');
        if (!has('isLinkedToClient')) {
          addAssignment('is_linked_to_client', false);
        }
      } else if (typeof clientIdValue === 'number' && Number.isInteger(clientIdValue) && clientIdValue > 0) {
        addAssignment('client_id', clientIdValue);
        if (!has('isLinkedToClient')) {
          addAssignment('is_linked_to_client', true);
        }
      } else {
        throw new ValidationError('clientId must be a positive integer or null');
      }
    }

    if (has('isLinkedToClient')) {
      const linkValue = changes.isLinkedToClient;
      if (typeof linkValue !== 'boolean') {
        throw new ValidationError('isLinkedToClient must be a boolean');
      }
      addAssignment('is_linked_to_client', linkValue);
    }

    if (has('customAttributes')) {
      const normalizedAttributes = parseCustomAttributes(changes.customAttributes ?? []);
      addAssignment('custom_attributes', JSON.stringify(normalizedAttributes), 'jsonb');
    }

    if (has('isPrivate')) {
      const privateValue = changes.isPrivate;
      if (typeof privateValue !== 'boolean') {
        throw new ValidationError('isPrivate must be a boolean');
      }
      addAssignment('is_private', privateValue);
    }

    if (has('internalNotes')) {
      const normalizedNotes = parseInternalNotes(changes.internalNotes ?? []);
      addAssignment('internal_notes', JSON.stringify(normalizedNotes), 'jsonb');
    }

    if (assignments.length === 0) {
      throw new ValidationError('No valid updates provided');
    }

    const result = await this.query(
      `UPDATE chat_conversations
          SET ${assignments.join(', ')}
        WHERE id = $1
        RETURNING id, contact_identifier, contact_name, contact_avatar, short_status, description, pinned,
                  phone_number, responsible_id, responsible_snapshot, tags, client_id, client_name, is_linked_to_client,
                  custom_attributes, is_private, internal_notes,
                  unread_count, last_message_id, last_message_preview, last_message_timestamp,
                  last_message_sender, last_message_type, last_message_status, metadata, created_at, updated_at`,
      values,
    );

    if (result.rowCount === 0) {
      return null;
    }

    return mapConversation(result.rows[0] as ConversationRow);
  }

  async ensureConversation(input: CreateConversationInput): Promise<ConversationDetails> {
    const contactIdentifier = normalizeContactIdentifier(input.contactIdentifier);
    const conversationId = normalizeConversationId(input.id, contactIdentifier);
    const contactName = normalizeContactName(input.contactName ?? undefined, contactIdentifier);
    const description = input.description?.trim() || null;
    const shortStatus = input.shortStatus?.trim() || null;
    const avatar = input.avatar?.trim() || null;
    const pinned = normalizeBoolean(input.pinned, false);
    const metadata = normalizeMetadata(input.metadata);

    const result = await this.query(
      `INSERT INTO chat_conversations (
         id,
         contact_identifier,
         contact_name,
         contact_avatar,
         short_status,
         description,
         pinned,
         metadata
       )
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       ON CONFLICT (id) DO UPDATE
        SET contact_identifier = COALESCE(chat_conversations.contact_identifier, EXCLUDED.contact_identifier),
            contact_name = CASE
              WHEN EXCLUDED.contact_name IS NULL OR EXCLUDED.contact_name = '' THEN chat_conversations.contact_name
              WHEN chat_conversations.contact_name IS NULL OR chat_conversations.contact_name = '' THEN EXCLUDED.contact_name
              ELSE EXCLUDED.contact_name
            END,
            contact_avatar = CASE
              WHEN EXCLUDED.contact_avatar IS NULL OR EXCLUDED.contact_avatar = '' THEN chat_conversations.contact_avatar
              ELSE EXCLUDED.contact_avatar
            END,
            short_status = COALESCE(EXCLUDED.short_status, chat_conversations.short_status),
            description = COALESCE(EXCLUDED.description, chat_conversations.description),
            metadata = CASE
              WHEN chat_conversations.metadata IS NULL AND EXCLUDED.metadata IS NULL THEN NULL
              ELSE COALESCE(chat_conversations.metadata, '{}'::jsonb) || COALESCE(EXCLUDED.metadata, '{}'::jsonb)
            END
       RETURNING id, contact_identifier, contact_name, contact_avatar, short_status, description, pinned,
                 phone_number, responsible_id, responsible_snapshot, tags, client_id, client_name, is_linked_to_client,
                 custom_attributes, is_private, internal_notes,
                 unread_count, last_message_id, last_message_preview, last_message_timestamp,
                 last_message_sender, last_message_type, last_message_status, metadata, created_at, updated_at`,
      [conversationId, contactIdentifier, contactName, avatar, shortStatus, description, pinned, metadata]
    );

    return mapConversation(result.rows[0] as ConversationRow);
  }

  async recordMessage(input: RecordMessageInput): Promise<ChatMessage> {
    const conversation = await this.getConversationDetails(input.conversationId);
    if (!conversation) {
      throw new ValidationError('Conversation not found');
    }

    const content = normalizeMessageContent(input.content);
    const type = normalizeMessageType(input.type);
    const status = normalizeStatus(input.status);
    const timestamp = normalizeTimestamp(input.timestamp);
    const attachments = normalizeAttachments(input.attachments);
    const externalId = typeof input.externalId === 'string' && input.externalId.trim()
      ? input.externalId.trim()
      : null;
    const sender = input.sender;
    const id = normalizeMessageId(input.id, externalId);

    const insertResult = await this.query(
      `INSERT INTO chat_messages (id, conversation_id, external_id, sender, content, message_type, status, timestamp, attachments)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       ON CONFLICT (id) DO NOTHING
       RETURNING id, conversation_id, external_id, sender, content, message_type, status, timestamp, attachments, created_at`,
      [id, conversation.id, externalId, sender, content, type, status, timestamp, attachments]
    );

    if (insertResult.rowCount === 0) {
      const existing = await this.query(
        `SELECT id, conversation_id, external_id, sender, content, message_type, status, timestamp, attachments, created_at
           FROM chat_messages
           WHERE id = $1`,
        [id]
      );

      if (existing.rowCount === 0) {
        throw new Error('Failed to persist message');
      }

      return mapMessage(existing.rows[0] as MessageRow);
    }

    const preview = buildPreview(content, type, attachments ?? undefined);

    await this.query(
      `UPDATE chat_conversations
          SET last_message_id = $2,
              last_message_preview = $3,
              last_message_timestamp = $4,
              last_message_sender = $5,
              last_message_type = $6,
              last_message_status = $7,
              unread_count = CASE WHEN $5 = 'contact' THEN unread_count + 1 ELSE unread_count END
        WHERE id = $1`,
      [conversation.id, id, preview, timestamp, sender, type, status]
    );

    return mapMessage(insertResult.rows[0] as MessageRow);
  }

  async recordIncomingMessage(input: Omit<RecordMessageInput, 'sender'>): Promise<ChatMessage> {
    return this.recordMessage({ ...input, sender: 'contact', status: input.status ?? 'delivered' });
  }

  async recordOutgoingMessage(input: Omit<RecordMessageInput, 'sender'>): Promise<ChatMessage> {
    return this.recordMessage({ ...input, sender: 'me', status: input.status ?? 'sent' });
  }

  async getMessages(
    conversationId: string,
    cursor: string | null,
    limit = DEFAULT_PAGE_SIZE,
  ): Promise<MessagePage> {
    const conversation = await this.getConversationDetails(conversationId);
    if (!conversation) {
      throw new ValidationError('Conversation not found');
    }

    const normalizedLimit = Math.min(Math.max(limit, 1), MAX_PAGE_SIZE);
    const values: unknown[] = [conversationId, normalizedLimit + 1];
    let filter = '';

    if (cursor && cursor.trim()) {
      const parsed = new Date(cursor);
      if (!Number.isNaN(parsed.getTime())) {
        values.push(parsed);
        filter = 'AND created_at < $3';
      }
    }

    const result = await this.query(
      `SELECT id, conversation_id, external_id, sender, content, message_type, status, timestamp, attachments, created_at
         FROM chat_messages
         WHERE conversation_id = $1
         ${filter}
         ORDER BY created_at DESC
         LIMIT $2`,
      values,
    );

    const rows = result.rows as MessageRow[];
    const hasMore = rows.length > normalizedLimit;
    const slice = hasMore ? rows.slice(0, normalizedLimit) : rows;
    const messages = slice.reverse().map(mapMessage);

    return {
      messages,
      nextCursor: hasMore ? computeNextCursor(messages) : null,
    };
  }

  async markConversationAsRead(conversationId: string): Promise<boolean> {
    const updateConversation = await this.query(
      `UPDATE chat_conversations
          SET unread_count = 0,
              last_message_status = CASE WHEN last_message_sender = 'contact' THEN 'read' ELSE last_message_status END
        WHERE id = $1
        RETURNING id, last_message_id`,
      [conversationId]
    );

    if (updateConversation.rowCount === 0) {
      return false;
    }

    await this.query(
      `UPDATE chat_messages
          SET status = 'read'
        WHERE conversation_id = $1 AND sender = 'contact' AND status <> 'read'`,
      [conversationId]
    );

    return true;
  }

  async updateMessageStatusByExternalId(
    externalId: string,
    status: ChatMessageStatus
  ): Promise<MessageStatusRecord[]> {
    const normalizedStatus = normalizeStatus(status);
    const result = await this.query(
      `UPDATE chat_messages
          SET status = $2
        WHERE external_id = $1
        RETURNING conversation_id, id`,
      [externalId, normalizedStatus]
    );

    if (result.rowCount === 0) {
      return [];
    }

    const updates = (result.rows as { conversation_id: string; id: string }[]).map(
      (row) => ({
        conversationId: row.conversation_id,
        messageId: row.id,
        status: normalizedStatus,
      }) satisfies MessageStatusRecord
    );

    for (const row of result.rows as { conversation_id: string; id: string }[]) {
      await this.query(
        `UPDATE chat_conversations
            SET last_message_status = CASE WHEN last_message_id = $2 THEN $3 ELSE last_message_status END
          WHERE id = $1`,
        [row.conversation_id, row.id, normalizedStatus]
      );
    }

    return updates;
  }
}
