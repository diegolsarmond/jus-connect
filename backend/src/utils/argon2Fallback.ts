import crypto from 'node:crypto';
import type { Argon2Module, Argon2Options } from './argon2Types';

const ARGON2_VERSION = 19;
const DEFAULT_MEMORY_COST = 19_456;
const DEFAULT_TIME_COST = 2;
const DEFAULT_PARALLELISM = 1;
const DEFAULT_SALT_LENGTH = 16;

type NormalizedOptions = {
  memoryCost: number;
  timeCost: number;
  parallelism: number;
  saltLength: number;
};

const clamp = (value: number, min: number, max: number): number => {
  if (Number.isNaN(value)) {
    return min;
  }
  return Math.min(Math.max(value, min), max);
};

const parseIntegerOption = (
  value: unknown,
  fallback: number,
  min: number,
  max: number
): number => {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return clamp(Math.trunc(value), min, max);
  }

  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (trimmed.length > 0) {
      const parsed = Number.parseInt(trimmed, 10);
      if (Number.isFinite(parsed)) {
        return clamp(parsed, min, max);
      }
    }
  }

  return clamp(fallback, min, max);
};

const normalizeOptions = (options?: Argon2Options): NormalizedOptions => ({
  memoryCost: parseIntegerOption(options?.memoryCost, DEFAULT_MEMORY_COST, 1024, 1 << 22),
  timeCost: parseIntegerOption(options?.timeCost, DEFAULT_TIME_COST, 1, 10),
  parallelism: parseIntegerOption(options?.parallelism, DEFAULT_PARALLELISM, 1, 8),
  saltLength: parseIntegerOption(options?.saltLength, DEFAULT_SALT_LENGTH, 8, 64),
});

const toBase64 = (value: Buffer): string => value.toString('base64');
const fromBase64 = (value: string): Buffer => Buffer.from(value, 'base64');

const toPowerOfTwo = (value: number): number => {
  const exponent = Math.round(Math.log2(value));
  const clampedExponent = clamp(exponent, 10, 20);
  return 1 << clampedExponent;
};

const deriveKey = (
  password: string,
  salt: Buffer,
  options: NormalizedOptions
): Buffer => {
  const { memoryCost, timeCost, parallelism } = options;
  const N = toPowerOfTwo(memoryCost);
  const r = 8;
  const p = clamp(parallelism * timeCost, 1, 16);
  const maxmem = Math.max(32 * 1024 * 1024, 128 * N * r * Math.max(1, p));
  return crypto.scryptSync(password, salt, 32, {
    N,
    r,
    p,
    maxmem,
  });
};

const encodeOptions = (options: NormalizedOptions): string =>
  `m=${options.memoryCost},t=${options.timeCost},p=${options.parallelism}`;

const parseEncodedOptions = (segment: string): NormalizedOptions | null => {
  const pairs = segment.split(',');
  const result: Partial<NormalizedOptions> = {};

  for (const pair of pairs) {
    const [key, rawValue] = pair.split('=');
    if (!key || !rawValue) {
      return null;
    }

    const value = Number.parseInt(rawValue, 10);
    if (!Number.isFinite(value)) {
      return null;
    }

    if (key === 'm') {
      result.memoryCost = clamp(value, 1024, 1 << 22);
    } else if (key === 't') {
      result.timeCost = clamp(value, 1, 10);
    } else if (key === 'p') {
      result.parallelism = clamp(value, 1, 8);
    }
  }

  if (
    result.memoryCost == null ||
    result.timeCost == null ||
    result.parallelism == null
  ) {
    return null;
  }

  return {
    memoryCost: result.memoryCost,
    timeCost: result.timeCost,
    parallelism: result.parallelism,
    saltLength: DEFAULT_SALT_LENGTH,
  };
};

const parseHash = (
  hash: string
): { options: NormalizedOptions; salt: Buffer; digest: Buffer } | null => {
  const trimmed = hash.trim();
  if (!trimmed.startsWith('$argon2id$')) {
    return null;
  }

  const parts = trimmed.split('$');
  if (parts.length !== 6) {
    return null;
  }

  const [, , versionPart, encodedOptions, encodedSalt, encodedDigest] = parts;

  if (!versionPart.startsWith('v=')) {
    return null;
  }

  const parsedVersion = Number.parseInt(versionPart.slice(2), 10);
  if (!Number.isFinite(parsedVersion) || parsedVersion !== ARGON2_VERSION) {
    return null;
  }

  const options = parseEncodedOptions(encodedOptions);
  if (!options) {
    return null;
  }

  try {
    const salt = fromBase64(encodedSalt);
    const digest = fromBase64(encodedDigest);
    return { options: { ...options, saltLength: salt.length }, salt, digest };
  } catch {
    return null;
  }
};

const fallback: Argon2Module = {
  argon2id: 2,
  async hash(password: string, options?: Argon2Options): Promise<string> {
    const normalized = normalizeOptions(options);
    const salt = crypto.randomBytes(normalized.saltLength);
    const digest = deriveKey(password, salt, normalized);
    return `$argon2id$v=${ARGON2_VERSION}$${encodeOptions(normalized)}$${toBase64(salt)}$${toBase64(digest)}`;
  },
  async verify(hash: string, password: string): Promise<boolean> {
    const parsed = parseHash(hash);
    if (!parsed) {
      return false;
    }

    const { options, salt, digest } = parsed;
    const computed = deriveKey(password, salt, options);
    if (computed.length !== digest.length) {
      return false;
    }

    return crypto.timingSafeEqual(computed, digest);
  },
  needsRehash(hash: string, options?: Argon2Options): boolean {
    const parsed = parseHash(hash);
    if (!parsed) {
      return true;
    }

    const normalized = normalizeOptions(options);

    return (
      parsed.options.memoryCost !== normalized.memoryCost ||
      parsed.options.timeCost !== normalized.timeCost ||
      parsed.options.parallelism !== normalized.parallelism ||
      parsed.options.saltLength !== normalized.saltLength
    );
  },
};

export default fallback;
