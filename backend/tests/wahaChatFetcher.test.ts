import assert from 'node:assert/strict';
import { afterEach, beforeEach, describe, it } from 'node:test';
import { listWahaConversations } from '../src/services/wahaChatFetcher';

const LOGGER: Pick<Console, 'log' | 'warn' | 'error'> = {
  log: () => {},
  warn: () => {},
  error: () => {},
};

const ENV_KEYS = ['WAHA_BASE_URL', 'WAHA_TOKEN', 'WAHA_SESSION', 'WAHA_SESSION_ID', 'WAHA_DEFAULT_SESSION'] as const;

describe('wahaChatFetcher', () => {
  const originalEnv: Partial<Record<(typeof ENV_KEYS)[number], string | undefined>> = {};
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    for (const key of ENV_KEYS) {
      originalEnv[key] = process.env[key];
      delete process.env[key];
    }
  });

  afterEach(() => {
    for (const key of ENV_KEYS) {
      const value = originalEnv[key];
      if (value === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = value;
      }
    }
    globalThis.fetch = originalFetch;
  });

  it('normalizes base url with version suffix and applies configured session', async () => {
    process.env.WAHA_BASE_URL = 'https://waha.example.com/api/v1/';
    process.env.WAHA_TOKEN = 'token';
    process.env.WAHA_SESSION = 'QuantumTecnologia01';

    const requestedUrls: string[] = [];

    globalThis.fetch = (async (input: any) => {
      const url = typeof input === 'string' ? input : input?.toString?.() ?? String(input);
      requestedUrls.push(url);

      return {
        ok: true,
        status: 200,
        text: async () =>
          JSON.stringify([
            {
              id: 'abc123',
              name: 'Tester',
              photoUrl: 'https://cdn.example.com/avatar.png',
            },
          ]),
      } as any;
    }) as typeof fetch;

    const conversations = await listWahaConversations(LOGGER);

    assert.deepEqual(conversations, [
      {
        conversation_id: 'abc123',
        contact_name: 'Tester',
        photo_url: 'https://cdn.example.com/avatar.png',
      },
    ]);

    assert(
      requestedUrls.includes('https://waha.example.com/api/QuantumTecnologia01/chats'),
      'expected chats endpoint to include configured session',
    );

    assert(
      !requestedUrls.some((url) => url.includes('/api/v1/api/')),
      'should not duplicate API path segments when normalizing base url',
    );
  });

  it('falls back to legacy endpoints when WAHA reports missing session', async () => {
    process.env.WAHA_BASE_URL = 'https://waha.example.com/';
    process.env.WAHA_TOKEN = 'token';

    const requestedUrls: string[] = [];

    globalThis.fetch = (async (input: any) => {
      const url = typeof input === 'string' ? input : input?.toString?.() ?? String(input);
      requestedUrls.push(url);

      if (url.endsWith('/api/v1/chats')) {
        return {
          ok: false,
          status: 422,
          text: async () =>
            JSON.stringify({ error: 'Session "v1" does not exist', session: 'v1' }),
        } as any;
      }

      return {
        ok: true,
        status: 200,
        text: async () =>
          JSON.stringify([
            {
              chatId: 'abc123',
              contactName: 'Tester',
            },
          ]),
      } as any;
    }) as typeof fetch;

    const conversations = await listWahaConversations(LOGGER);

    assert.deepEqual(conversations, [
      {
        conversation_id: 'abc123',
        contact_name: 'Tester',
        photo_url: null,
      },
    ]);

    assert(requestedUrls.some((url) => url.endsWith('/api/v1/chats')));
    assert(requestedUrls.some((url) => url.endsWith('/api/chats')));
  });
});
