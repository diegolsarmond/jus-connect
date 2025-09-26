import assert from 'node:assert/strict';
import test from 'node:test';
import type { Response } from 'express';
import { respondToJuditApiError } from '../src/controllers/juditProcessController';
import { JuditApiError } from '../src/services/juditProcessService';

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
  };

  return response as Response & { statusCode: number; body: unknown };
};

const expectStructuredLog = (
  calls: unknown[][],
  expectedStatus: number,
  expectedMessage: string,
) => {
  assert.equal(calls.length, 1);
  const args = calls[0] ?? [];
  assert.match(String(args[0] ?? ''), /Falha ao acionar sincronização manual com a Judit/i);
  const payload = args[1] as Record<string, unknown> | undefined;
  assert.ok(payload);
  assert.equal(payload?.status, expectedStatus);
  assert.equal(payload?.message, expectedMessage);
};

test('respondToJuditApiError maps 401 and 403 responses to HTTP 401 and logs diagnostics', () => {
  const res = createMockResponse();
  const originalConsoleError = console.error;
  const consoleCalls: unknown[][] = [];
  console.error = (...args: unknown[]) => {
    consoleCalls.push(args);
  };

  try {
    respondToJuditApiError(new JuditApiError('Unauthorized', 401, { message: 'Token inválido' }), res);
  } finally {
    console.error = originalConsoleError;
  }

  assert.equal(res.statusCode, 401);
  assert.deepEqual(res.body, { error: 'Token inválido' });
  expectStructuredLog(consoleCalls, 401, 'Token inválido');
});

test('respondToJuditApiError maps rate limiting responses to HTTP 429 and logs diagnostics', () => {
  const res = createMockResponse();
  const originalConsoleError = console.error;
  const consoleCalls: unknown[][] = [];
  console.error = (...args: unknown[]) => {
    consoleCalls.push(args);
  };

  try {
    respondToJuditApiError(new JuditApiError('Rate limited', 429, { detail: 'Too many requests' }), res);
  } finally {
    console.error = originalConsoleError;
  }

  assert.equal(res.statusCode, 429);
  assert.deepEqual(res.body, { error: 'Too many requests' });
  expectStructuredLog(consoleCalls, 429, 'Too many requests');
});

test('respondToJuditApiError maps 5xx responses to HTTP 502 and logs diagnostics', () => {
  const res = createMockResponse();
  const originalConsoleError = console.error;
  const consoleCalls: unknown[][] = [];
  console.error = (...args: unknown[]) => {
    consoleCalls.push(args);
  };

  try {
    respondToJuditApiError(new JuditApiError('Server error', 503, null), res);
  } finally {
    console.error = originalConsoleError;
  }

  assert.equal(res.statusCode, 502);
  assert.deepEqual(res.body, { error: 'Falha ao comunicar com a Judit.' });
  expectStructuredLog(consoleCalls, 503, 'Falha ao comunicar com a Judit.');
});

test('respondToJuditApiError maps other client errors to HTTP 400 and logs diagnostics', () => {
  const res = createMockResponse();
  const originalConsoleError = console.error;
  const consoleCalls: unknown[][] = [];
  console.error = (...args: unknown[]) => {
    consoleCalls.push(args);
  };

  try {
    respondToJuditApiError(
      new JuditApiError('Invalid data', 422, { errors: [{ message: 'Payload inválido' }] }),
      res,
    );
  } finally {
    console.error = originalConsoleError;
  }

  assert.equal(res.statusCode, 400);
  assert.deepEqual(res.body, { error: 'Payload inválido' });
  expectStructuredLog(consoleCalls, 422, 'Payload inválido');
});
