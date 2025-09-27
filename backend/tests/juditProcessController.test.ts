import assert from 'node:assert/strict';
import test from 'node:test';
import type { Request, Response } from 'express';

import { respondToJuditApiError, triggerManualJuditSync } from '../src/controllers/juditProcessController';
import pool from '../src/services/db';
import juditProcessService, {
  JuditApiError,
  type JuditRequestRecord,
} from '../src/services/juditProcessService';

type MockResponse = Response & {
  statusCode?: number;
  jsonPayload?: unknown;
};

const createMockResponse = (): MockResponse => {
  const res: Partial<Response> & {
    statusCode?: number;
    jsonPayload?: unknown;
  } = {};

  res.status = ((code: number) => {
    res.statusCode = code;
    return res as Response;
  }) as Response['status'];

  res.json = ((payload: unknown) => {
    res.jsonPayload = payload;
    return res as Response;
  }) as Response['json'];

  return res as MockResponse;
};

const withSilencedConsoleError = async (fn: () => Promise<void> | void) => {
  const original = console.error;
  console.error = () => undefined;
  try {
    await fn();
  } finally {
    console.error = original;
  }
};

test('respondToJuditApiError returns nested Judit error details when available', async () => {
  await withSilencedConsoleError(async () => {
    const errorBody = {
      error: {
        name: 'HttpBadRequestError',
        message: 'BAD_REQUEST',
        data: [
          { field: 'process_number', message: 'Número do processo inválido.' },
          { detail: 'O número informado não segue o padrão CNJ.' },
        ],
      },
    };

    const error = new JuditApiError('Request failed', 400, errorBody);
    const res = createMockResponse();

    respondToJuditApiError(error, res);

    assert.equal(res.statusCode, 400);
    assert.deepEqual(res.jsonPayload, { error: 'Número do processo inválido.' });
  });
});

test('respondToJuditApiError falls back to top-level message when no details are found', async () => {
  await withSilencedConsoleError(async () => {
    const errorBody = {
      error: {
        name: 'HttpBadRequestError',
        message: 'BAD_REQUEST',
        data: [{ code: 'missing_parameter' }],
      },
    };

    const error = new JuditApiError('Request failed', 400, errorBody);
    const res = createMockResponse();

    respondToJuditApiError(error, res);

    assert.equal(res.statusCode, 400);
    assert.deepEqual(res.jsonPayload, { error: 'BAD_REQUEST' });
  });
});

test('triggerManualJuditSync reuses pending manual requests instead of creating duplicates', async () => {
  const req = {
    params: { id: '101' },
    auth: { userId: 55 },
    body: {},
  } as unknown as Request;

  const res = createMockResponse();

  const isEnabledMock = test.mock.method(
    juditProcessService,
    'isEnabled',
    async () => true
  );

  const poolMock = test.mock.method(pool, 'query', async (text: string) => {
    if (/FROM public\.usuarios/.test(text)) {
      return { rows: [{ empresa: 77 }], rowCount: 1 } satisfies {
        rows: unknown[];
        rowCount: number;
      };
    }

    if (/FROM public\.empresas/.test(text)) {
      return {
        rows: [
          {
            limite_usuarios: null,
            limite_processos: null,
            limite_propostas: null,
            sincronizacao_processos_habilitada: true,
            sincronizacao_processos_cota: null,
          },
        ],
        rowCount: 1,
      } satisfies { rows: unknown[]; rowCount: number };
    }

    if (/FROM public\.process_sync/.test(text)) {
      return { rows: [{ total: '0' }], rowCount: 1 };
    }

    if (/FROM public\.processo_consultas_api/.test(text)) {
      return { rows: [{ total: '0' }], rowCount: 1 };
    }

    if (/FROM public\.processos/.test(text)) {
      return {
        rows: [
          {
            id: 101,
            numero: '0000000-00.0000.0.00.0000',
            judit_tracking_id: null,
            judit_tracking_hour_range: null,
          },
        ],
        rowCount: 1,
      } satisfies { rows: unknown[]; rowCount: number };
    }

    throw new Error(`Unexpected query: ${text}`);
  });

  const ensureTrackingMock = test.mock.method(
    juditProcessService,
    'ensureTrackingForProcess',
    async () => null
  );

  const existingRequest: JuditRequestRecord = {
    processSyncId: 501,
    requestId: 'existing-req',
    status: 'pending',
    source: 'manual',
    result: { alreadyPending: true },
    metadata: { result: { alreadyPending: true } },
    createdAt: '2024-01-01T10:00:00.000Z',
    updatedAt: '2024-01-01T10:05:00.000Z',
  };

  let receivedOptions: Record<string, unknown> | null = null;
  const triggerMock = test.mock.method(
    juditProcessService,
    'triggerRequestForProcess',
    async (_processoId: number, _processNumber: string, options) => {
      receivedOptions = options as Record<string, unknown>;
      return existingRequest;
    }
  );

  try {
    await triggerManualJuditSync(req, res);
  } finally {
    triggerMock.mock.restore();
    ensureTrackingMock.mock.restore();
    poolMock.mock.restore();
    isEnabledMock.mock.restore();
  }

  assert.equal(triggerMock.mock.calls.length, 1);
  assert.equal(receivedOptions?.skipIfPending, true);
  assert.equal(receivedOptions?.source, 'manual');
  assert.equal(receivedOptions?.actorUserId, 55);

  const payload = res.jsonPayload as
    | { tracking: unknown; request: Record<string, unknown> }
    | undefined;
  assert.ok(payload);
  assert.equal(payload?.tracking, null);
  assert.deepEqual(payload?.request, {
    request_id: 'existing-req',
    status: 'pending',
    source: 'manual',
    result: { alreadyPending: true },
    criado_em: '2024-01-01T10:00:00.000Z',
    atualizado_em: '2024-01-01T10:05:00.000Z',
  });

  const queryTexts = poolMock.mock.calls.map((call) => String(call.arguments?.[0] ?? ''));
  assert.ok(
    queryTexts.some((text) => /FROM public\.processos/i.test(text)),
    'expected processos query to be executed',
  );
});

