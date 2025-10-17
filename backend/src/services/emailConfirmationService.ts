import crypto from 'crypto';
import pool from './db';
import { sendEmail } from './emailService';
import { buildEmailConfirmationEmail } from './emailConfirmationEmailTemplate';
import { getSupabaseServiceRoleClient } from './supabaseClient';
import type { SupabaseServiceRoleClient } from './supabaseClient';

const EMAIL_CONFIRMATION_TOKEN_TTL_MS = 24 * 60 * 60 * 1000; // 24 horas
const DEFAULT_FRONTEND_BASE_URL =
  process.env.FRONTEND_BASE_URL || 'https://quantumtecnologia.com.br';
const EMAIL_CONFIRMATION_PATH = process.env.EMAIL_CONFIRMATION_PATH || '/confirmar-email';

export interface EmailConfirmationTargetUser {
  id: number;
  nome_completo: string;
  email: string;
}

export class EmailConfirmationTokenError extends Error {
  code: 'TOKEN_INVALID' | 'TOKEN_EXPIRED' | 'TOKEN_ALREADY_USED';

  constructor(message: string, code: EmailConfirmationTokenError['code']) {
    super(message);
    this.name = 'EmailConfirmationTokenError';
    this.code = code;
  }
}

function buildFrontendBaseUrl(): string {
  const trimmed = DEFAULT_FRONTEND_BASE_URL.trim();

  if (trimmed.length === 0) {
    return 'https://quantumtecnologia.com.br';
  }

  return trimmed.endsWith('/') ? trimmed.slice(0, -1) : trimmed;
}

function buildConfirmationRedirectUrl(): string {
  const baseUrl = buildFrontendBaseUrl();
  const url = new URL(EMAIL_CONFIRMATION_PATH, `${baseUrl}/`);
  return url.toString();
}

function buildConfirmationLink(rawToken: string): string {
  const url = new URL(buildConfirmationRedirectUrl());
  url.searchParams.set('token', rawToken);
  return url.toString();
}

function generateToken(): { rawToken: string; tokenHash: string } {
  const rawToken = crypto.randomUUID();
  const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');
  return { rawToken, tokenHash };
}

function normalizeEmail(value: unknown): string | null {
  if (typeof value !== 'string') {
    return null;
  }

  const trimmed = value.trim().toLowerCase();
  return trimmed ? trimmed : null;
}

async function syncSupabaseUserId(
  supabaseClient: SupabaseServiceRoleClient,
  userId: number,
  email: string,
  userIdHint?: string | null
): Promise<void> {
  const supabaseUserId = userIdHint?.trim();

  if (supabaseUserId) {
    try {
      await pool.query(
        `UPDATE public.usuarios
            SET supabase_user_id = $2
          WHERE id = $1
            AND (supabase_user_id IS DISTINCT FROM $2 OR supabase_user_id IS NULL)`,
        [userId, supabaseUserId]
      );
    } catch (error) {
      console.error('Falha ao sincronizar identificador do Supabase para o usuário.', error);
    }

    return;
  }

  const { data, error } = await supabaseClient.auth.admin.listUsers({ email });

  if (error || !data?.users?.length) {
    return;
  }

  const matchedUser = data.users.find((entry) => {
    if (!entry.email) {
      return false;
    }

    return entry.email.trim().toLowerCase() === email;
  });

  if (!matchedUser?.id) {
    return;
  }

  try {
    await pool.query(
      `UPDATE public.usuarios
          SET supabase_user_id = $2
        WHERE id = $1
          AND (supabase_user_id IS DISTINCT FROM $2 OR supabase_user_id IS NULL)`,
      [userId, matchedUser.id]
    );
  } catch (updateError) {
    console.error('Falha ao atualizar supabase_user_id após consulta.', updateError);
  }
}

async function tryCreateSupabaseEmailConfirmationLink(
  user: EmailConfirmationTargetUser
): Promise<string | null> {
  const supabaseClient = getSupabaseServiceRoleClient();

  if (!supabaseClient) {
    return null;
  }

  const normalizedEmail = normalizeEmail(user.email);

  if (!normalizedEmail) {
    return null;
  }

  const redirectTo = buildConfirmationRedirectUrl();
  const { data, error } = await supabaseClient.auth.admin.generateLink({
    type: 'signup',
    email: normalizedEmail,
    redirectTo,
  });

  if (error) {
    throw new Error(error.message);
  }

  if (!data?.action_link) {
    return null;
  }

  await syncSupabaseUserId(supabaseClient, user.id, normalizedEmail, data.user?.id ?? null);

  try {
    await pool.query(
      `UPDATE public.email_confirmation_tokens
          SET used_at = NOW()
        WHERE user_id = $1
          AND used_at IS NULL`,
      [user.id]
    );
  } catch (cleanupError) {
    console.error('Falha ao invalidar tokens antigos de confirmação de e-mail.', cleanupError);
  }

  return data.action_link;
}

