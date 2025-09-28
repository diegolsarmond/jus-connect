import assert from 'node:assert/strict';
import { afterEach, beforeEach, describe, it } from 'node:test';

import { __resetAuthSecretCacheForTests, getAuthSecret } from '../src/constants/auth';

const AUTH_ENV_KEYS = ['AUTH_TOKEN_SECRET', 'JWT_SECRET', 'TOKEN_SECRET'] as const;

describe('constants/auth', () => {
  let originalEnv: NodeJS.ProcessEnv;

  const clearAuthEnv = () => {
    for (const key of AUTH_ENV_KEYS) {
      delete process.env[key];
    }
  };

  beforeEach(() => {
    originalEnv = { ...process.env };
    clearAuthEnv();
    delete process.env.NODE_ENV;
    __resetAuthSecretCacheForTests();
  });

  afterEach(() => {
    for (const key of Object.keys(process.env)) {
      delete process.env[key];
    }

    Object.assign(process.env, originalEnv);
    __resetAuthSecretCacheForTests();
  });

  it('gera um segredo temporário quando nenhuma variável foi definida em ambiente não produtivo', () => {
    process.env.NODE_ENV = 'development';

    const secret = getAuthSecret();

    assert.ok(secret.startsWith('dev-insecure-secret-'));
    assert.strictEqual(process.env.AUTH_TOKEN_SECRET, secret);
    assert.strictEqual(getAuthSecret(), secret, 'utiliza o valor em cache nas próximas chamadas');
  });

  it('lança erro em produção quando nenhum segredo foi definido', () => {
    process.env.NODE_ENV = 'production';

    assert.throws(
      () => {
        getAuthSecret();
      },
      (error: unknown) =>
        error instanceof Error &&
        error.message.includes('AUTH_TOKEN_SECRET (ou JWT_SECRET/TOKEN_SECRET) não foi definido')
    );
  });

  it('respeita segredos definidos via variável de ambiente', () => {
    process.env.NODE_ENV = 'development';
    process.env.JWT_SECRET = 'jwt-secret-value';

    const secret = getAuthSecret();

    assert.strictEqual(secret, 'jwt-secret-value');
    assert.strictEqual(process.env.AUTH_TOKEN_SECRET, undefined);
  });
});
