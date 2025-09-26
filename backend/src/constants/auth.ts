import { parseExpiration } from '../utils/tokenUtils';

const FALLBACK_SECRET = 'change-me-in-production';
const FALLBACK_EXPIRATION_SECONDS = 60 * 60; // 1 hora

const secretFromEnv =
  process.env.AUTH_TOKEN_SECRET || process.env.JWT_SECRET || process.env.TOKEN_SECRET;

if (!secretFromEnv) {
  console.warn(
    'AUTH_TOKEN_SECRET não definido. Um valor padrão inseguro está sendo utilizado apenas para desenvolvimento.'
  );
}

export const authConfig = {
  secret: secretFromEnv ?? FALLBACK_SECRET,
  expirationSeconds: parseExpiration(
    process.env.AUTH_TOKEN_EXPIRATION || process.env.JWT_EXPIRATION,
    FALLBACK_EXPIRATION_SECONDS
  ),
};
