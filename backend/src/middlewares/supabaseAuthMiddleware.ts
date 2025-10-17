import crypto from 'crypto';
import type { JsonWebKey } from 'crypto';
import { NextFunction, Request, Response } from 'express';
import pool from '../services/db';

const JWKS_CACHE_TTL_MS = 5 * 60 * 1000;

type CachedJwks = {
  projectId: string;
  keys: JsonWebKey[];
  fetchedAt: number;
};

let cachedJwks: CachedJwks | null = null;
let pendingFetch: Promise<JsonWebKey[]> | null = null;

const extractBearerToken = (authorizationHeader: string | undefined): string | null => {
  if (!authorizationHeader) {
    return null;
  }

  const [scheme, token] = authorizationHeader.split(' ');

  if (!scheme || !token) {
    return null;
  }

  if (scheme.toLowerCase() !== 'bearer') {
    return null;
  }

  return token.trim() || null;
};

const base64UrlDecode = (value: string): string =>
  Buffer.from(value, 'base64url').toString('utf8');

const base64UrlToBuffer = (value: string): Buffer =>
  Buffer.from(value, 'base64url');

const parseSupabaseProjectFromUrl = (url: string): string | null => {
  try {
    const parsed = new URL(url);
    const hostname = parsed.hostname.toLowerCase();

    if (!hostname.endsWith('.supabase.co')) {
      return null;
    }

    return hostname.slice(0, hostname.length - '.supabase.co'.length);
  } catch {
    return null;
  }
};

const resolveSupabaseProjectId = (): string => {
  const explicit =
    process.env.SUPABASE_PROJECT_ID ||
    process.env.SUPABASE_PROJECT_REF ||
    process.env.SUPABASE_PROJECT;

  if (explicit && explicit.trim()) {
    return explicit.trim();
  }

  const urlCandidates = [
    process.env.SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.VITE_SUPABASE_URL,
  ];

  for (const candidate of urlCandidates) {
    if (!candidate) {
      continue;
    }

    const projectId = parseSupabaseProjectFromUrl(candidate);
    if (projectId) {
      return projectId;
    }
  }

  throw new Error('Projeto Supabase não configurado. Defina SUPABASE_PROJECT_ID ou SUPABASE_URL.');
};

const fetchJwks = async (projectId: string): Promise<JsonWebKey[]> => {
  if (
    cachedJwks &&
    cachedJwks.projectId === projectId &&
    Date.now() - cachedJwks.fetchedAt < JWKS_CACHE_TTL_MS
  ) {
    return cachedJwks.keys;
  }

  if (pendingFetch) {
    return pendingFetch;
  }

  const url = `https://${projectId}.supabase.co/auth/v1/keys`;

  pendingFetch = fetch(url, { headers: { accept: 'application/json' } })
    .then(async (response) => {
      if (!response.ok) {
        throw new Error(`Falha ao obter JWKS do Supabase (${response.status})`);
      }

      const json = (await response.json()) as { keys?: JsonWebKey[] };
      if (!json || !Array.isArray(json.keys)) {
        throw new Error('Resposta inválida ao carregar JWKS do Supabase.');
      }

      cachedJwks = {
        projectId,
        keys: json.keys,
        fetchedAt: Date.now(),
      };

      return json.keys;
    })
    .finally(() => {
      pendingFetch = null;
    });

  return pendingFetch;
};

const getJwkForKid = async (projectId: string, kid: string): Promise<JsonWebKey | null> => {
  let keys = await fetchJwks(projectId);
  let jwk = keys.find((key) => key.kid === kid) ?? null;

  if (jwk) {
    return jwk;
  }

  cachedJwks = null;
  keys = await fetchJwks(projectId);
  jwk = keys.find((key) => key.kid === kid) ?? null;

  return jwk ?? null;
};

const verifySignature = (
  token: string,
  jwk: JsonWebKey,
  algorithm: string
): boolean => {
  if (algorithm !== 'RS256') {
    throw new Error(`Algoritmo não suportado: ${algorithm}`);
  }

  const [encodedHeader, encodedPayload, encodedSignature] = token.split('.');
  if (!encodedHeader || !encodedPayload || !encodedSignature) {
    throw new Error('Formato de token inválido.');
  }

  const verifier = crypto.createVerify('RSA-SHA256');
  verifier.update(`${encodedHeader}.${encodedPayload}`);
  verifier.end();

  const keyObject = crypto.createPublicKey({ key: jwk, format: 'jwk' });
  return verifier.verify(keyObject, base64UrlToBuffer(encodedSignature));
};

const isAudienceAllowed = (audience: unknown, expected: string): boolean => {
  if (typeof audience === 'string') {
    return audience === expected;
  }

  if (Array.isArray(audience)) {
    return audience.includes(expected);
  }

  return false;
};

const parseBooleanFlag = (value: unknown): boolean | null => {
  if (typeof value === 'boolean') {
    return value;
  }

  if (typeof value === 'number') {
    if (!Number.isFinite(value)) {
      return null;
    }

    return value !== 0;
  }

  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase();
    if (!normalized) {
      return null;
    }

    if (
      ['1', 'true', 't', 'yes', 'y', 'sim', 'on', 'ativo', 'ativa', 'active'].includes(
        normalized
      )
    ) {
      return true;
    }

    if (
      ['0', 'false', 'f', 'no', 'n', 'nao', 'não', 'off', 'inativo', 'inativa', 'inactive'].includes(
        normalized
      )
    ) {
      return false;
    }
  }

  return null;
};

