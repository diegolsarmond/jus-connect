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
    phone_number: null,
    responsible_id: null,
    responsible_snapshot: null,
    tags: [],
    client_name: null,
    is_linked_to_client: false,
    custom_attributes: [],
    is_private: false,
    internal_notes: [],
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

  const service = new ChatService(pool as any, async () => {});

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
    phone_number: null,
    responsible_id: null,
    responsible_snapshot: null,
    tags: [],
    client_name: null,
    is_linked_to_client: false,
    custom_attributes: [],
    is_private: false,
    internal_notes: [],
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

  const service = new ChatService(pool as any, async () => {});

  const page = await service.getMessages('conv-2', null, 2);

  assert.equal(page.messages.length, 2);
  assert.equal(page.messages[0]!.id, 'msg-2');
  assert.equal(page.messages[1]!.id, 'msg-3');
  assert.equal(page.nextCursor, page.messages[0]!.timestamp);
});

test('ChatService.createConversation validates payload', async () => {
  const pool = new FakePool([]);
  const service = new ChatService(pool as any, async () => {});

  await assert.rejects(() => service.createConversation({ contactIdentifier: '' }), ValidationError);
});

test('ChatService.listKnownSessions returns distinct, trimmed session identifiers', async () => {
  const pool = new FakePool([
    {
      rows: [
        { session_id: 'SessionA' },
        { session_id: '  SessionB  ' },
        { session_id: null },
        { session_id: 'SessionA' },
      ],
      rowCount: 4,
    },
  ]);

  const service = new ChatService(pool as any, async () => {});
  const sessions = await service.listKnownSessions();

  assert.deepEqual(sessions, ['SessionA', 'SessionB']);
});

test('ChatService.updateConversation updates metadata fields', async () => {
  const updatedRow = {
    id: 'conv-10',
    contact_identifier: '5511999000000',
    contact_name: 'Contato',
    contact_avatar: null,
    short_status: 'Ativo',
    description: null,
    pinned: false,
    phone_number: null,
    responsible_id: 7,
    responsible_snapshot: {
      id: '7',
      name: 'Ana Souza',
      role: 'Advogada',
      avatar: 'data:image/svg+xml;utf8,avatar',
    },
    tags: ['Lead', 'VIP'],
    client_name: 'Empresa X',
    is_linked_to_client: true,
    custom_attributes: [{ id: 'attr-1', label: 'Origem', value: 'Site' }],
    is_private: true,
    internal_notes: [
      { id: 'note-1', author: 'Você', content: 'Teste', createdAt: '2024-01-02T10:00:00.000Z' },
    ],
    unread_count: 0,
    last_message_id: null,
    last_message_preview: null,
    last_message_timestamp: null,
    last_message_sender: null,
    last_message_type: null,
    last_message_status: null,
    metadata: null,
    created_at: '2024-01-01T00:00:00.000Z',
    updated_at: '2024-01-02T00:00:00.000Z',
  };

  const pool = new FakePool([
    { rows: [{ id: 7, nome_completo: 'Ana Souza', perfil: 'Advogada' }], rowCount: 1 },
    { rows: [updatedRow], rowCount: 1 },
  ]);

  const service = new ChatService(pool as any, async () => {});

  const updated = await service.updateConversation('conv-10', {
    responsibleId: 7,
    tags: ['VIP', 'Lead'],
    clientName: 'Empresa X',
    isLinkedToClient: true,
    customAttributes: [{ id: 'attr-1', label: 'Origem', value: 'Site' }],
    isPrivate: true,
    internalNotes: [
      { id: 'note-1', author: 'Você', content: 'Teste', createdAt: '2024-01-02T10:00:00Z' },
    ],
  });

  assert.equal(pool.calls.length, 2);
  assert.match(
    pool.calls[0]!.text ?? '',
    /FROM public\.(?:"vw\.usuarios"|vw_usuarios)/
  );
  assert.match(pool.calls[1]!.text ?? '', /UPDATE chat_conversations/);
  assert.equal(updated?.responsible?.id, '7');
  assert.deepEqual(updated?.tags, ['Lead', 'VIP']);
  assert.equal(updated?.clientName, 'Empresa X');
  assert.equal(updated?.isLinkedToClient, true);
  assert.equal(updated?.isPrivate, true);
  assert.equal(updated?.customAttributes?.length, 1);
  assert.equal(updated?.internalNotes?.length, 1);
});
