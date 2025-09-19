import crypto from 'crypto';

const safeCompare = (a: string, b: string): boolean => {
  const bufferA = Buffer.from(a, 'utf8');
  const bufferB = Buffer.from(b, 'utf8');

  if (bufferA.length !== bufferB.length) {
    return false;
  }

  return crypto.timingSafeEqual(bufferA, bufferB);
};

const SHA256_PREFIX = 'sha256:';
const SALT_LENGTH_BYTES = 16;
const SHA256_PARTS = 3;

const computeSha256Digest = (salt: string, password: string): string =>
  crypto
    .createHash('sha256')
    .update(`${salt}:${password}`)
    .digest('hex');

const isSha256StoredPassword = (value: string): boolean =>
  value.startsWith(SHA256_PREFIX) && value.split(':').length === SHA256_PARTS;

export const hashPassword = async (password: string): Promise<string> => {
  const salt = crypto.randomBytes(SALT_LENGTH_BYTES).toString('hex');
  const digest = computeSha256Digest(salt, password);

  return `${SHA256_PREFIX}${salt}:${digest}`;
};

const verifySha256Password = (password: string, storedValue: string): boolean => {
  const parts = storedValue.split(':');

  if (parts.length !== SHA256_PARTS) {
    return false;
  }

  const [, salt, digest] = parts;
  const computedDigest = computeSha256Digest(salt, password);

  return safeCompare(digest, computedDigest);
};

export const isPasswordHashed = (storedValue: unknown): storedValue is string =>
  typeof storedValue === 'string' && isSha256StoredPassword(storedValue);

export const verifyPassword = async (
  providedPassword: string,
  storedValue: unknown
): Promise<boolean> => {
  if (typeof storedValue !== 'string' || storedValue.length === 0) {
    return false;
  }

  if (isSha256StoredPassword(storedValue)) {
    return verifySha256Password(providedPassword, storedValue);
  }

  return safeCompare(providedPassword, storedValue);
};
