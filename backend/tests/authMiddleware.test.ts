import assert from 'node:assert/strict';
import { afterEach, beforeEach, describe, it } from 'node:test';
import type { NextFunction, Request, Response } from 'express';

import { authenticateRequest } from '../src/middlewares/authMiddleware';
import { authConfig, __resetAuthSecretCacheForTests } from '../src/constants/auth';
import { signToken } from '../src/utils/tokenUtils';

describe('middlewares/authMiddleware', () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    __resetAuthSecretCacheForTests();
    process.env.AUTH_TOKEN_SECRET = 'test-secret';
  });

  afterEach(() => {
    for (const key of Object.keys(process.env)) {
      delete process.env[key];
    }

    Object.assign(process.env, originalEnv);
    __resetAuthSecretCacheForTests();
  });

  it('garante que payload e supabaseUserId usem sub em formato de string', () => {
    const token = signToken({ sub: 42, email: 'user@example.com' }, authConfig.secret, 300);

    const req: Partial<Request> = {
      headers: {
        authorization: `Bearer ${token}`,
      },
    };

    let statusCode: number | undefined;
    let jsonPayload: unknown;

    const res: Partial<Response> = {
      status(code: number) {
        statusCode = code;
        return this as Response;
      },
      json(payload: unknown) {
        jsonPayload = payload;
        return this as Response;
      },
    };

    let nextCalled = false;
    const next: NextFunction = () => {
      nextCalled = true;
    };

    authenticateRequest(req as Request, res as Response, next);

    assert.strictEqual(statusCode, undefined);
    assert.strictEqual(jsonPayload, undefined);
    assert.ok(nextCalled);
    assert.ok(req.auth);
    assert.strictEqual(req.auth?.userId, 42);
    assert.strictEqual(req.auth?.supabaseUserId, '42');
    assert.strictEqual(req.auth?.payload.sub, '42');
    assert.strictEqual(req.auth?.email, 'user@example.com');
  });
});
