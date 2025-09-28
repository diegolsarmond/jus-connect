import assert from 'node:assert/strict';
import test from 'node:test';

import {
  hashPassword,
  verifyPassword,
  __testing as passwordUtilsTesting,
} from '../src/utils/passwordUtils';

const ORIGINAL_ENV = process.env.PASSWORD_HASH_FORCE_FALLBACK;

test.beforeEach(() => {
  process.env.PASSWORD_HASH_FORCE_FALLBACK = 'true';
  passwordUtilsTesting.resetArgon2ModuleCache();
});

test.afterEach(() => {
  if (ORIGINAL_ENV === undefined) {
    delete process.env.PASSWORD_HASH_FORCE_FALLBACK;
  } else {
    process.env.PASSWORD_HASH_FORCE_FALLBACK = ORIGINAL_ENV;
  }
  passwordUtilsTesting.resetArgon2ModuleCache();
});

test('hashPassword utiliza o fallback quando configurado', async () => {
  const password = 'senha-secreta';

  const hashed = await hashPassword(password);

  assert.ok(hashed.startsWith('argon2:$argon2id$'));

  const verification = await verifyPassword(password, hashed);
  assert.equal(verification.isValid, true);
  assert.equal(verification.needsRehash, false);
  assert.equal(verification.migratedHash, undefined);
});
