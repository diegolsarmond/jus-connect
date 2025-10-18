import assert from 'node:assert/strict';
import test from 'node:test';

import pool from '../src/services/db';
import { bootstrapOabMonitoradas } from '../src/services/oabMonitorService';

test('bootstrapOabMonitoradas ignora falhas de conexão ao banco de dados', async (t) => {
  const error = Object.assign(new Error('getaddrinfo ENOTFOUND db.projeto.supabase.co'), {
    code: 'ENOTFOUND',
  });

  const connectMock = t.mock.method(pool, 'connect', async () => {
    throw error;
  });
  const warnMock = t.mock.method(console, 'warn');

  await bootstrapOabMonitoradas();

  assert.equal(connectMock.mock.callCount(), 1);
  assert.equal(warnMock.mock.callCount(), 1);
  assert.match(
    String(warnMock.mock.calls[0]?.arguments?.[0] ?? ''),
    /Ignorando a criação da tabela oab_monitoradas: falha ao conectar ao banco de dados./,
  );

  connectMock.mock.restore();
  warnMock.mock.restore();
});
