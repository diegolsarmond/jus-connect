// This file shows how to handle WAHA webhook events
// In a real application, you would set up an actual server endpoint
// For this demo, we'll show the structure and integration points

import { WebhookEvent, MessageEvent, Message } from '@/types/waha';

type AckStatus = 'SENT' | 'DELIVERED' | 'READ';

const toArray = (input: unknown): unknown[] => {
  if (Array.isArray(input)) {
    return input;
  }

  if (input && typeof input === 'object') {
    const messages = (input as { messages?: unknown[] }).messages;
    if (Array.isArray(messages)) {
      return messages;
    }
  }

  return input ? [input] : [];
};

const readRecord = (value: unknown): Record<string, unknown> | null =>
  value && typeof value === 'object' ? (value as Record<string, unknown>) : null;

const readString = (value: unknown): string | undefined => {
  if (typeof value === 'string') {
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : undefined;
  }

  if (typeof value === 'number') {
    const text = String(value);
    return text.length > 0 ? text : undefined;
  }

  return undefined;
};

const normalizeAckStatus = (value: unknown): AckStatus => {
  if (typeof value === 'number') {
    if (value >= 3) {
      return 'READ';
    }
    if (value === 2) {
      return 'DELIVERED';
    }
    return 'SENT';
  }

  if (typeof value === 'string') {
    const normalized = value.trim().toUpperCase();
    if (normalized === 'READ') {
      return 'READ';
    }
    if (normalized === 'DELIVERED') {
      return 'DELIVERED';
    }
    if (normalized === 'SENT') {
      return 'SENT';
    }
  }

  return 'SENT';
};

// Webhook endpoint handler (pseudo-code for demonstration)
export const handleWAHAWebhook = async (event: WebhookEvent) => {
  console.log('WAHA Webhook received:', event);
  
  switch (event.event) {
    case 'message': {
      const messageEvent = event as MessageEvent;
      console.log('New message received:', messageEvent.payload);
      
      // In a real app, you would:
      // 1. Validate the webhook signature
      // 2. Update your local state/database
      // 3. Notify connected clients via WebSocket/SSE
      // 4. Send push notifications if needed
      
      // For this demo, you can manually trigger this through browser console:
      // window.wahaWebhookReceived?.(messageEvent.payload)
      
      if (typeof window !== 'undefined' && window.wahaWebhookReceived) {
        window.wahaWebhookReceived(messageEvent.payload);
      }
      
      break;
    }
      
    case 'message.ack': {
      const payloads = toArray(event.payload);

      for (const entry of payloads) {
        const record = readRecord(entry);
        if (!record) {
          continue;
        }

        const key = readRecord(record.key);
        const messageId =
          readString(record.id) ??
          readString(record.messageId) ??
          (key
            ? readString(key.id) ??
              readString(key._serialized) ??
              (() => {
                const nested = readRecord(key.id);
                return nested ? readString(nested._serialized) ?? readString(nested.id) : undefined;
              })()
            : undefined);

        if (!messageId) {
          continue;
        }

        const chatId =
          readString(record.chatId) ??
          readString(record.chat_id) ??
          readString(record.chatID) ??
          (key
            ? readString(key.remoteJid) ??
              readString(key.chat) ??
              readString(key.remote) ??
              readString(key.participant)
            : undefined);

        if (!chatId) {
          continue;
        }

        const ack = normalizeAckStatus(record.status ?? record.ack ?? record.state);

        if (typeof window !== 'undefined' && window.wahaWebhookStatusUpdate) {
          window.wahaWebhookStatusUpdate({ chatId, messageId, ack });
        }
      }

      break;
    }
      
    case 'session.status':
      console.log('Session status changed:', event.payload);
      // Handle session status changes
      break;
      
    default:
      console.log('Unhandled webhook event:', event.event);
  }
};

// Webhook URL that should be configured in WAHA
export const getWebhookEndpoint = () => {
  const baseUrl = typeof window !== 'undefined' 
    ? window.location.origin 
    : 'http://localhost:8080';
  
  return `${baseUrl}/api/webhook/waha`;
};

// Example webhook payload for testing
export const exampleWebhookPayload: MessageEvent = {
  event: 'message',
  session: 'QuantumTecnologia01',
  payload: {
    id: 'example_message_id',
    chatId: '5511999999999@c.us',
    body: 'Hello from WAHA webhook!',
    timestamp: Date.now(),
    fromMe: false,
    type: 'text',
    ack: 'DELIVERED',
    author: '5511999999999@c.us'
  }
};

// Global type declaration for webhook receiver
declare global {
  interface Window {
    wahaWebhookReceived?: (message: Message) => void;
    wahaWebhookStatusUpdate?: (update: { chatId: string; messageId: string; ack: AckStatus }) => void;
  }
}
