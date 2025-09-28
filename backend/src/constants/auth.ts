import { parseExpiration } from '../utils/tokenUtils';

const FALLBACK_EXPIRATION_SECONDS = 60 * 60; // 1 hora

let cachedSecret: string | undefined;

const resolveAuthSecret = (): string => {
  if (cachedSecret) {
    return cachedSecret;
  }

  const secretFromEnv =
    process.env.AUTH_TOKEN_SECRET || process.env.JWT_SECRET || process.env.TOKEN_SECRET;

  if (!secretFromEnv) {
    throw new Error(
      'AUTH_TOKEN_SECRET (ou JWT_SECRET/TOKEN_SECRET) não foi definido. Defina um segredo forte antes de iniciar o servidor.'
    );
  }

  cachedSecret = secretFromEnv;
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
