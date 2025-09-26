import assert from 'node:assert/strict';
import test from 'node:test';
import type { Request, Response } from 'express';

import * as integrationApiKeyServiceModule from '../src/services/integrationApiKeyService';
import * as integrationApiKeyValidationServiceModule from '../src/services/integrationApiKeyValidationService';
import dbPool from '../src/services/db';
import cronJobs from '../src/services/cronJobs';
import juditProcessService from '../src/services/juditProcessService';

type IntegrationApiKeyServiceCtor = typeof import('../src/services/integrationApiKeyService').default;
type IntegrationApiKeyValidationServiceCtor =
  typeof import('../src/services/integrationApiKeyValidationService').default;

function resolveModuleDefault<T>(module: T): any {
  if (module && typeof module === 'object' && 'default' in (module as Record<string, unknown>)) {
    const next = (module as any).default;
    if (next !== module) {
      return resolveModuleDefault(next);
    }
  }
  return module;
}

const IntegrationApiKeyService = resolveModuleDefault(
  integrationApiKeyServiceModule,
) as IntegrationApiKeyServiceCtor;
const IntegrationApiKeyValidationService = resolveModuleDefault(
  integrationApiKeyValidationServiceModule,
) as IntegrationApiKeyValidationServiceCtor;

process.env.DATABASE_URL ??= 'postgresql://user:pass@localhost:5432/testdb';

let listIntegrationApiKeys: typeof import('../src/controllers/integrationApiKeyController')['listIntegrationApiKeys'];
let getIntegrationApiKey: typeof import('../src/controllers/integrationApiKeyController')['getIntegrationApiKey'];
let createIntegrationApiKey: typeof import('../src/controllers/integrationApiKeyController')['createIntegrationApiKey'];
let updateIntegrationApiKey: typeof import('../src/controllers/integrationApiKeyController')['updateIntegrationApiKey'];
let deleteIntegrationApiKey: typeof import('../src/controllers/integrationApiKeyController')['deleteIntegrationApiKey'];
let validateAsaasIntegration: typeof import('../src/controllers/integrationApiKeyController')['validateAsaasIntegration'];

test.before(async () => {
  ({
    listIntegrationApiKeys,
    getIntegrationApiKey,
    createIntegrationApiKey,
    updateIntegrationApiKey,
    deleteIntegrationApiKey,
    validateAsaasIntegration,
  } = await import('../src/controllers/integrationApiKeyController'));
});

const createMockResponse = () => {
  const response: Partial<Response> & { statusCode: number; body: unknown } = {
    statusCode: 200,
    body: undefined,
    status(code: number) {
      this.statusCode = code;
      return this as Response;
    },
    json(payload: unknown) {
      this.body = payload;
      return this as Response;
    },
    send(payload?: unknown) {
      this.body = payload;
      return this as Response;
    },
  };

  return response as Response & { statusCode: number; body: unknown };
};

const createAuth = (userId: number) => ({
  userId,
  payload: {
    sub: userId,
    iat: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + 3600,
  },
});

function patchMethod<T extends object, K extends keyof T>(
  target: T,
  key: K,
  implementation: T[K],
): () => void {
  const original = target[key];
  (target as any)[key] = implementation;
  return () => {
    (target as any)[key] = original;
  };
}

test('listIntegrationApiKeys returns scoped results for authenticated empresa', async () => {
  const restoreQuery = patchMethod(
    dbPool,
    'query',
    (async () => ({ rows: [{ empresa: 77 }], rowCount: 1 })) as typeof dbPool.query,
  );

  const restoreList = patchMethod(
    IntegrationApiKeyService.prototype,
    'list',
    (async function (this: InstanceType<IntegrationApiKeyServiceCtor>, options: { empresaId: number }) {
      assert.equal(options.empresaId, 77);
      return [
        {
          id: 1,
          provider: 'openai',
          apiUrl: 'https://api.openai.com/v1',
          key: 'sk_live',
          environment: 'producao',
          active: true,
          lastUsed: null,
          empresaId: 77,
          global: false,
          createdAt: '2024-01-01T00:00:00.000Z',
          updatedAt: '2024-01-02T00:00:00.000Z',
        },
      ];
    }) as IntegrationApiKeyServiceCtor['prototype']['list'],
  );

  const req = {
    auth: createAuth(5),
    params: {},
    body: {},
  } as unknown as Request;
  const res = createMockResponse();

  await listIntegrationApiKeys(req, res);

  assert.equal(res.statusCode, 200);
  assert.ok(Array.isArray(res.body));
  assert.equal((res.body as unknown[]).length, 1);

  restoreQuery();
  restoreList();
});

