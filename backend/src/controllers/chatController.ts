import { Request, Response } from 'express';
import ChatService, {
  CreateConversationInput,
  MessagePage,
  SendMessageInput,
  ValidationError as ChatValidationError,
} from '../services/chatService';
import WahaIntegrationService, {
  IntegrationNotConfiguredError,
  WebhookAuthorizationError,
} from '../services/wahaIntegrationService';
import WahaConfigService, {
  ValidationError as WahaConfigValidationError,
} from '../services/wahaConfigService';

const chatService = new ChatService();
const wahaConfigService = new WahaConfigService();
const wahaIntegration = new WahaIntegrationService(chatService, wahaConfigService);

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

function parseConversationLimit(value: unknown): number | undefined {
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

export async function listConversationsHandler(req: Request, res: Response) {
  const source = typeof req.query.source === 'string' ? req.query.source : undefined;
  const preferLocal = source === 'local';
  const forceRemote = source === 'waha';
  const session = typeof req.query.session === 'string' ? req.query.session : undefined;
  const limit = parseConversationLimit(req.query.limit);

  if (!preferLocal) {
    try {
      const conversations = await wahaIntegration.listChats({
        sessionId: session,
        limit,
      });
      return res.json(conversations);
    } catch (error) {
      if (error instanceof IntegrationNotConfiguredError) {
        if (forceRemote) {
          return res.status(503).json({ error: error.message });
        }
        console.warn('WAHA integration not configured, falling back to local conversations');
      } else if (error instanceof ChatValidationError) {
        return res.status(400).json({ error: error.message });
      } else {
        console.error('Failed to list WAHA chats', error);
        return res.status(502).json({ error: 'Failed to load conversations from WAHA' });
      }
    }
  }

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
    const message = await wahaIntegration.sendMessage(conversationId, payload);
    res.status(201).json(message);
  } catch (error) {
    if (error instanceof ChatValidationError) {
      return res.status(400).json({ error: error.message });
    }
    if (error instanceof IntegrationNotConfiguredError) {
      return res.status(503).json({ error: error.message });
    }
    console.error('Failed to send message through WAHA', error);
    res.status(502).json({ error: 'Failed to deliver message to provider' });
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

export async function wahaWebhookHandler(req: Request, res: Response) {
  try {
    await wahaIntegration.handleWebhook(req.body, req.headers);
    res.status(204).send();
  } catch (error) {
    if (error instanceof WebhookAuthorizationError) {
      return res.status(401).json({ error: error.message });
    }
    if (error instanceof IntegrationNotConfiguredError) {
      return res.status(503).json({ error: error.message });
    }
    if (error instanceof WahaConfigValidationError || error instanceof ChatValidationError) {
      return res.status(400).json({ error: error.message });
    }
    console.error('Failed to process WAHA webhook', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}