async function createLegacyEmailConfirmationToken(
  user: EmailConfirmationTargetUser
): Promise<string> {
  const { rawToken, tokenHash } = generateToken();
  const expiresAt = new Date(Date.now() + EMAIL_CONFIRMATION_TOKEN_TTL_MS);
  const confirmationLink = buildConfirmationLink(rawToken);

  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    await client.query(
      `UPDATE public.email_confirmation_tokens
          SET used_at = NOW()
        WHERE user_id = $1
          AND used_at IS NULL`,
      [user.id]
    );

    await client.query(
      `INSERT INTO public.email_confirmation_tokens (user_id, token_hash, expires_at)
       VALUES ($1, $2, $3)`,
      [user.id, tokenHash, expiresAt]
    );

    await client.query('COMMIT');
  } catch (error) {
    try {
      await client.query('ROLLBACK');
    } catch (rollbackError) {
      console.error('Falha ao reverter transação de confirmação de e-mail', rollbackError);
    }

    throw error;
  } finally {
    client.release();
  }

  return confirmationLink;
}

function parseDateValue(value: unknown): Date | null {
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value;
  }

  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!trimmed) {
      return null;
    }

    const parsed = new Date(trimmed);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }

  return null;
}

export async function createEmailConfirmationToken(
  user: EmailConfirmationTargetUser
): Promise<string> {
  try {
    const supabaseLink = await tryCreateSupabaseEmailConfirmationLink(user);

    if (supabaseLink) {
      return supabaseLink;
    }
  } catch (error) {
    console.error('Falha ao gerar link de confirmação de e-mail no Supabase.', error);
  }

  return createLegacyEmailConfirmationToken(user);
}

export async function sendEmailConfirmationToken(
  user: EmailConfirmationTargetUser
): Promise<void> {
  const confirmationLink = await createEmailConfirmationToken(user);

  const email = buildEmailConfirmationEmail({
    userName: user.nome_completo,
    confirmationLink,
  });

  try {
    await sendEmail({
      to: user.email,
      subject: email.subject,
      html: email.html,
      text: email.text,
    });
  } catch (error) {
    console.error('Falha ao enviar e-mail de confirmação de cadastro', error);
  }
}

interface ConfirmEmailTokenRow {
  id: number;
  user_id: number;
  expires_at: Date;
  used_at: Date | null;
}

export async function confirmEmailWithToken(
  rawToken: string
): Promise<{ userId: number; confirmedAt: Date }> {
  const normalizedToken = typeof rawToken === 'string' ? rawToken.trim() : '';

  if (!normalizedToken) {
    throw new EmailConfirmationTokenError('Token de confirmação inválido.', 'TOKEN_INVALID');
  }

  const tokenHash = crypto.createHash('sha256').update(normalizedToken).digest('hex');
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    const tokenResult = await client.query(
      `SELECT id, user_id, expires_at, used_at
         FROM public.email_confirmation_tokens
        WHERE token_hash = $1
        FOR UPDATE`,
      [tokenHash]
    );

    if (tokenResult.rowCount === 0) {
      throw new EmailConfirmationTokenError('Token de confirmação inválido.', 'TOKEN_INVALID');
    }

    const tokenRow = tokenResult.rows[0] as ConfirmEmailTokenRow;
    const expiresAt = parseDateValue(tokenRow.expires_at);
    const usedAt = parseDateValue(tokenRow.used_at);

    if (usedAt) {
      throw new EmailConfirmationTokenError('Token de confirmação já utilizado.', 'TOKEN_ALREADY_USED');
    }

    if (!expiresAt || expiresAt.getTime() < Date.now()) {
      throw new EmailConfirmationTokenError('Token de confirmação expirado.', 'TOKEN_EXPIRED');
    }

    const userResult = await client.query(
      `UPDATE public.usuarios
          SET email_confirmed_at = COALESCE(email_confirmed_at, NOW())
        WHERE id = $1
      RETURNING email_confirmed_at`,
      [tokenRow.user_id]
    );

    if (userResult.rowCount === 0) {
      throw new EmailConfirmationTokenError('Token de confirmação inválido.', 'TOKEN_INVALID');
    }

    const confirmedAtRaw = userResult.rows[0] as { email_confirmed_at: unknown };
    const confirmedAt = parseDateValue(confirmedAtRaw.email_confirmed_at);
    if (!confirmedAt) {
      throw new Error('Não foi possível determinar a data de confirmação do e-mail.');
    }

    await client.query(
      `UPDATE public.email_confirmation_tokens
          SET used_at = NOW()
        WHERE id = $1`,
      [tokenRow.id]
    );

    await client.query(
      `UPDATE public.email_confirmation_tokens
          SET used_at = NOW()
        WHERE user_id = $1
          AND used_at IS NULL
          AND id <> $2`,
      [tokenRow.user_id, tokenRow.id]
    );

    await client.query('COMMIT');

    return {
      userId: tokenRow.user_id,
      confirmedAt,
    };
  } catch (error) {
    await client.query('ROLLBACK');

    if (error instanceof EmailConfirmationTokenError) {
      throw error;
    }

    throw error;
  } finally {
    client.release();
  }
}
