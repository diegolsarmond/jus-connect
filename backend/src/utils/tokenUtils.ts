import crypto from 'crypto';

export interface TokenPayload extends Record<string, unknown> {
  sub: string | number;
  iat: number;
  exp: number;
}

const base64UrlEncode = (input: string): string =>
  Buffer.from(input, 'utf8').toString('base64url');

const base64UrlDecode = (input: string): string =>
  Buffer.from(input, 'base64url').toString('utf8');

const createSignature = (
  header: string,
  payload: string,
  secret: string
): string =>
  crypto
    .createHmac('sha256', secret)
    .update(`${header}.${payload}`)
    .digest('base64url');

const timingSafeStringCompare = (a: string, b: string): boolean => {
  const bufferA = Buffer.from(a, 'utf8');
  const bufferB = Buffer.from(b, 'utf8');

  if (bufferA.length !== bufferB.length) {
    return false;
  }

  return crypto.timingSafeEqual(bufferA, bufferB);
};

export const signToken = (
  payload: Record<string, unknown>,
  secret: string,
  expiresInSeconds: number
): string => {
  if (!Number.isFinite(expiresInSeconds) || expiresInSeconds <= 0) {
    throw new Error('Token expiration must be a positive number of seconds.');
  }

  const header = {
    alg: 'HS256',
    typ: 'JWT',
  } satisfies Record<string, string>;

  const issuedAt = Math.floor(Date.now() / 1000);
  const tokenPayload: TokenPayload = {
    ...payload,
    iat: issuedAt,
    exp: issuedAt + expiresInSeconds,
  } as TokenPayload;

  const encodedHeader = base64UrlEncode(JSON.stringify(header));
  const encodedPayload = base64UrlEncode(JSON.stringify(tokenPayload));
  const signature = createSignature(encodedHeader, encodedPayload, secret);

  return `${encodedHeader}.${encodedPayload}.${signature}`;
};

export const verifyToken = (token: string, secret: string): TokenPayload => {
  const parts = token.split('.');
  if (parts.length !== 3) {
    throw new Error('Invalid token format');
  }

  const [encodedHeader, encodedPayload, providedSignature] = parts;

  const expectedSignature = createSignature(encodedHeader, encodedPayload, secret);

  if (!timingSafeStringCompare(providedSignature, expectedSignature)) {
    throw new Error('Invalid token signature');
  }

  const header = JSON.parse(base64UrlDecode(encodedHeader)) as Record<string, unknown>;

  if (header.alg !== 'HS256') {
    throw new Error('Unsupported token algorithm');
  }

  const payload = JSON.parse(base64UrlDecode(encodedPayload)) as TokenPayload;

  if (typeof payload.exp !== 'number') {
    throw new Error('Token payload missing expiration');
  }

  const now = Math.floor(Date.now() / 1000);
  if (payload.exp < now) {
    throw new Error('Token expired');
  }

  return payload;
};

const durationRegex = /^(\d+)([smhd])$/i;

const durationMultipliers: Record<string, number> = {
  s: 1,
  m: 60,
  h: 60 * 60,
  d: 60 * 60 * 24,
};

export const parseExpiration = (value: string | undefined, fallbackSeconds = 60 * 60): number => {
  if (!value) {
    return fallbackSeconds;
  }

  const trimmed = value.trim();

  if (trimmed === '') {
    return fallbackSeconds;
  }

  if (/^\d+$/.test(trimmed)) {
    return Number.parseInt(trimmed, 10);
  }

  const match = trimmed.match(durationRegex);

  if (!match) {
    return fallbackSeconds;
  }

  const amount = Number.parseInt(match[1], 10);
  const unit = match[2].toLowerCase();

  const multiplier = durationMultipliers[unit];

  if (!Number.isFinite(amount) || amount <= 0 || !multiplier) {
    return fallbackSeconds;
  }

  return amount * multiplier;
};
