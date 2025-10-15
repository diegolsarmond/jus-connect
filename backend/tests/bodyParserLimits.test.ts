import assert from 'node:assert/strict';
import { once } from 'node:events';
import { test } from 'node:test';
import type { AddressInfo } from 'node:net';
import type { Server } from 'node:http';

process.env.NODE_ENV = 'test';
process.env.AUTH_TOKEN_SECRET ??= 'test-secret';
process.env.SKIP_CHAT_SCHEMA = 'true';

async function startTestServer(): Promise<{ server: Server; baseUrl: string }> {
  process.env.NODE_ENV = 'test';
  process.env.AUTH_TOKEN_SECRET ??= 'test-secret';

  const { app } = await import('../src/index');
  const server = app.listen(0);
  await once(server, 'listening');
  const port = (server.address() as AddressInfo).port;
  const baseUrl = `http://127.0.0.1:${port}`;
  return { server, baseUrl };
}

test('limites de payload JSON são aplicados corretamente', async (t) => {
  const { server, baseUrl } = await startTestServer();
  t.after(async () => {
    await new Promise<void>((resolve, reject) => {
      server.close((error) => {
        if (error) {
          reject(error);
          return;
        }
        resolve();
      });
    });
  });

  const smallResponse = await fetch(`${baseUrl}/__test__/echo`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ mensagem: 'ok' }),
  });
  assert.equal(smallResponse.status, 200);
  const smallBody = (await smallResponse.json()) as { body: unknown };
  assert.deepEqual(smallBody.body, { mensagem: 'ok' });

  const largePayload = 'a'.repeat(1024 * 1024);
  const blockedResponse = await fetch(`${baseUrl}/__test__/echo`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ data: largePayload }),
  });
  assert.equal(blockedResponse.status, 413);

  const largeSupportAttachment = 'a'.repeat(2 * 1024 * 1024);
  const supportResponse = await fetch(`${baseUrl}/api/support/123/messages`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-test-bypass': 'true',
    },
    body: JSON.stringify({ attachments: [{ data: largeSupportAttachment }] }),
  });
  assert.equal(supportResponse.status, 200);
  const supportBody = (await supportResponse.json()) as { size: number };
  assert.ok(supportBody.size > 1024 * 1024);

  const largeDocumentoPayload = 'b'.repeat(2 * 1024 * 1024);
  const documentoResponse = await fetch(`${baseUrl}/api/clientes/1/documentos`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-test-bypass': 'true',
    },
    body: JSON.stringify({ arquivo_base64: largeDocumentoPayload }),
  });
  assert.equal(documentoResponse.status, 200);
  const documentoBody = (await documentoResponse.json()) as { size: number };
  assert.ok(documentoBody.size > 1024 * 1024);
});
