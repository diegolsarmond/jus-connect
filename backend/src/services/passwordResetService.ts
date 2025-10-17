import crypto from 'crypto';
import pool from './db';
import { hashPassword } from '../utils/passwordUtils';
import { sendEmail } from './emailService';
import { buildPasswordResetEmail } from './passwordResetEmailTemplate';
import { getSupabaseServiceRoleClient } from './supabaseClient';
import type { SupabaseServiceRoleClient } from './supabaseClient';

const PASSWORD_RESET_TOKEN_TTL_MS = 60 * 60 * 1000; // 1 hour
const DEFAULT_FRONTEND_BASE_URL =
  process.env.FRONTEND_BASE_URL || 'https://quantumtecnologia.com.br';
const PASSWORD_RESET_PATH = process.env.PASSWORD_RESET_PATH || '/redefinir-senha';

interface TargetUser {
  id: number;
  nome_completo: string;
  email: string;
}

export function generateTemporaryPassword(length = 12): string {
  const charset = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789@#$%';
  const bytes = crypto.randomBytes(length);
  let password = '';

  for (let i = 0; i < length; i += 1) {
    const index = bytes[i] % charset.length;
    password += charset[index];
  }

  return password;
}

function generateResetToken(): { rawToken: string; tokenHash: string } {
  const rawToken = crypto.randomUUID();
  const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');
  return { rawToken, tokenHash };
}

function buildResetRedirectUrl(): string {
  const baseUrl = DEFAULT_FRONTEND_BASE_URL.endsWith('/')
    ? DEFAULT_FRONTEND_BASE_URL.slice(0, -1)
    : DEFAULT_FRONTEND_BASE_URL;
  const url = new URL(PASSWORD_RESET_PATH, `${baseUrl}/`);
  return url.toString();
}

function buildResetLink(rawToken: string): string {
  const url = new URL(buildResetRedirectUrl());
  url.searchParams.set('token', rawToken);
  return url.toString();
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

async function tryCreateSupabasePasswordResetLink(
  user: TargetUser
): Promise<string | null> {
  const supabaseClient = getSupabaseServiceRoleClient();

  if (!supabaseClient) {
    return null;
  }

  const normalizedEmail = normalizeEmail(user.email);

  if (!normalizedEmail) {
    return null;
  }

  const redirectTo = buildResetRedirectUrl();
  const { data, error } = await supabaseClient.auth.admin.generateLink({
    type: 'recovery',
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
      'UPDATE public.password_reset_tokens SET used_at = NOW() WHERE user_id = $1 AND used_at IS NULL',
      [user.id]
    );
  } catch (cleanupError) {
    console.error('Falha ao invalidar tokens antigos de redefinição de senha.', cleanupError);
  }

  return data.action_link;
}

async function createLegacyPasswordResetRequest(user: TargetUser): Promise<void> {
  const temporaryPassword = generateTemporaryPassword();
  const hashedPassword = await hashPassword(temporaryPassword);
  const { rawToken, tokenHash } = generateResetToken();
  const expiresAt = new Date(Date.now() + PASSWORD_RESET_TOKEN_TTL_MS);
  const resetLink = buildResetLink(rawToken);

  const client = await pool.connect();
  let previousPasswordValue: string | null = null;

  try {
    await client.query('BEGIN');
    const previousPasswordResult = await client.query(
      'SELECT senha FROM public.usuarios WHERE id = $1 FOR UPDATE',
      [user.id]
    );

    if (previousPasswordResult.rowCount === 0) {
      throw new Error('Usuário não encontrado ao tentar resetar senha.');
    }

    const previousPasswordRow = previousPasswordResult.rows[0] as { senha: unknown };
    previousPasswordValue =
      typeof previousPasswordRow.senha === 'string' ? previousPasswordRow.senha : null;

    await client.query(
      'UPDATE public.usuarios SET senha = $1, must_change_password = TRUE WHERE id = $2',
      [hashedPassword, user.id]
    );

    await client.query(
      'UPDATE public.password_reset_tokens SET used_at = NOW() WHERE user_id = $1 AND used_at IS NULL',
      [user.id]
    );

    await client.query(
      'INSERT INTO public.password_reset_tokens (user_id, token_hash, expires_at) VALUES ($1, $2, $3)',
      [user.id, tokenHash, expiresAt]
    );

    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }

  const email = buildPasswordResetEmail({
    userName: user.nome_completo,
    resetLink,
    temporaryPassword,
    expiresAt,
  });

  try {
    await sendEmail({
      to: user.email,
      subject: email.subject,
      html: email.html,
      text: email.text,
    });
  } catch (error) {
    try {
      await pool.query(
        'UPDATE public.usuarios SET senha = $1 WHERE id = $2',
        [previousPasswordValue, user.id]
      );
    } catch (rollbackError) {
      console.error('Falha ao restaurar senha original após erro de envio de e-mail.', rollbackError);
    }

    try {
      await pool.query(
        'UPDATE public.password_reset_tokens SET used_at = NOW() WHERE user_id = $1 AND used_at IS NULL',
        [user.id]
      );
    } catch (rollbackTokenError) {
      console.error('Falha ao invalidar tokens de redefinição após erro de envio de e-mail.', rollbackTokenError);
    }

    throw error;
  }
}

export async function createPasswordResetRequest(user: TargetUser): Promise<void> {
  try {
    const supabaseLink = await tryCreateSupabasePasswordResetLink(user);

    if (supabaseLink) {
      const emailContent = buildPasswordResetEmail({
        userName: user.nome_completo,
        resetLink: supabaseLink,
        temporaryPassword: null,
        expiresAt: null,
      });

      await sendEmail({
        to: user.email,
        subject: emailContent.subject,
        html: emailContent.html,
        text: emailContent.text,
      });

      return;
    }
  } catch (error) {
    console.error('Falha ao gerar link de redefinição de senha no Supabase.', error);
  }

  await createLegacyPasswordResetRequest(user);
}
