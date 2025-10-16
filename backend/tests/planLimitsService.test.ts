import assert from 'node:assert/strict';
import test from 'node:test';

import pool from '../src/services/db';
import { countCompanyResource } from '../src/services/planLimitsService';

test('countCompanyResource retorna 0 quando companyId é inválido', async () => {
  const queryMock = test.mock.method(pool, 'query', async () => {
    throw new Error('query não deve ser executada');
  });

  try {
    const result = await countCompanyResource(0, 'usuarios', 5);
    assert.equal(result, 0);
    assert.equal(queryMock.mock.callCount(), 0);
  } finally {
    queryMock.mock.restore();
  }
});

test('countCompanyResource retorna 0 quando limite é menor ou igual a zero', async () => {
  const queryMock = test.mock.method(pool, 'query', async () => {
    throw new Error('query não deve ser executada');
  });

  try {
    const result = await countCompanyResource(10, 'clientes', 0);
    assert.equal(result, 0);
    assert.equal(queryMock.mock.callCount(), 0);
  } finally {
    queryMock.mock.restore();
  }
});

test('countCompanyResource retorna contagem limitada pelo parâmetro informado', async () => {
  let callIndex = 0;
  const calls: { text: string; values?: unknown[] }[] = [];

  const queryMock = test.mock.method(pool, 'query', async (text: string, values?: unknown[]) => {
    calls.push({ text, values });

    if (text.includes('FROM public.processos') && Array.isArray(values)) {
      const limitParam = Number(values[1]);
      if (limitParam === 3) {
        return { rows: [{}, {}], rowCount: 2 };
      }

      if (limitParam === 1) {
        return { rows: [{}], rowCount: 1 };
      }
    }

    return { rows: [], rowCount: 0 };
  });

  try {
    const result = await countCompanyResource(42, 'processos', 3);
    assert.equal(result, 2);
    const [firstCall] = calls;
    assert.ok(firstCall);
    assert.match(firstCall?.text ?? '', /FROM public\.processos/i);
    assert.match(firstCall?.text ?? '', /LIMIT \$2/);
    assert.deepEqual(firstCall?.values, [42, 3]);

    const cappedResult = await countCompanyResource(42, 'processos', 1);
    assert.equal(cappedResult, 1);
    assert.equal(queryMock.mock.callCount(), 2);
  } finally {
    queryMock.mock.restore();
  }
});
