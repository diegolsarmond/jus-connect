import crypto from 'crypto';

import { parseExpiration } from '../utils/tokenUtils';

const FALLBACK_EXPIRATION_SECONDS = 60 * 60; // 1 hora
const DEV_SECRET_BYTE_LENGTH = 32;

let cachedSecret: string | undefined;

const createDevFallbackSecret = () =>
  `dev-insecure-secret-${crypto.randomBytes(DEV_SECRET_BYTE_LENGTH).toString('hex')}`;

const shouldUseDevFallback = () => process.env.NODE_ENV !== 'production';

const assignFallbackSecret = (secret: string) => {
  if (!process.env.AUTH_TOKEN_SECRET) {
    process.env.AUTH_TOKEN_SECRET = secret;
  }
};

const resolveMissingSecret = () => {
  if (!shouldUseDevFallback()) {
    throw new Error(
      'AUTH_TOKEN_SECRET (ou JWT_SECRET/TOKEN_SECRET) não foi definido. Defina um segredo forte antes de iniciar o servidor.'
    );
  }

  const fallbackSecret = createDevFallbackSecret();

  console.warn(
    'AUTH_TOKEN_SECRET não definido. Um valor inseguro foi gerado automaticamente apenas para uso local. Defina AUTH_TOKEN_SECRET com um segredo forte antes de iniciar o servidor em ambientes reais.'
  );

  assignFallbackSecret(fallbackSecret);
  return fallbackSecret;
};

const resolveAuthSecret = (): string => {
  if (cachedSecret) {
    return cachedSecret;
  }

  const secretFromEnv =
    process.env.AUTH_TOKEN_SECRET || process.env.JWT_SECRET || process.env.TOKEN_SECRET;

  cachedSecret = secretFromEnv || resolveMissingSecret();
  return cachedSecret;
};

export const getAuthSecret = (): string => resolveAuthSecret();

export const authConfig = {
  get secret(): string {
    return resolveAuthSecret();
  },
  expirationSeconds: parseExpiration(
    process.env.AUTH_TOKEN_EXPIRATION || process.env.JWT_EXPIRATION,
    FALLBACK_EXPIRATION_SECONDS
  ),
};

export const __resetAuthSecretCacheForTests = () => {
  cachedSecret = undefined;
};
