import assert from 'node:assert/strict';
import test from 'node:test';
import ChatService, { ValidationError } from '../src/services/chatService';

type QueryCall = { text: string; values?: unknown[] };
type QueryResponse = { rows: any[]; rowCount: number };

class FakePool {
  public readonly calls: QueryCall[] = [];

  constructor(private readonly responses: QueryResponse[]) {}

  async query(text: string, values?: unknown[]) {
    this.calls.push({ text, values });
    if (this.responses.length === 0) {
      throw new Error('No response configured for query');
    }
    return this.responses.shift()!;
  }
}

test('ChatService.recordOutgoingMessage persists message and updates conversation', async () => {
  const conversationRow = {
    id: 'conv-1',
    contact_identifier: '5511999999999',
    contact_name: 'Cliente',
    contact_avatar: null,
    short_status: 'Ativo',
    description: null,
    pinned: false,
    unread_count: 0,
    last_message_id: null,
    last_message_preview: null,
    last_message_timestamp: null,
    last_message_sender: null,
    last_message_type: null,
    last_message_status: null,
    metadata: null,
    created_at: '2024-01-01T00:00:00.000Z',
    updated_at: '2024-01-01T00:00:00.000Z',
  };

  const messageRow = {
    id: 'msg-1',
    conversation_id: 'conv-1',
    external_id: 'msg-1',
    sender: 'me',
    content: 'Olá',
    message_type: 'text',
    status: 'sent',
    timestamp: '2024-01-01T12:00:00.000Z',
    attachments: null,
    created_at: '2024-01-01T12:00:00.000Z',
  };

  const pool = new FakePool([
    { rows: [conversationRow], rowCount: 1 },
    { rows: [messageRow], rowCount: 1 },
    { rows: [], rowCount: 1 },
  ]);

  const service = new ChatService(pool as any);

  const message = await service.recordOutgoingMessage({
    conversationId: 'conv-1',
    content: 'Olá',
  });

  assert.equal(pool.calls.length, 3);
  assert.match(pool.calls[1]!.text, /INSERT INTO chat_messages/i);
  assert.match(pool.calls[2]!.text, /UPDATE chat_conversations/i);

  assert.equal(message.id, 'msg-1');
  assert.equal(message.conversationId, 'conv-1');
  assert.equal(message.content, 'Olá');
  assert.equal(message.status, 'sent');
});

test('ChatService.getMessages paginates messages in chronological order', async () => {
  const conversationRow = {
    id: 'conv-2',
    contact_identifier: '5511888888888',
    contact_name: 'Contato',
    contact_avatar: null,
    short_status: 'Ativo',
    description: null,
    pinned: false,
    unread_count: 0,
    last_message_id: null,
    last_message_preview: null,
    last_message_timestamp: null,
    last_message_sender: null,
    last_message_type: null,
    last_message_status: null,
    metadata: null,
    created_at: '2024-01-01T00:00:00.000Z',
    updated_at: '2024-01-01T00:00:00.000Z',
  };

  const rows = [
    {
      id: 'msg-3',
      conversation_id: 'conv-2',
      external_id: 'msg-3',
      sender: 'contact',
      content: 'Mensagem 3',
      message_type: 'text',
      status: 'sent',
      timestamp: '2024-01-01T15:00:00.000Z',
      attachments: null,
      created_at: '2024-01-01T15:00:00.000Z',
    },
    {
      id: 'msg-2',
      conversation_id: 'conv-2',
      external_id: 'msg-2',
      sender: 'me',
      content: 'Mensagem 2',
      message_type: 'text',
      status: 'sent',
      timestamp: '2024-01-01T14:00:00.000Z',
      attachments: null,
      created_at: '2024-01-01T14:00:00.000Z',
    },
    {
      id: 'msg-1',
      conversation_id: 'conv-2',
      external_id: 'msg-1',
      sender: 'contact',
      content: 'Mensagem 1',
      message_type: 'text',
      status: 'sent',
      timestamp: '2024-01-01T13:00:00.000Z',
      attachments: null,
      created_at: '2024-01-01T13:00:00.000Z',
    },
  ];

  const pool = new FakePool([
    { rows: [conversationRow], rowCount: 1 },
    { rows, rowCount: rows.length },
  ]);

  const service = new ChatService(pool as any);

  const page = await service.getMessages('conv-2', null, 2);

  assert.equal(page.messages.length, 2);
  assert.equal(page.messages[0]!.id, 'msg-2');
  assert.equal(page.messages[1]!.id, 'msg-3');
  assert.equal(page.nextCursor, page.messages[0]!.timestamp);
});

test('ChatService.createConversation validates payload', async () => {
  const pool = new FakePool([]);
  const service = new ChatService(pool as any);

  await assert.rejects(() => service.createConversation({ contactIdentifier: '' }), ValidationError);
});
