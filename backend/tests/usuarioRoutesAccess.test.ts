import assert from 'node:assert/strict';
import { once } from 'node:events';
import { test } from 'node:test';
import type { AddressInfo } from 'node:net';
import type { Server } from 'node:http';
import {
  __resetFetchUserModulesForTests,
  __setFetchUserModulesForTests,
  invalidateAllUserModulesCache,
} from '../src/middlewares/moduleAuthorization';
import { signToken } from '../src/utils/tokenUtils';

process.env.NODE_ENV = 'test';
process.env.AUTH_TOKEN_SECRET ??= 'test-secret';
process.env.SKIP_CHAT_SCHEMA = 'true';

const startTestServer = async (): Promise<{ server: Server; baseUrl: string }> => {
  const { app } = await import('../src/index');
  const server = app.listen(0);
  await once(server, 'listening');
  const port = (server.address() as AddressInfo).port;
  return { server, baseUrl: `http://127.0.0.1:${port}` };
};

const closeServer = async (server: Server) =>
  new Promise<void>((resolve, reject) => {
    server.close((error) => {
      if (error) {
        reject(error);
        return;
      }

      resolve();
    });
  });

const createAuthHeader = (userId: number) => {
  const token = signToken({ sub: userId }, process.env.AUTH_TOKEN_SECRET!, 60);
  return { Authorization: `Bearer ${token}` };
};

const setupModuleMock = (modules: string[]) => {
  invalidateAllUserModulesCache();
  __setFetchUserModulesForTests(async () => modules);
};

test('GET /api/usuarios retorna 403 quando o usuário não possui o módulo necessário', async (t) => {
  setupModuleMock([]);
  const { server, baseUrl } = await startTestServer();

  t.after(async () => {
    await closeServer(server);
    __resetFetchUserModulesForTests();
    invalidateAllUserModulesCache();
  });

  const response = await fetch(`${baseUrl}/api/usuarios`, {
    headers: createAuthHeader(101),
  });

  assert.equal(response.status, 403);
  const body = (await response.json()) as { error?: string };
  assert.equal(body.error, 'Acesso negado.');
});

test('GET /api/v1/usuarios retorna 403 quando o usuário não possui o módulo necessário', async (t) => {
  setupModuleMock([]);
  const { server, baseUrl } = await startTestServer();

  t.after(async () => {
    await closeServer(server);
    __resetFetchUserModulesForTests();
    invalidateAllUserModulesCache();
  });

  const response = await fetch(`${baseUrl}/api/v1/usuarios`, {
    headers: createAuthHeader(202),
  });

  assert.equal(response.status, 403);
  const body = (await response.json()) as { error?: string };
  assert.equal(body.error, 'Acesso negado.');
});
