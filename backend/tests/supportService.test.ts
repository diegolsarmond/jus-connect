import assert from 'node:assert/strict';
import test from 'node:test';
import SupportService, {
  CreateSupportRequestInput,
  SupportRequest,
  SupportStatus,
  ValidationError,
} from '../src/services/supportService';

type QueryCall = { text: string; values?: unknown[] };
type QueryResponse = { rows: any[]; rowCount: number };

class FakePool {
  public readonly calls: QueryCall[] = [];

  constructor(private readonly responses: QueryResponse[] = []) {}

  async query(text: string, values?: unknown[]) {
    this.calls.push({ text, values });
    if (this.responses.length === 0) {
      throw new Error('No response configured for query');
    }
    return this.responses.shift()!;
  }
}

test('SupportService.create normalizes payload and returns persisted request', async () => {
  const insertedRow = {
    id: 1,
    subject: 'Test subject',
    description: 'Detailed description',
    status: 'open' as SupportStatus,
    requester_name: 'Maria',
    requester_email: 'maria@example.com',
    created_at: '2024-01-01T00:00:00.000Z',
    updated_at: '2024-01-01T00:00:00.000Z',
  };

  const pool = new FakePool([
    { rows: [insertedRow], rowCount: 1 },
  ]);

  const service = new SupportService(pool as any);

  const payload: CreateSupportRequestInput = {
    subject: '  Test subject  ',
    description: '\nDetailed description  ',
    requesterName: ' Maria ',
    requesterEmail: ' maria@example.com ',
  };

  const result = await service.create(payload);

  assert.equal(pool.calls.length, 1);
  const call = pool.calls[0];
  assert.match(call.text, /INSERT INTO support_requests/i);
  assert.deepEqual(call.values, [
    'Test subject',
    'Detailed description',
    'open',
    'Maria',
    'maria@example.com',
  ]);

  const expected: SupportRequest = {
    id: 1,
    subject: 'Test subject',
    description: 'Detailed description',
    status: 'open',
    requesterName: 'Maria',
    requesterEmail: 'maria@example.com',
    createdAt: '2024-01-01T00:00:00.000Z',
    updatedAt: '2024-01-01T00:00:00.000Z',
  };

  assert.deepEqual(result, expected);
});

test('SupportService.create validates required fields', async () => {
  const pool = new FakePool([]);
  const service = new SupportService(pool as any);

  await assert.rejects(
    () => service.create({ subject: '   ', description: 'valid' }),
    ValidationError,
  );

  await assert.rejects(
    () => service.create({ subject: 'Valid', description: '' }),
    ValidationError,
  );
});

test('SupportService.list applies filters and pagination', async () => {
  const rows = [
    {
      id: 10,
      subject: 'First issue',
      description: 'Pending issue',
      status: 'resolved' as SupportStatus,
      requester_name: null,
      requester_email: 'client@example.com',
      created_at: '2024-01-02T12:00:00.000Z',
      updated_at: '2024-01-03T12:00:00.000Z',
    },
  ];

  const pool = new FakePool([
    { rows, rowCount: rows.length },
    { rows: [{ total: '5' }], rowCount: 1 },
  ]);

  const service = new SupportService(pool as any);

  const result = await service.list({
    status: 'resolved',
    search: 'issue',
    page: 2,
    pageSize: 5,
  });

  assert.equal(pool.calls.length, 2);

  const [listQuery, countQuery] = pool.calls;
  assert.match(listQuery.text, /SELECT id, subject, description, status/);
  assert.ok(listQuery.text.includes('ORDER BY created_at DESC'));
  assert.ok(listQuery.text.includes('LIMIT $3'));
  assert.deepEqual(listQuery.values, ['resolved', '%issue%', 5, 5]);

  assert.match(countQuery.text, /SELECT COUNT\(\*\)::int AS total FROM support_requests/);
  assert.deepEqual(countQuery.values, ['resolved', '%issue%']);

  assert.equal(result.total, 5);
  assert.equal(result.page, 2);
  assert.equal(result.pageSize, 5);
  assert.equal(result.items.length, 1);
  assert.equal(result.items[0].id, 10);
  assert.equal(result.items[0].status, 'resolved');
});

test('SupportService.listMessagesForRequest returns conversation history with attachments', async () => {
  const pool = new FakePool([
    { rows: [{}], rowCount: 1 },
    {
      rows: [
        {
          id: 1,
          support_request_id: 42,
          sender: 'requester',
          message: 'Olá',
          created_at: '2024-02-01T12:00:00.000Z',
        },
      ],
      rowCount: 1,
    },
    {
      rows: [
        {
          id: 99,
          message_id: 1,
          filename: 'comprovante.pdf',
          content_type: 'application/pdf',
          file_size: 5120,
          created_at: '2024-02-01T12:05:00.000Z',
        },
      ],
      rowCount: 1,
    },
  ]);

  const service = new SupportService(pool as any);

  const messages = await service.listMessagesForRequest(42);

  assert.ok(messages);
  assert.equal(messages?.length, 1);
  assert.equal(messages?.[0].id, 1);
  assert.equal(messages?.[0].attachments.length, 1);
  assert.equal(messages?.[0].attachments[0]?.filename, 'comprovante.pdf');

  assert.equal(pool.calls.length, 3);
  assert.match(pool.calls[0].text ?? '', /SELECT 1 FROM support_requests/i);
  assert.match(pool.calls[1].text ?? '', /FROM support_request_messages/i);
  assert.match(pool.calls[2].text ?? '', /FROM support_request_attachments/i);
  assert.deepEqual(pool.calls[2].values, [[1]]);
});

