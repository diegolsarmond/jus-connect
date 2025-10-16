import test, { type TestContext } from 'node:test';
import assert from 'node:assert';
import pool from '../src/services/db';
import notificationService = require('../src/services/notificationService');
import {
  notifyIntimacaoSyncTargets,
  __setCreateNotificationHandler,
  __resetCreateNotificationHandler,
} from '../src/services/intimacaoSyncTargetNotifier';

type QueryResultRow = Record<string, unknown>;

const integrationRow = { url_api: 'https://integration.local', active: true };

const targetRows: QueryResultRow[] = [
  {
    usuario_id: 'admin-1',
    usuario_nome: 'Admin',
    nome_empresa: 'Empresa Teste',
  },
  {
    usuario_id: null,
  },
];

const mockQuery = (implementation: (text: string) => Promise<{ rows: QueryResultRow[] }>) =>
  test.mock.method(pool, 'query', implementation as unknown as typeof pool.query);

type CreateNotificationInput = Parameters<
  typeof notificationService.createNotification
>[0];

const mockCreateNotification = (t: TestContext) => {
  const calls: CreateNotificationInput[] = [];
  const replacement = async (input: CreateNotificationInput) => {
    calls.push(input);
    return {
      id: 'ntf-1',
      userId: input.userId,
      category: input.category,
      type: input.type ?? 'info',
      title: input.title,
      message: input.message,
      read: false,
      createdAt: new Date().toISOString(),
    };
  };

  __setCreateNotificationHandler(replacement);

  t.after(() => {
    __resetCreateNotificationHandler();
  });

  return { calls };
};

test('emite notificações quando fetch não está disponível', async (t) => {
  const originalFetch = (globalThis as { fetch?: typeof fetch }).fetch;
  (globalThis as { fetch?: typeof fetch }).fetch = undefined;

  const queryMock = mockQuery(async (text) => {
    if (text.includes('FROM public.integration_api_keys')) {
      return { rows: [integrationRow] };
    }

    return { rows: targetRows };
  });

  const notificationMock = mockCreateNotification(t);

  t.after(() => {
    queryMock.mock.restore();
    (globalThis as { fetch?: typeof fetch }).fetch = originalFetch;
  });

  await notifyIntimacaoSyncTargets(10, 'intimacoes.sync.targets');

  assert.strictEqual(notificationMock.calls.length, 1);
  const [call] = notificationMock.calls;
  assert.ok(call);
  assert.strictEqual(call?.category, 'sync');
  assert.strictEqual(call?.type, 'error');
  assert.match(call?.message ?? '', /Revise a integração/);
});

test('emite notificações quando a resposta da integração falha', async (t) => {
  const originalFetch = (globalThis as { fetch?: typeof fetch }).fetch;
  (globalThis as { fetch?: typeof fetch }).fetch = async () =>
    ({ ok: false, status: 500, statusText: 'Erro interno' } as Response);

  const queryMock = mockQuery(async (text) => {
    if (text.includes('FROM public.integration_api_keys')) {
      return { rows: [integrationRow] };
    }

    return { rows: targetRows };
  });

  const notificationMock = mockCreateNotification(t);

  t.after(() => {
    queryMock.mock.restore();
    (globalThis as { fetch?: typeof fetch }).fetch = originalFetch;
  });

  await notifyIntimacaoSyncTargets(10, 'intimacoes.sync.targets');

  assert.strictEqual(notificationMock.calls.length, 1);
  const [call] = notificationMock.calls;
  assert.strictEqual(call?.metadata?.eventType, 'intimacoes.sync.targets');
});

test('emite notificações quando a chamada da integração lança erro', async (t) => {
  const originalFetch = (globalThis as { fetch?: typeof fetch }).fetch;
  (globalThis as { fetch?: typeof fetch }).fetch = async () => {
    throw new Error('Indisponível');
  };

  const queryMock = mockQuery(async (text) => {
    if (text.includes('FROM public.integration_api_keys')) {
      return { rows: [integrationRow] };
    }

    return { rows: targetRows };
  });

  const notificationMock = mockCreateNotification(t);

  t.after(() => {
    queryMock.mock.restore();
    (globalThis as { fetch?: typeof fetch }).fetch = originalFetch;
  });

  await notifyIntimacaoSyncTargets(10, 'intimacoes.sync.targets');

  assert.strictEqual(notificationMock.calls.length, 1);
  const [call] = notificationMock.calls;
  assert.strictEqual(call?.title, 'Falha na sincronização');
});
