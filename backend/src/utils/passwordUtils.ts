import crypto from 'node:crypto';
import type { Argon2Module, Argon2Options } from './argon2Types';

const SHA256_PREFIX = 'sha256:';
const ARGON2_PREFIX = 'argon2:';

const shouldForceFallback = (): boolean => {
  const value = process.env.PASSWORD_HASH_FORCE_FALLBACK;
  if (!value) {
    return false;
  }

  const normalized = value.trim().toLowerCase();
  return normalized === 'true' || normalized === '1' || normalized === 'yes';
};

const parseIntegerEnv = (
  value: string | undefined,
  fallback: number,
  min: number,
  max: number
): number => {
  if (!value) {
    return fallback;
  }

  const trimmed = value.trim();
  if (!trimmed) {
    return fallback;
  }

  const parsed = Number.parseInt(trimmed, 10);
  if (!Number.isFinite(parsed)) {
    return fallback;
  }

  const clamped = Math.min(Math.max(parsed, min), max);
  return Math.trunc(clamped);
};

const configuredMemoryCost = parseIntegerEnv(
  process.env.PASSWORD_HASH_MEMORY_COST,
  19_456,
  1_024,
  1 << 22
);
const configuredTimeCost = parseIntegerEnv(process.env.PASSWORD_HASH_TIME_COST, 2, 1, 10);
const configuredParallelism = parseIntegerEnv(
  process.env.PASSWORD_HASH_PARALLELISM,
  1,
  1,
  16
);

const safeCompare = (a: string, b: string): boolean => {
  const bufferA = Buffer.from(a, 'utf8');
  const bufferB = Buffer.from(b, 'utf8');

  if (bufferA.length !== bufferB.length) {
    return false;
  }

  return crypto.timingSafeEqual(bufferA, bufferB);
};

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

type PasswordVerificationResult = {
  isValid: boolean;
  needsRehash: boolean;
  migratedHash?: string;
};

let argon2ModulePromise: Promise<Argon2Module> | null = null;
let argon2ModuleSource: 'native' | 'fallback' | null = null;

const loadFallbackModule = async (): Promise<Argon2Module> => {
  const fallback = await import('./argon2Fallback');
  return fallback.default;
};

const loadArgon2 = async (): Promise<Argon2Module> => {
  if (shouldForceFallback()) {
    if (argon2ModuleSource !== 'fallback') {
      argon2ModulePromise = loadFallbackModule();
      argon2ModuleSource = 'fallback';
    }

    return argon2ModulePromise!;
  }

  if (!argon2ModulePromise || argon2ModuleSource !== 'native') {
    argon2ModulePromise = import('argon2')
      .then((module) => {
        argon2ModuleSource = 'native';
        return module.default ? module.default : (module as unknown as Argon2Module);
      })
      .catch(async () => {
        argon2ModuleSource = 'fallback';
        return loadFallbackModule();
      });
  }

  return argon2ModulePromise;
};

const buildArgon2Options = (argon2: Argon2Module): Argon2Options => ({
  type: argon2.argon2id,
  memoryCost: configuredMemoryCost,
  timeCost: configuredTimeCost,
  parallelism: configuredParallelism,
});

export const hashPassword = async (password: string): Promise<string> => {
  const argon2 = await loadArgon2();
  const hash = await argon2.hash(password, buildArgon2Options(argon2));
  return `${ARGON2_PREFIX}${hash}`;
};

export const verifyPassword = async (
  providedPassword: string,
  storedValue: unknown
): Promise<PasswordVerificationResult> => {
  if (typeof storedValue !== 'string' || storedValue.length === 0) {
    return { isValid: false, needsRehash: false };
  }

  if (storedValue.startsWith(ARGON2_PREFIX)) {
    const argon2Hash = storedValue.slice(ARGON2_PREFIX.length);
    const argon2 = await loadArgon2();

    try {
      const isValid = await argon2.verify(argon2Hash, providedPassword);
      if (!isValid) {
        return { isValid: false, needsRehash: false };
      }

      const needsRehash =
        typeof argon2.needsRehash === 'function' &&
        argon2.needsRehash(argon2Hash, buildArgon2Options(argon2));

      if (needsRehash) {
        const newHash = await argon2.hash(providedPassword, buildArgon2Options(argon2));
        return { isValid: true, needsRehash: true, migratedHash: `${ARGON2_PREFIX}${newHash}` };
      }

      return { isValid: true, needsRehash: false };
    } catch {
      return { isValid: false, needsRehash: false };
    }
  }

  if (storedValue.startsWith(SHA256_PREFIX)) {
    const matches = verifySha256Password(providedPassword, storedValue);
    if (!matches) {
      return { isValid: false, needsRehash: false };
    }

    const migratedHash = await hashPassword(providedPassword);
    return { isValid: true, needsRehash: true, migratedHash };
  }

  if (!safeCompare(storedValue, providedPassword)) {
    return { isValid: false, needsRehash: false };
  }

  const migratedHash = await hashPassword(providedPassword);
  return { isValid: true, needsRehash: true, migratedHash };
};

export type { PasswordVerificationResult };

export const __testing = {
  resetArgon2ModuleCache(): void {
    argon2ModulePromise = null;
    argon2ModuleSource = null;
  },
};
