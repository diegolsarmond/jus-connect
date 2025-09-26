import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import test from 'node:test';

const require = createRequire(import.meta.url);

test('db service requires a local connection string', async (t) => {
  const originalDatabaseUrl = process.env.DATABASE_URL;
  delete process.env.DATABASE_URL;

  const modulePath = require.resolve('../src/services/db');
  delete require.cache[modulePath];

  t.after(() => {
    if (originalDatabaseUrl === undefined) {
      delete process.env.DATABASE_URL;
    } else {
      process.env.DATABASE_URL = originalDatabaseUrl;
    }

    delete require.cache[modulePath];
  });

  await assert.rejects(async () => import('../src/services/db'), (error) => {
    assert.match(
      (error as Error).message,
      /Database connection string not provided/i
    );
    return true;
  });
});