test('getIntegrationApiKey returns 404 when record not found for empresa', async () => {
  const restoreQuery = patchMethod(
    dbPool,
    'query',
    (async () => ({ rows: [{ empresa: 50 }], rowCount: 1 })) as typeof dbPool.query,
  );

  const restoreFind = patchMethod(
    IntegrationApiKeyService.prototype,
    'findById',
    (async () => null) as IntegrationApiKeyServiceCtor['prototype']['findById'],
  );

  const req = {
    auth: createAuth(8),
    params: { id: '10' },
    body: {},
  } as unknown as Request;
  const res = createMockResponse();

  await getIntegrationApiKey(req, res);

  assert.equal(res.statusCode, 404);
  assert.deepEqual(res.body, { error: 'API key not found' });

  restoreQuery();
  restoreFind();
});

test('createIntegrationApiKey rejects when user lacks empresa association', async () => {
  const restoreQuery = patchMethod(
    dbPool,
    'query',
    (async () => ({ rows: [{ empresa: null }], rowCount: 1 })) as typeof dbPool.query,
  );

  const restoreCreate = patchMethod(
    IntegrationApiKeyService.prototype,
    'create',
    (async () => {
      throw new Error('should not be called');
    }) as IntegrationApiKeyServiceCtor['prototype']['create'],
  );

  const req = {
    auth: createAuth(3),
    params: {},
    body: { provider: 'openai', key: 'sk', environment: 'producao' },
  } as unknown as Request;
  const res = createMockResponse();

  await createIntegrationApiKey(req, res);

  assert.equal(res.statusCode, 400);
  assert.deepEqual(res.body, { error: 'Usuário não está vinculado a uma empresa.' });

  restoreQuery();
  restoreCreate();
});

test('createIntegrationApiKey passes empresa scope to service and triggers refresh', async () => {
  const restoreQuery = patchMethod(
    dbPool,
    'query',
    (async () => ({ rows: [{ empresa: 91 }], rowCount: 1 })) as typeof dbPool.query,
  );

  let invalidateCalls = 0;
  const restoreInvalidate = patchMethod(
    juditProcessService,
    'invalidateConfigurationCache',
    (() => {
      invalidateCalls += 1;
    }) as typeof juditProcessService.invalidateConfigurationCache,
  );
  let refreshCalls = 0;
  const restoreRefresh = patchMethod(
    cronJobs,
    'refreshJuditIntegration',
    (async () => {
      refreshCalls += 1;
    }) as typeof cronJobs.refreshJuditIntegration,
  );

  const restoreCreate = patchMethod(
    IntegrationApiKeyService.prototype,
    'create',
    (async (input: Parameters<IntegrationApiKeyServiceCtor['prototype']['create']>[0]) => {
      assert.equal(input.empresaId, 91);
      return {
        id: 12,
        provider: input.provider,
        apiUrl: input.apiUrl ?? null,
        key: input.key,
        environment: input.environment,
        active: input.active ?? true,
        lastUsed: null,
        empresaId: 91,
        global: Boolean(input.global),
        createdAt: '2024-01-01T00:00:00.000Z',
        updatedAt: '2024-01-01T00:00:00.000Z',
      };
    }) as IntegrationApiKeyServiceCtor['prototype']['create'],
  );

  const req = {
    auth: createAuth(11),
    params: {},
    body: { provider: 'openai', key: 'sk_value', environment: 'producao', active: true },
  } as unknown as Request;
  const res = createMockResponse();

  await createIntegrationApiKey(req, res);

  assert.equal(res.statusCode, 201);
  assert.ok(res.body);
  assert.equal((res.body as { empresaId: number }).empresaId, 91);
  assert.equal(refreshCalls, 1);
  assert.equal(invalidateCalls, 1);

  restoreQuery();
  restoreCreate();
  restoreInvalidate();
  restoreRefresh();
});

