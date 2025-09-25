import { Request, Response } from 'express';
import ChatService, {
  CreateConversationInput,
  MessagePage,
  RecordMessageInput,
  SendMessageInput,
  UpdateConversationInput,
  ValidationError as ChatValidationError,
} from '../services/chatService';
import {
  publishConversationRead,
  publishConversationUpdate,
  publishMessageCreated,
  streamConversations,
  updateTypingState,
} from '../realtime';
import { fetchUserConversationVisibility } from '../utils/authUser';

const chatService = new ChatService();

function parseCreateConversationInput(body: any): CreateConversationInput {
  if (!body || typeof body !== 'object') {
    throw new ChatValidationError('Request body must be an object');
  }

  const id = typeof body.id === 'string' ? body.id : undefined;
  const contactIdentifier = typeof body.contactIdentifier === 'string'
    ? body.contactIdentifier
    : typeof body.identifier === 'string'
      ? body.identifier
      : undefined;

  if (!contactIdentifier && !id) {
    throw new ChatValidationError('contactIdentifier is required');
  }

  const metadata = body.metadata && typeof body.metadata === 'object' ? (body.metadata as Record<string, unknown>) : undefined;

  return {
    id,
    contactIdentifier: contactIdentifier ?? id!,
    contactName: typeof body.name === 'string' ? body.name : typeof body.contactName === 'string' ? body.contactName : undefined,
    description: typeof body.description === 'string' ? body.description : undefined,
    shortStatus: typeof body.shortStatus === 'string' ? body.shortStatus : undefined,
    avatar: typeof body.avatar === 'string' ? body.avatar : undefined,
    pinned: typeof body.pinned === 'boolean' ? body.pinned : undefined,
    metadata: metadata ?? undefined,
  };
}

function parseMessageLimit(value: unknown): number | undefined {
  if (typeof value !== 'string') {
    return undefined;
  }
  const parsed = Number.parseInt(value, 10);
  if (Number.isNaN(parsed) || parsed <= 0) {
    return undefined;
  }
  return parsed;
}

function parseSendMessagePayload(body: any): SendMessageInput {
  if (!body || typeof body !== 'object') {
    throw new ChatValidationError('Request body must be an object');
  }
  const content = typeof body.content === 'string' ? body.content.trim() : '';
  if (!content) {
    throw new ChatValidationError('Message content is required');
  }
  const type = typeof body.type === 'string' ? (body.type as SendMessageInput['type']) : undefined;
  const attachments = Array.isArray(body.attachments) ? body.attachments : undefined;
  return {
    content,
    type,
    attachments,
  };
}

function parseUpdateConversationPayload(body: any): UpdateConversationInput {
  if (!body || typeof body !== 'object') {
    throw new ChatValidationError('Request body must be an object');
  }

  const payload: UpdateConversationInput = {};
  const has = (key: string) => Object.prototype.hasOwnProperty.call(body, key);

  if (has('responsibleId')) {
    const value = body.responsibleId;
    if (value === null || value === undefined || (typeof value === 'string' && value.trim() === '')) {
      payload.responsibleId = null;
    } else if (typeof value === 'number') {
      if (!Number.isInteger(value)) {
        throw new ChatValidationError('responsibleId must be an integer');
      }
      payload.responsibleId = value;
    } else if (typeof value === 'string') {
      const parsed = Number.parseInt(value, 10);
      if (!Number.isFinite(parsed) || !Number.isInteger(parsed)) {
        throw new ChatValidationError('responsibleId must be a valid integer');
      }
      payload.responsibleId = parsed;
    } else {
      throw new ChatValidationError('responsibleId must be a string, number or null');
    }
  }

  if (has('tags')) {
    if (!Array.isArray(body.tags)) {
      throw new ChatValidationError('tags must be an array');
    }
    payload.tags = body.tags.filter((tag: unknown): tag is string => typeof tag === 'string');
  }

  if (has('phoneNumber')) {
    const value = body.phoneNumber;
    if (value === null || value === undefined) {
      payload.phoneNumber = null;
    } else if (typeof value === 'string') {
      payload.phoneNumber = value;
    } else {
      throw new ChatValidationError('phoneNumber must be a string or null');
    }
  }

  if (has('clientName')) {
    const value = body.clientName;
    if (value === null) {
      payload.clientName = null;
    } else if (typeof value === 'string') {
      payload.clientName = value;
    } else {
      throw new ChatValidationError('clientName must be a string or null');
    }
  }

  if (has('clientId')) {
    const value = body.clientId;
    let normalized: number | null;
    if (value === null || value === undefined || (typeof value === 'string' && value.trim().length === 0)) {
      normalized = null;
    } else if (typeof value === 'number') {
      if (!Number.isInteger(value) || value <= 0) {
        throw new ChatValidationError('clientId must be a positive integer');
      }
      normalized = value;
    } else if (typeof value === 'string') {
      const trimmed = value.trim();
      if (!trimmed) {
        normalized = null;
      } else {
        const parsed = Number.parseInt(trimmed, 10);
        if (!Number.isFinite(parsed) || !Number.isInteger(parsed) || parsed <= 0) {
          throw new ChatValidationError('clientId must be a positive integer');
        }
        normalized = parsed;
      }
    } else {
      throw new ChatValidationError('clientId must be a number, string or null');
    }

    payload.clientId = normalized;
    if (!has('isLinkedToClient')) {
      payload.isLinkedToClient = normalized !== null;
    }
  }

  if (has('isLinkedToClient')) {
    if (typeof body.isLinkedToClient !== 'boolean') {
      throw new ChatValidationError('isLinkedToClient must be a boolean');
    }
    payload.isLinkedToClient = body.isLinkedToClient;
  }

  if (has('customAttributes')) {
    if (!Array.isArray(body.customAttributes)) {
      throw new ChatValidationError('customAttributes must be an array');
    }
    payload.customAttributes = body.customAttributes.filter((item: unknown): item is NonNullable<UpdateConversationInput['customAttributes']>[number] =>
      !!item && typeof item === 'object',
    );
  }

  if (has('isPrivate')) {
    if (typeof body.isPrivate !== 'boolean') {
      throw new ChatValidationError('isPrivate must be a boolean');
    }
    payload.isPrivate = body.isPrivate;
  }

  if (has('internalNotes')) {
    if (!Array.isArray(body.internalNotes)) {
      throw new ChatValidationError('internalNotes must be an array');
    }
    payload.internalNotes = body.internalNotes.filter((item: unknown): item is NonNullable<UpdateConversationInput['internalNotes']>[number] =>
      !!item && typeof item === 'object',
    );
  }

  return payload;
}

