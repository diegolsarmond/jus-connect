import assert from 'node:assert/strict';
import test from 'node:test';
import type { Request, Response } from 'express';
import pool from '../src/services/db';
import * as juditProcessServiceModule from '../src/services/juditProcessService';

const getJuditServiceInstance = (): any =>
  (juditProcessServiceModule.default as { default?: unknown }).default ??
  juditProcessServiceModule.default;

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

const createMockRequest = (body: unknown) =>
  ({
    params: { id: '101' },
    body,
    auth: { userId: 55 },
  }) as unknown as Request;

let triggerManualJuditSync: typeof import('../src/controllers/juditProcessController')['triggerManualJuditSync'];

test.before(async () => {
  ({ triggerManualJuditSync } = await import('../src/controllers/juditProcessController'));
});

const setupSuccessfulMocks = () => {
  const processoRow = {
    id: 101,
    numero: '0000000-00.0000.0.00.0000',
    judit_tracking_id: null,
    judit_tracking_hour_range: null,
  };

  const originalQuery = pool.query;

  if (typeof originalQuery !== 'function') {
    throw new TypeError('pool.query is not a function');
  }

  const poolQuery = async (text: string) => {
    if (/FROM public\.usuarios/.test(text)) {
      return {
        rowCount: 1,
        rows: [{ empresa: 77 }],
      };
    }

    if (/FROM public\.processos/.test(text)) {
      return {
        rowCount: 1,
        rows: [processoRow],
      };
    }

    throw new Error(`Unexpected pool query: ${text}`);
  };

  (pool as unknown as { query: typeof pool.query }).query = poolQuery as typeof pool.query;

  const juditService = getJuditServiceInstance();
  const originalIsEnabled = juditService.isEnabled;
  const originalEnsureTrackingForProcess = juditService.ensureTrackingForProcess;
  const originalTriggerRequestForProcess = juditService.triggerRequestForProcess;

  juditService.isEnabled = async () => true;
  juditService.ensureTrackingForProcess = async () => null;

  const triggerCalls: unknown[][] = [];

  juditService.triggerRequestForProcess = async (...args: unknown[]) => {
    triggerCalls.push(args);
    return null;
  };

  const restore = () => {
    juditService.triggerRequestForProcess = originalTriggerRequestForProcess;
    juditService.ensureTrackingForProcess = originalEnsureTrackingForProcess;
    juditService.isEnabled = originalIsEnabled;
    (pool as unknown as { query: typeof pool.query }).query = originalQuery;
  };

  return { triggerCalls, restore };
};

test('triggerManualJuditSync accepts camelCase attachment flag', async () => {
  const { triggerCalls, restore } = setupSuccessfulMocks();
  const req = createMockRequest({ withAttachments: 'true' });
  const res = createMockResponse();

  try {
    await triggerManualJuditSync(req, res);

    assert.equal(res.statusCode, 200);
    assert.equal(triggerCalls.length, 1);

    const [, , options] = triggerCalls[0] as [number, string, { withAttachments?: boolean }];
    assert.equal(options.withAttachments, true);
  } finally {
    restore();
  }
});

test('triggerManualJuditSync accepts snake_case attachment flag', async () => {
  const { triggerCalls, restore } = setupSuccessfulMocks();
  const req = createMockRequest({ with_attachments: '0' });
  const res = createMockResponse();

  try {
    await triggerManualJuditSync(req, res);

    assert.equal(res.statusCode, 200);
    assert.equal(triggerCalls.length, 1);

    const [, , options] = triggerCalls[0] as [number, string, { withAttachments?: boolean }];
    assert.equal(options.withAttachments, false);
  } finally {
    restore();
  }
});
