import assert from 'node:assert/strict';
import { test } from 'node:test';
import { authenticateRequest } from '../src/middlewares/authMiddleware';
import { signToken } from '../src/utils/tokenUtils';
import { authConfig } from '../src/constants/auth';
import type { NextFunction, Request, Response } from 'express';

test('authenticateRequest converte sub numérico em string para payload Supabase', () => {
  const token = signToken({ sub: 123, email: 'teste@example.com' }, authConfig.secret, 60);
  const req = {
    headers: {
      authorization: `Bearer ${token}`,
    },
  } as Request;
  let statusCode: number | undefined;
  let responseBody: unknown;
  const res = {
    status(code: number) {
      statusCode = code;
      return this;
    },
    json(payload: unknown) {
      responseBody = payload;
      return this;
    },
  } as unknown as Response;
  let nextCalled = false;
  const next: NextFunction = () => {
    nextCalled = true;
  };

  authenticateRequest(req, res, next);

  assert.equal(statusCode, undefined);
  assert.equal(responseBody, undefined);
  assert.equal(nextCalled, true);
  assert.ok(req.auth);
  assert.equal(req.auth?.userId, 123);
  assert.equal(req.auth?.supabaseUserId, '123');
  assert.equal(req.auth?.payload.sub, '123');
  assert.equal(req.auth?.email, 'teste@example.com');
});
