import { parseExpiration } from '../utils/tokenUtils';

const FALLBACK_SECRET = 'change-me-in-production';
const FALLBACK_EXPIRATION_SECONDS = 60 * 60; // 1 hora

const secretFromEnv =
  process.env.AUTH_TOKEN_SECRET || process.env.JWT_SECRET || process.env.TOKEN_SECRET;

if (!secretFromEnv) {
  const errorMessage =
    'AUTH_TOKEN_SECRET não definido. Configure uma chave segura antes de iniciar o servidor.';

  if (process.env.NODE_ENV === 'test') {
    console.warn(
      `${errorMessage} Um valor padrão inseguro está sendo utilizado apenas para o ambiente de testes.`
    );
  } else {
    throw new Error(errorMessage);
  }
}

export const authConfig = {
  secret: secretFromEnv ?? FALLBACK_SECRET,
  expirationSeconds: parseExpiration(
    process.env.AUTH_TOKEN_EXPIRATION || process.env.JWT_EXPIRATION,
    FALLBACK_EXPIRATION_SECONDS
  ),
};
