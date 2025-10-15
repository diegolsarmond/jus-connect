import assert from 'node:assert/strict';
import test from 'node:test';
import type { NextFunction, Request, Response } from 'express';

import {
  authorizeModules,
  invalidateAllUserModulesCache,
  __setFetchUserModulesForTests,
  __resetFetchUserModulesForTests,
} from '../src/middlewares/moduleAuthorization';

test('authorizeModules reutiliza módulos do cache em requisições sequenciais', async (t) => {
  invalidateAllUserModulesCache();
  const calls: number[] = [];
  __setFetchUserModulesForTests(async () => {
    calls.push(Date.now());
    return ['tarefas'];
  });
  t.after(() => {
    __resetFetchUserModulesForTests();
    invalidateAllUserModulesCache();
  });

  const middleware = authorizeModules([]);

  const nextCalls: unknown[] = [];
  const next: NextFunction = (error?: unknown) => {
    if (error) {
      throw error;
    }
    nextCalls.push(null);
  };

  const createRequest = (): Request => ({
    auth: { userId: 42 },
  }) as Request;

  const res = {
    status: () => {
      throw new Error('status não deveria ser chamado');
    },
    json: () => {
      throw new Error('json não deveria ser chamado');
    },
  } as unknown as Response;

  await middleware(createRequest(), res, next);
  await middleware(createRequest(), res, next);

  assert.equal(nextCalls.length, 2);
  assert.equal(calls.length, 1);
});