test('triggerManualJuditSync returns 403 when plan disables synchronization', async () => {
  const req = {
    params: { id: '101' },
    auth: { userId: 55 },
    body: {},
  } as unknown as Request;

  const res = createMockResponse();

  const isEnabledMock = test.mock.method(
    juditProcessService,
    'isEnabled',
    async () => true
  );

  const poolMock = test.mock.method(pool, 'query', async (text: string) => {
    if (/FROM public\.usuarios/.test(text)) {
      return { rows: [{ empresa: 77 }], rowCount: 1 } satisfies {
        rows: unknown[];
        rowCount: number;
      };
    }

    if (/FROM public\.empresas/.test(text)) {
      return {
        rows: [
          {
            limite_usuarios: null,
            limite_processos: null,
            limite_propostas: null,
            sincronizacao_processos_habilitada: false,
            sincronizacao_processos_cota: null,
          },
        ],
        rowCount: 1,
      } satisfies { rows: unknown[]; rowCount: number };
    }

    throw new Error(`Unexpected query: ${text}`);
  });

  try {
    await triggerManualJuditSync(req, res);

    assert.equal(res.statusCode, 403);
    assert.deepEqual(res.jsonPayload, {
      error: 'Sincronização de processos não disponível para o plano atual.',
    });
  } finally {
    poolMock.mock.restore();
    isEnabledMock.mock.restore();
  }
});

test('triggerManualJuditSync returns 403 when quota is exhausted', async () => {
  const req = {
    params: { id: '101' },
    auth: { userId: 55 },
    body: {},
  } as unknown as Request;

  const res = createMockResponse();

  const isEnabledMock = test.mock.method(
    juditProcessService,
    'isEnabled',
    async () => true
  );

  const poolMock = test.mock.method(pool, 'query', async (text: string) => {
    if (/FROM public\.usuarios/.test(text)) {
      return { rows: [{ empresa: 77 }], rowCount: 1 } satisfies {
        rows: unknown[];
        rowCount: number;
      };
    }

    if (/FROM public\.empresas/.test(text)) {
      return {
        rows: [
          {
            limite_usuarios: null,
            limite_processos: null,
            limite_propostas: null,
            sincronizacao_processos_habilitada: true,
            sincronizacao_processos_cota: 10,
          },
        ],
        rowCount: 1,
      } satisfies { rows: unknown[]; rowCount: number };
    }

    if (/FROM public\.process_sync/.test(text)) {
      return { rows: [{ total: '7' }], rowCount: 1 };
    }

    if (/FROM public\.processo_consultas_api/.test(text)) {
      return { rows: [{ total: '3' }], rowCount: 1 };
    }

    throw new Error(`Unexpected query: ${text}`);
  });

  try {
    await triggerManualJuditSync(req, res);

    assert.equal(res.statusCode, 403);
    assert.deepEqual(res.jsonPayload, {
      error: 'Cota de sincronização de processos esgotada para o plano atual.',
    });
  } finally {
    poolMock.mock.restore();
    isEnabledMock.mock.restore();
  }
});