export const supabaseAuthMiddleware = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  const token = extractBearerToken(req.headers.authorization);

  if (!token) {
    res.status(401).json({ error: 'Token de autenticação ausente.' });
    return;
  }

  const [encodedHeader, encodedPayload] = token.split('.');

  if (!encodedHeader || !encodedPayload) {
    res.status(401).json({ error: 'Token inválido.' });
    return;
  }

  let header: Record<string, unknown>;
  let payload: Record<string, unknown>;

  try {
    header = JSON.parse(base64UrlDecode(encodedHeader)) as Record<string, unknown>;
    payload = JSON.parse(base64UrlDecode(encodedPayload)) as Record<string, unknown>;
  } catch (error) {
    console.error('Falha ao decodificar token JWT do Supabase', error);
    res.status(401).json({ error: 'Token inválido.' });
    return;
  }

  const algorithm = typeof header.alg === 'string' ? header.alg : '';
  const kid = typeof header.kid === 'string' ? header.kid : '';

  if (!kid) {
    res.status(401).json({ error: 'Token inválido.' });
    return;
  }

  let projectId: string;

  try {
    projectId = resolveSupabaseProjectId();
  } catch (error) {
    console.error(error instanceof Error ? error.message : error);
    res.status(500).json({ error: 'Configuração de autenticação ausente.' });
    return;
  }

  let jwk: JsonWebKey | null = null;

  try {
    jwk = await getJwkForKid(projectId, kid);
  } catch (error) {
    console.error('Falha ao carregar JWKS do Supabase', error);
    res.status(401).json({ error: 'Token inválido.' });
    return;
  }

  if (!jwk) {
    res.status(401).json({ error: 'Token inválido.' });
    return;
  }

  try {
    if (!verifySignature(token, jwk, algorithm)) {
      res.status(401).json({ error: 'Token inválido.' });
      return;
    }
  } catch (error) {
    console.error('Falha ao validar assinatura JWT do Supabase', error);
    res.status(401).json({ error: 'Token inválido.' });
    return;
  }

  const sub = typeof payload.sub === 'string' ? payload.sub : '';

  if (!sub) {
    res.status(401).json({ error: 'Token inválido.' });
    return;
  }

  const issuer = `https://${projectId}.supabase.co/auth/v1`;

  if (typeof payload.iss === 'string' && payload.iss !== issuer) {
    res.status(401).json({ error: 'Token inválido.' });
    return;
  }

  const expectedAudience = process.env.SUPABASE_JWT_AUDIENCE;
  if (expectedAudience) {
    if (!isAudienceAllowed(payload.aud, expectedAudience)) {
      res.status(401).json({ error: 'Token inválido.' });
      return;
    }
  }

  const now = Math.floor(Date.now() / 1000);

  if (typeof payload.exp === 'number' && payload.exp < now) {
    res.status(401).json({ error: 'Token expirado.' });
    return;
  }

  if (typeof payload.nbf === 'number' && payload.nbf > now) {
    res.status(401).json({ error: 'Token inválido.' });
    return;
  }

  let userId: number | null = null;
  let userEmail: string | undefined;
  let userName: string | undefined;

  try {
    const userResult = await pool.query(
      `SELECT id, email, status, nome_completo
         FROM public.usuarios
        WHERE supabase_user_id = $1
        LIMIT 1`,
      [sub]
    );

    if (userResult.rowCount === 0) {
      res.status(401).json({ error: 'Usuário não registrado.' });
      return;
    }

    const row = userResult.rows[0] as {
      id: unknown;
      email?: unknown;
      status?: unknown;
      nome_completo?: unknown;
    };

    if (typeof row.id !== 'number') {
      res.status(401).json({ error: 'Usuário inválido.' });
      return;
    }

    const isActive = parseBooleanFlag(row.status);
    if (isActive === false) {
      res.status(403).json({ error: 'Usuário inativo.' });
      return;
    }

    userId = row.id;
    userEmail = typeof row.email === 'string' ? row.email : undefined;
    userName = typeof row.nome_completo === 'string' ? row.nome_completo : undefined;
  } catch (error) {
    console.error('Falha ao carregar usuário vinculado ao Supabase', error);
    res.status(500).json({ error: 'Não foi possível validar o usuário autenticado.' });
    return;
  }

  const payloadWithSub = {
    ...(payload as Record<string, unknown>),
    sub,
  } as Record<string, unknown> & { sub: string };

  if (typeof payloadWithSub.email !== 'string' && userEmail) {
    payloadWithSub.email = userEmail;
  }

  if (typeof payloadWithSub.name !== 'string' && userName) {
    payloadWithSub.name = userName;
  }

  if (userId === null) {
    res.status(401).json({ error: 'Usuário inválido.' });
    return;
  }

  req.auth = {
    userId,
    email: userEmail,
    payload: payloadWithSub,
    supabaseUserId: sub,
  };

  next();
};

export default supabaseAuthMiddleware;
