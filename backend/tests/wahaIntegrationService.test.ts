import assert from 'node:assert/strict';
import test from 'node:test';
import WahaIntegrationService, { IntegrationNotConfiguredError } from '../src/services/wahaIntegrationService';
import { ValidationError as ConfigValidationError } from '../src/services/wahaConfigService';
import ChatService, { ConversationDetails, ValidationError as ChatValidationError } from '../src/services/chatService';

interface HttpResponse<T = unknown> {
  status: number;
  headers: Record<string, string>;
  data: T;
}

test('listChats consulta o WAHA e retorna conversas normalizadas', async () => {
  const ensureCalls: any[] = [];

  class FakeChatService {
    async listKnownSessions(): Promise<string[]> {
      return [];
    }

    async ensureConversation(input: any): Promise<ConversationDetails> {
      ensureCalls.push(input);
      return {
        id: input.id,
        name: input.contactName ?? input.id,
        avatar: input.avatar ?? 'avatar',
        shortStatus: input.shortStatus ?? 'Disponível',
        description: input.description ?? undefined,
        unreadCount: 0,
        pinned: false,
        lastMessage: undefined,
        contactIdentifier: input.contactIdentifier,
        metadata: input.metadata ?? {},
        createdAt: new Date('2024-01-01T00:00:00.000Z').toISOString(),
        updatedAt: new Date('2024-01-01T00:00:00.000Z').toISOString(),
      };
    }
  }

  class FakeConfigService {
    async requireConfig() {
      return {
        baseUrl: 'https://waha.example.com',
        apiKey: 'secret',
        webhookSecret: null,
        isActive: true,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
    }
  }

  class FakeHttpClient {
    public readonly urls: string[] = [];

    async request<T = unknown>(url: string): Promise<HttpResponse<T>> {
      this.urls.push(url);
      return {
        status: 200,
        headers: {},
        data: {
          data: [
            {
              id: '553193624545@c.us',
              name: 'Diego',
              unreadCount: 3,
              lastMessage: {
                id: { _serialized: 'msg-1' },
                body: 'Olá',
                messageTimestamp: 1_758_066_389,
                fromMe: false,
                type: 'text',
                ack: 2,
              },
            },
          ],
        } as T,
      };
    }
  }

  const httpClient = new FakeHttpClient();

  const service = new WahaIntegrationService(
    new FakeChatService() as unknown as ChatService,
    new FakeConfigService() as any,
    httpClient as any,
  );

  const conversations = await service.listChats({ sessionId: 'QuantumTecnologia01', limit: 10 });

  assert.equal(conversations.length, 1);
  assert.equal(conversations[0]!.id, '553193624545@c.us');
  assert.equal(conversations[0]!.name, 'Diego');
  assert.equal(conversations[0]!.unreadCount, 3);
  if (conversations[0]!.lastMessage) {
    assert.equal(conversations[0]!.lastMessage!.content, 'Olá');
  }

  assert.equal(ensureCalls.length, 1);
  assert.deepEqual(ensureCalls[0]!.metadata, {
    provider: 'waha',
    chatId: '553193624545@c.us',
    session: 'QuantumTecnologia01',
  });

  assert.deepEqual(httpClient.urls, ['https://waha.example.com/api/QuantumTecnologia01/chats?limit=10']);
});

test('listChats lança erro quando integração não está configurada', async () => {
  class FakeConfigService {
    async requireConfig(): Promise<never> {
      throw new ConfigValidationError('WAHA integration is disabled');
    }
  }

  const service = new WahaIntegrationService(
    new ChatService(
      {
        async query() {
          return { rows: [], rowCount: 0 };
        },
      } as any,
      async () => {},
    ),
    new FakeConfigService() as any,
    {
      async request() {
        throw new Error('should not call');
      },
    } as any,
  );

  await assert.rejects(() => service.listChats({ sessionId: 'any' }), IntegrationNotConfiguredError);
});

test('listChats exige sessão quando não há dados disponíveis', async () => {
  class FakeChatService {
    async listKnownSessions(): Promise<string[]> {
      return [];
    }

    async ensureConversation(): Promise<ConversationDetails> {
      throw new Error('should not ensure');
    }
  }

  class FakeConfigService {
    async requireConfig() {
      return {
        baseUrl: 'https://waha.example.com',
        apiKey: 'secret',
        webhookSecret: null,
        isActive: true,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
    }
  }

  class FakeHttpClient {
    async request() {
      return { status: 200, headers: {}, data: [] };
    }
  }

  const service = new WahaIntegrationService(
    new FakeChatService() as any,
    new FakeConfigService() as any,
    new FakeHttpClient() as any,
  );

  await assert.rejects(() => service.listChats(), ChatValidationError);
});
