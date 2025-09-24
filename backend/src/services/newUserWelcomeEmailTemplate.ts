import { escapeHtml } from '../utils/html';

const DEFAULT_FRONTEND_BASE_URL =
  process.env.FRONTEND_BASE_URL || 'https://quantumtecnologia.com.br';
const SYSTEM_NAME = process.env.SYSTEM_NAME || 'Jus Connect';

export interface NewUserWelcomeEmailContent {
  subject: string;
  text: string;
  html: string;
}

interface BuildNewUserWelcomeEmailParams {
  userName: string;
  temporaryPassword: string;
}

function buildFrontendBaseUrl(): string {
  const trimmed = DEFAULT_FRONTEND_BASE_URL.trim();

  if (trimmed.length === 0) {
    return 'https://quantumtecnologia.com.br';
  }

  return trimmed.endsWith('/') ? trimmed.slice(0, -1) : trimmed;
}

function normalizeUserName(rawName: string): string {
  const trimmed = rawName.trim();
  return trimmed.length > 0 ? trimmed : 'Usuário';
}

export function buildNewUserWelcomeEmail({
  userName,
  temporaryPassword,
}: BuildNewUserWelcomeEmailParams): NewUserWelcomeEmailContent {
  const normalizedUserName = normalizeUserName(userName);
  const frontendBaseUrl = buildFrontendBaseUrl();

  const subject = `${SYSTEM_NAME} - Acesso ao sistema`;
  const textLines = [
    `Olá ${normalizedUserName},`,
    '',
    `Sua conta no ${SYSTEM_NAME} foi criada com sucesso.`,
    'Utilize a senha provisória abaixo para realizar o primeiro acesso:',
    temporaryPassword,
    '',
    `Acesse: ${frontendBaseUrl}`,
    '',
    'Recomendamos alterar a senha após concluir o primeiro login.',
  ];

  const text = `${textLines.join('\n')}\n`;

  const htmlLines = [
    `<p>Olá ${escapeHtml(normalizedUserName)},</p>`,
    `<p>Sua conta no ${escapeHtml(SYSTEM_NAME)} foi criada com sucesso.</p>`,
    '<p>Utilize a senha provisória abaixo para realizar o primeiro acesso:</p>',
    `<p style="font-size: 18px; font-weight: bold;">${escapeHtml(temporaryPassword)}</p>`,
    `<p>Acesse: <a href="${escapeHtml(frontendBaseUrl)}" target="_blank" rel="noopener noreferrer">${escapeHtml(frontendBaseUrl)}</a></p>`,
    '<p>Recomendamos alterar a senha após concluir o primeiro login.</p>',
  ];

  const html = htmlLines.join('\n');

  return {
    subject,
    text,
    html,
  };
}