export async function listConversationsHandler(req: Request, res: Response) {
  if (!req.auth) {
    res.status(401).json({ error: 'Token inválido.' });
    return;
  }

  try {
    const visibility = await fetchUserConversationVisibility(req.auth.userId);

    if (!visibility.success) {
      res.status(visibility.status).json({ error: visibility.message });
      return;
    }

    const conversations = await chatService.listConversations(
      visibility.viewAllConversations ? undefined : { responsibleId: req.auth.userId }
    );
    res.json(conversations);
  } catch (error) {
    console.error('Failed to list conversations', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}

export async function createConversationHandler(req: Request, res: Response) {
  try {
    const input = parseCreateConversationInput(req.body);
    const conversation = await chatService.createConversation(input);
    res.status(201).json(conversation);
    publishConversationUpdate(conversation);
  } catch (error) {
    if (error instanceof ChatValidationError) {
      return res.status(400).json({ error: error.message });
    }
    console.error('Failed to create conversation', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}

export async function getConversationMessagesHandler(req: Request, res: Response) {
  const { conversationId } = req.params;
  try {
    const limit = parseMessageLimit(req.query.limit);
    const cursor = typeof req.query.cursor === 'string' ? req.query.cursor : null;
    const page: MessagePage = await chatService.getMessages(conversationId, cursor, limit ?? undefined);
    res.json(page);
  } catch (error) {
    if (error instanceof ChatValidationError) {
      return res.status(404).json({ error: error.message });
    }
    console.error('Failed to load messages', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}

export async function sendConversationMessageHandler(req: Request, res: Response) {
  const { conversationId } = req.params;
  try {
    const payload = parseSendMessagePayload(req.body);
    const message = await chatService.recordOutgoingMessage({
      conversationId,
      content: payload.content,
      type: payload.type,
      attachments: payload.attachments as RecordMessageInput['attachments'],
    });
    const conversation = await chatService.getConversationDetails(conversationId);
    res.status(201).json(message);
    publishMessageCreated(message);
    if (conversation) {
      publishConversationUpdate(conversation);
    }
  } catch (error) {
    if (error instanceof ChatValidationError) {
      return res.status(400).json({ error: error.message });
    }
    console.error('Failed to record outgoing message', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}

export async function updateConversationHandler(req: Request, res: Response) {
  const { conversationId } = req.params;
  try {
    const payload = parseUpdateConversationPayload(req.body);
    const updated = await chatService.updateConversation(conversationId, payload);
    if (!updated) {
      return res.status(404).json({ error: 'Conversation not found' });
    }
    res.json(updated);
    publishConversationUpdate(updated);
  } catch (error) {
    if (error instanceof ChatValidationError) {
      return res.status(400).json({ error: error.message });
    }
    console.error('Failed to update conversation', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}

export async function markConversationReadHandler(req: Request, res: Response) {
  const { conversationId } = req.params;
  try {
    const updated = await chatService.markConversationAsRead(conversationId);
    if (!updated) {
      return res.status(404).json({ error: 'Conversation not found' });
    }
    res.status(204).send();
    const conversation = await chatService.getConversationDetails(conversationId);
    publishConversationRead(conversationId, req.auth?.userId);
    if (conversation) {
      publishConversationUpdate(conversation);
    }
  } catch (error) {
    console.error('Failed to mark conversation as read', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}

export function streamConversationEventsHandler(req: Request, res: Response) {
  streamConversations(req, res);
}

export function updateTypingStateHandler(req: Request, res: Response) {
  if (!req.auth) {
    res.status(401).json({ error: 'Token inválido.' });
    return;
  }

  const { conversationId } = req.params;
  const isTyping = typeof req.body?.isTyping === 'boolean' ? req.body.isTyping : undefined;

  if (typeof conversationId !== 'string' || !conversationId.trim()) {
    res.status(400).json({ error: 'Conversation id is required.' });
    return;
  }

  if (typeof isTyping !== 'boolean') {
    res.status(400).json({ error: 'isTyping must be a boolean value.' });
    return;
  }

  const payload = (req.auth.payload ?? {}) as Record<string, unknown>;
  const userName =
    typeof payload.name === 'string' && payload.name.trim().length > 0
      ? payload.name.trim()
      : undefined;

  updateTypingState(conversationId, req.auth.userId, userName, isTyping);
  res.status(202).json({ accepted: true });
}
