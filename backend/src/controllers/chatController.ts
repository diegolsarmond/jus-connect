import { Request, Response } from 'express';
import ChatService, {
  CreateConversationInput,
  MessagePage,
  RecordMessageInput,
  SendMessageInput,
  ValidationError as ChatValidationError,
} from '../services/chatService';

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

export async function listConversationsHandler(_req: Request, res: Response) {
  try {
    const conversations = await chatService.listConversations();
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
    res.status(201).json(message);
  } catch (error) {
    if (error instanceof ChatValidationError) {
      return res.status(400).json({ error: error.message });
    }
    console.error('Failed to record outgoing message', error);
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
  } catch (error) {
    console.error('Failed to mark conversation as read', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}
