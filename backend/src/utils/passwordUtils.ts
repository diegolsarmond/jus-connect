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

const verifySha256Password = (password: string, storedValue: string): boolean => {
  const parts = storedValue.split(':');

  if (parts.length !== 3) {
    return false;
  }

  const [, salt, digest] = parts;

  const computedDigest = crypto
    .createHash('sha256')
    .update(`${salt}:${password}`)
    .digest('hex');

  return safeCompare(digest, computedDigest);
};

export const verifyPassword = async (
  providedPassword: string,
  storedValue: unknown
): Promise<boolean> => {
  if (typeof storedValue !== 'string' || storedValue.length === 0) {
    return false;
  }

  if (storedValue.startsWith(SHA256_PREFIX)) {
    return verifySha256Password(providedPassword, storedValue);
  }

  return safeCompare(providedPassword, storedValue);
};