test('updateIntegrationApiKey applies empresa scope when invoking service', async () => {
  const restoreQuery = patchMethod(
    dbPool,
    'query',
    (async () => ({ rows: [{ empresa: 33 }], rowCount: 1 })) as typeof dbPool.query,
  );

  let invalidateCalls = 0;
  const restoreInvalidate = patchMethod(
    juditProcessService,
    'invalidateConfigurationCache',
    (() => {
      invalidateCalls += 1;
    }) as typeof juditProcessService.invalidateConfigurationCache,
  );
  let refreshCalls = 0;
  const restoreRefresh = patchMethod(
    cronJobs,
    'refreshJuditIntegration',
    (async () => {
      refreshCalls += 1;
    }) as typeof cronJobs.refreshJuditIntegration,
  );

  const restoreUpdate = patchMethod(
    IntegrationApiKeyService.prototype,
    'update',
    (async (
      id: number,
      updates: Parameters<IntegrationApiKeyServiceCtor['prototype']['update']>[1],
      scope: { empresaId: number },
    ) => {
      assert.equal(id, 5);
      assert.equal(scope.empresaId, 33);
      return {
        id,
        provider: updates.provider ?? 'openai',
        apiUrl: updates.apiUrl ?? null,
        key: updates.key ?? 'sk',
        environment: updates.environment ?? 'producao',
        active: updates.active ?? true,
        lastUsed: null,
        empresaId: scope.empresaId,
        global: Boolean(updates.global),
        createdAt: '2024-01-01T00:00:00.000Z',
        updatedAt: '2024-01-02T00:00:00.000Z',
      };
    }) as IntegrationApiKeyServiceCtor['prototype']['update'],
  );

  const req = {
    auth: createAuth(19),
    params: { id: '5' },
    body: { active: false },
  } as unknown as Request;
  const res = createMockResponse();

  await updateIntegrationApiKey(req, res);

  assert.equal(res.statusCode, 200);
  assert.ok(res.body);
  assert.equal((res.body as { empresaId: number }).empresaId, 33);
  assert.equal(refreshCalls, 1);
  assert.equal(invalidateCalls, 1);

  restoreQuery();
  restoreUpdate();
  restoreInvalidate();
  restoreRefresh();
});

test('deleteIntegrationApiKey forwards empresa scope to service', async () => {
  const restoreQuery = patchMethod(
    dbPool,
    'query',
    (async () => ({ rows: [{ empresa: 27 }], rowCount: 1 })) as typeof dbPool.query,
  );

  let invalidateCalls = 0;
  const restoreInvalidate = patchMethod(
    juditProcessService,
    'invalidateConfigurationCache',
    (() => {
      invalidateCalls += 1;
    }) as typeof juditProcessService.invalidateConfigurationCache,
  );
  let refreshCalls = 0;
  const restoreRefresh = patchMethod(
    cronJobs,
    'refreshJuditIntegration',
    (async () => {
      refreshCalls += 1;
    }) as typeof cronJobs.refreshJuditIntegration,
  );

  const restoreDelete = patchMethod(
    IntegrationApiKeyService.prototype,
    'delete',
    (async (id: number, scope: { empresaId: number }) => {
      assert.equal(id, 9);
      assert.equal(scope.empresaId, 27);
      return true;
    }) as IntegrationApiKeyServiceCtor['prototype']['delete'],
  );

  const req = {
    auth: createAuth(22),
    params: { id: '9' },
    body: {},
  } as unknown as Request;
  const res = createMockResponse();

  await deleteIntegrationApiKey(req, res);

  assert.equal(res.statusCode, 204);
  assert.equal(res.body, undefined);
  assert.equal(refreshCalls, 1);
  assert.equal(invalidateCalls, 1);

  restoreQuery();
  restoreDelete();
  restoreInvalidate();
  restoreRefresh();
});

test('validateAsaasIntegration delegates to scoped validation service', async () => {
  const restoreQuery = patchMethod(
    dbPool,
    'query',
    (async () => ({ rows: [{ empresa: 64 }], rowCount: 1 })) as typeof dbPool.query,
  );

  const restoreValidate = patchMethod(
    IntegrationApiKeyValidationService.prototype,
    'validateAsaas',
    (async (id: number, scope: { empresaId: number }) => {
      assert.equal(id, 12);
      assert.equal(scope.empresaId, 64);
      return { success: true };
    }) as IntegrationApiKeyValidationServiceCtor['prototype']['validateAsaas'],
  );

  const req = {
    auth: createAuth(30),
    params: {},
    body: { apiKeyId: 12 },
  } as unknown as Request;
  const res = createMockResponse();

  await validateAsaasIntegration(req, res);

  assert.equal(res.statusCode, 200);
  assert.deepEqual(res.body, { success: true });

  restoreQuery();
  restoreValidate();
});
