import assert from 'node:assert/strict';
import test from 'node:test';

import {
  hashPassword,
  verifyPassword,
  __testing as passwordUtilsTesting,
} from '../src/utils/passwordUtils';

test.beforeEach(() => {
  passwordUtilsTesting.setForceFallbackOverride(true);
});

test.afterEach(() => {
  passwordUtilsTesting.setForceFallbackOverride(null);

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
