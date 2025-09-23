import type { Request, Response } from 'express';
import type {
  ChatMessage,
  ChatMessageStatus,
  ConversationDetails,
  ConversationSummary,
} from '../services/chatService';

interface ClientConnection {
  id: number;
  userId: number;
  userName?: string;
  response: Response;
  keepAliveTimer: NodeJS.Timeout;
}

interface TypingEntry {
  timeout: NodeJS.Timeout;
  userName?: string;
}

const clients = new Set<ClientConnection>();
const typingState = new Map<string, Map<number, TypingEntry>>();

let nextClientId = 1;

const KEEP_ALIVE_INTERVAL = 25_000;
const TYPING_IDLE_TIMEOUT = 6_000;

type ServerEventName =
  | 'connection'
  | 'conversation:update'
  | 'conversation:read'
  | 'message:new'
  | 'message:status'
  | 'typing'
  | 'ping';

interface ServerEvent<T = unknown> {
  event: ServerEventName;
  data?: T;
}

const safeJson = (payload: unknown): string => {
  try {
    return JSON.stringify(payload ?? {});
  } catch (error) {
    console.warn('Failed to serialize SSE payload', error);
    return '{}';
  }
};

const writeEvent = (client: ClientConnection, event: ServerEvent) => {
  const chunks = [`event: ${event.event}`];
  if (event.data !== undefined) {
    const serialized = safeJson(event.data).split(/\n/);
    for (const line of serialized) {
      chunks.push(`data: ${line}`);
    }
  }
  chunks.push('\n');

  try {
    client.response.write(chunks.join('\n'));
  } catch (error) {
    console.warn('Failed to write SSE event, dropping connection', error);
    removeClient(client);
  }
};

const removeClient = (client: ClientConnection) => {
  if (!clients.has(client)) {
    return;
  }

  clients.delete(client);

  try {
    clearInterval(client.keepAliveTimer);
  } catch (error) {
    console.warn('Failed to clear SSE keep-alive timer', error);
  }

  try {
    client.response.end();
  } catch (error) {
    console.warn('Failed to gracefully terminate SSE response', error);
  }
};

const registerClient = (
  req: Request,
  res: Response,
  userId: number,
  userName?: string
) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');

  res.flushHeaders?.();

  const connection: ClientConnection = {
    id: nextClientId++,
    userId,
    userName,
    response: res,
    keepAliveTimer: setInterval(() => {
      writeEvent(connection, { event: 'ping', data: { ts: Date.now() } });
    }, KEEP_ALIVE_INTERVAL),
  };

  clients.add(connection);

  writeEvent(connection, {
    event: 'connection',
    data: { userId: String(userId), userName },
  });

  req.on('close', () => {
    removeClient(connection);
  });
};

const broadcastEvent = (event: ServerEvent, options?: { excludeUserId?: number }) => {
  if (clients.size === 0) {
    return;
  }

  for (const client of clients) {
    if (options?.excludeUserId && client.userId === options.excludeUserId) {
      continue;
    }
    writeEvent(client, event);
  }
};

const cleanupTypingEntry = (conversationId: string, userId: number) => {
  const conversationTimers = typingState.get(conversationId);
  if (!conversationTimers) {
    return;
  }

  const entry = conversationTimers.get(userId);
  if (entry) {
    clearTimeout(entry.timeout);
  }

  conversationTimers.delete(userId);

  if (conversationTimers.size === 0) {
    typingState.delete(conversationId);
  }
};

const scheduleTypingTimeout = (
  conversationId: string,
  userId: number,
  userName: string | undefined
) => {
  let conversationTimers = typingState.get(conversationId);
  if (!conversationTimers) {
    conversationTimers = new Map<number, TypingEntry>();
    typingState.set(conversationId, conversationTimers);
  }

  const timeout = setTimeout(() => {
    conversationTimers?.delete(userId);
    if (conversationTimers && conversationTimers.size === 0) {
      typingState.delete(conversationId);
    }
    broadcastEvent({
      event: 'typing',
      data: {
        conversationId,
        userId: String(userId),
        userName,
        isTyping: false,
        timeout: true,
      },
    });
  }, TYPING_IDLE_TIMEOUT);

  conversationTimers.set(userId, { timeout, userName });
};

export const streamConversations = (req: Request, res: Response) => {
  if (!req.auth) {
    res.status(401).json({ error: 'Token inválido.' });
    return;
  }

  const payload = (req.auth.payload ?? {}) as Record<string, unknown>;
  const userName =
    typeof payload.name === 'string' && payload.name.trim().length > 0
      ? payload.name.trim()
      : undefined;

  registerClient(req, res, req.auth.userId, userName);
};

export const publishConversationUpdate = (
  conversation: ConversationSummary | ConversationDetails
) => {
  const payload: ConversationSummary = {
    id: conversation.id,
    name: conversation.name,
    avatar: conversation.avatar,
    shortStatus: conversation.shortStatus,
    description: conversation.description,
    unreadCount: conversation.unreadCount,
    pinned: conversation.pinned,
    lastMessage: conversation.lastMessage,
    phoneNumber: conversation.phoneNumber,
    responsible: conversation.responsible,
    tags: conversation.tags,
    isLinkedToClient: conversation.isLinkedToClient,
    clientId: conversation.clientId,
    clientName: conversation.clientName,
    customAttributes: conversation.customAttributes,
    isPrivate: conversation.isPrivate,
    internalNotes: conversation.internalNotes,
  };

  broadcastEvent({ event: 'conversation:update', data: payload });
};

export const publishMessageCreated = (
  message: ChatMessage,
  options?: { excludeUserId?: number }
) => {
  broadcastEvent(
    {
      event: 'message:new',
      data: { conversationId: message.conversationId, message },
    },
    options
  );
};

export const publishConversationRead = (
  conversationId: string,
  userId?: number
) => {
  broadcastEvent({
    event: 'conversation:read',
    data: {
      conversationId,
      userId: userId ? String(userId) : undefined,
    },
  });
};

export interface MessageStatusUpdate {
  conversationId: string;
  messageId: string;
  status: ChatMessageStatus;
}

export const publishMessageStatusUpdate = (update: MessageStatusUpdate) => {
  broadcastEvent({
    event: 'message:status',
    data: update,
  });
};

export const updateTypingState = (
  conversationId: string,
  userId: number,
  userName: string | undefined,
  isTyping: boolean
) => {
  const normalizedConversationId = conversationId.trim();
  if (!normalizedConversationId) {
    return;
  }

  cleanupTypingEntry(normalizedConversationId, userId);

  if (isTyping) {
    scheduleTypingTimeout(normalizedConversationId, userId, userName);
  }

  broadcastEvent({
    event: 'typing',
    data: {
      conversationId: normalizedConversationId,
      userId: String(userId),
      userName,
      isTyping,
    },
  }, { excludeUserId: userId });
};
