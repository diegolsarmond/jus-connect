import assert from 'node:assert/strict';
import test from 'node:test';

process.env.NODE_ENV = 'test';
process.env.AUTH_TOKEN_SECRET = 'test-secret';

const indexModulePromise = import('../src/index');

test('initializeStorage ignora erros de conexão conhecidos', async () => {
  const { initializeStorage } = await indexModulePromise;
  const calls: string[] = [];
  const connectionError = Object.assign(new Error('ECONNREFUSED'), {
    code: 'ECONNREFUSED' as const,
  });
  const initializers = [
    async () => {
      calls.push('primeiro');
      throw connectionError;
    },
    async () => {
      calls.push('segundo');
    },
  ];

  await initializeStorage(initializers);

  assert.deepEqual(calls, ['primeiro', 'segundo']);
});

test('initializeStorage relança erros não relacionados à conexão', async () => {
  const { initializeStorage } = await indexModulePromise;
  const fatal = new Error('falha genérica');
  const initializers = [
    async () => {
      throw fatal;
    },
  ];

  await assert.rejects(() => initializeStorage(initializers), fatal);
});