test('SupportService.listMessagesForRequest returns null when request is missing', async () => {
  const pool = new FakePool([{ rows: [], rowCount: 0 }]);
  const service = new SupportService(pool as any);

  const result = await service.listMessagesForRequest(99);

  assert.equal(result, null);
  assert.equal(pool.calls.length, 1);
  assert.match(pool.calls[0].text ?? '', /SELECT 1 FROM support_requests/i);
});

test('SupportService.createMessage persists message and attachments', async () => {
  const messageRow = {
    id: 3,
    support_request_id: 5,
    sender: 'requester',
    message: 'Oi',
    created_at: '2024-02-02T09:00:00.000Z',
  };

  const attachmentRow = {
    id: 7,
    message_id: 3,
    filename: 'relatorio.pdf',
    content_type: 'application/pdf',
    file_size: 2048,
    created_at: '2024-02-02T09:05:00.000Z',
  };

  const pool = new FakePool([
    { rows: [{}], rowCount: 1 },
    { rows: [messageRow], rowCount: 1 },
    { rows: [attachmentRow], rowCount: 1 },
    { rows: [], rowCount: 0 },
  ]);

  const service = new SupportService(pool as any);

  const buffer = Buffer.from('conteudo');

  const created = await service.createMessage(5, {
    message: '  Oi  ',
    attachments: [
      {
        filename: ' relatorio.pdf ',
        contentType: 'application/pdf',
        size: buffer.length,
        content: buffer,
      },
    ],
  });

  assert.ok(created);
  assert.equal(created?.id, 3);
  assert.equal(created?.attachments.length, 1);
  assert.equal(created?.attachments[0]?.filename, 'relatorio.pdf');

  assert.equal(pool.calls.length, 4);
  assert.match(pool.calls[0].text ?? '', /SELECT 1 FROM support_requests/i);
  assert.match(pool.calls[1].text ?? '', /INSERT INTO support_request_messages/i);
  assert.deepEqual(pool.calls[1].values, [5, 'requester', 'Oi']);
  assert.match(pool.calls[2].text ?? '', /INSERT INTO support_request_attachments/i);
  assert.equal(pool.calls[2].values?.[1], 'relatorio.pdf');
  assert.equal(pool.calls[2].values?.[2], 'application/pdf');
  assert.equal(pool.calls[2].values?.[3], buffer.length);
  assert.ok(Buffer.isBuffer(pool.calls[2].values?.[4]));
  assert.match(pool.calls[3].text ?? '', /UPDATE support_requests/i);
  assert.deepEqual(pool.calls[3].values, [5]);
});

test('SupportService.createMessage enforces message or attachment requirement', async () => {
  const pool = new FakePool([{ rows: [{}], rowCount: 1 }]);
  const service = new SupportService(pool as any);

  await assert.rejects(() => service.createMessage(1, { message: '   ' }), ValidationError);
});

test('SupportService.createMessage returns null when support request is missing', async () => {
  const pool = new FakePool([{ rows: [], rowCount: 0 }]);
  const service = new SupportService(pool as any);

  const result = await service.createMessage(123, { message: 'Hello' });

  assert.equal(result, null);
  assert.equal(pool.calls.length, 1);
  assert.match(pool.calls[0].text ?? '', /SELECT 1 FROM support_requests/i);
});

test('SupportService.update builds dynamic query and handles not found', async () => {
  const updatedRow = {
    id: 7,
    subject: 'Updated subject',
    description: 'Updated description',
    status: 'in_progress' as SupportStatus,
    requester_name: null,
    requester_email: null,
    created_at: '2024-01-05T10:00:00.000Z',
    updated_at: '2024-01-05T11:00:00.000Z',
  };

  const pool = new FakePool([
    { rows: [updatedRow], rowCount: 1 },
    { rows: [], rowCount: 0 },
  ]);

  const service = new SupportService(pool as any);

  const updated = await service.update(7, {
    subject: ' Updated subject ',
    description: 'Updated description',
    status: 'in_progress',
    requesterName: '   ',
    requesterEmail: null,
  });

  assert.ok(pool.calls[0].text.startsWith('UPDATE support_requests'));
  assert.deepEqual(pool.calls[0].values, [
    'Updated subject',
    'Updated description',
    'in_progress',
    null,
    null,
    7,
  ]);
  assert.equal(updated?.id, 7);
  assert.equal(updated?.status, 'in_progress');
  assert.equal(updated?.requesterName, null);

  const notFound = await service.update(99, { status: 'resolved' });
  assert.equal(pool.calls.length, 2);
  assert.deepEqual(pool.calls[1].values, ['resolved', 99]);
  assert.equal(notFound, null);
});

test('SupportService.update requires at least one field', async () => {
  const pool = new FakePool([]);
  const service = new SupportService(pool as any);

  await assert.rejects(() => service.update(1, {}), ValidationError);
});

