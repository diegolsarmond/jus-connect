import assert from 'node:assert/strict';
import test from 'node:test';
import type { Response } from 'express';

import { respondToJuditApiError } from '../src/controllers/juditProcessController';
import { JuditApiError } from '../src/services/juditProcessService';

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
