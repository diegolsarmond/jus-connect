import assert from 'node:assert/strict';
import test from 'node:test';

import {
  parseExpiration,
  signToken,
  verifyToken,
} from '../../src/utils/tokenUtils';

const delay = (ms: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, ms));

test('parseExpiration returns fallback seconds for empty values', () => {
  const fallback = 90;

  assert.equal(parseExpiration(undefined, fallback), fallback);
  assert.equal(parseExpiration('', fallback), fallback);
  assert.equal(parseExpiration('   ', fallback), fallback);
});

test('parseExpiration parses numeric values and human readable durations', () => {
  assert.equal(parseExpiration('120', 10), 120);
  assert.equal(parseExpiration('15m', 10), 15 * 60);
  assert.equal(parseExpiration('2H', 10), 2 * 60 * 60);
  assert.equal(parseExpiration('3d', 10), 3 * 24 * 60 * 60);
});

test('parseExpiration falls back when the value is invalid', () => {
  const fallback = 45;
  assert.equal(parseExpiration('abc', fallback), fallback);
  assert.equal(parseExpiration('0m', fallback), fallback);
  assert.equal(parseExpiration('-10', fallback), fallback);
});

test('signToken generates tokens that verify successfully with same secret', () => {
  const secret = 'test-secret';
  const token = signToken({ sub: 'user-123', role: 'admin' }, secret, 30);

  const payload = verifyToken(token, secret);

  assert.equal(payload.sub, 'user-123');
  assert.equal(payload.role, 'admin');
  assert.ok(typeof payload.iat === 'number');
  assert.ok(typeof payload.exp === 'number');
  assert.ok(payload.exp > payload.iat);
});

test('verifyToken rejects tampered tokens', () => {
  const token = signToken({ sub: 'user-123' }, 'secret', 30);
  const [encodedHeader, encodedPayload] = token.split('.');
  const tampered = `${encodedHeader}.${encodedPayload}.different-signature`;

  assert.throws(() => verifyToken(tampered, 'secret'), /Invalid token signature/);
});

test('verifyToken rejects expired tokens', async () => {
  const secret = 'short-lived';
  const token = signToken({ sub: 'user-123' }, secret, 1);

  await delay(1100);

  assert.throws(() => verifyToken(token, secret), /Token expired/);
});

test('signToken enforces positive expiration times', () => {
  assert.throws(() => signToken({ sub: 'user-123' }, 'secret', 0), /positive/);
  assert.throws(() => signToken({ sub: 'user-123' }, 'secret', -5), /positive/);
});
