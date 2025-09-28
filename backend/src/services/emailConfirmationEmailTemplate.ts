import { escapeHtml } from '../utils/html';

const DEFAULT_FRONTEND_BASE_URL =
  process.env.FRONTEND_BASE_URL || 'https://quantumtecnologia.com.br';
const SYSTEM_NAME = process.env.SYSTEM_NAME || 'Quantum JUD';

export interface EmailConfirmationEmailContent {
  subject: string;
  text: string;
  html: string;
}

interface BuildEmailConfirmationParams {
  userName: string;
  confirmationLink: string;
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

export function buildEmailConfirmationEmail({
  userName,
  confirmationLink,
}: BuildEmailConfirmationParams): EmailConfirmationEmailContent {
  const normalizedUserName = normalizeUserName(userName);
  const frontendBaseUrl = buildFrontendBaseUrl();
  const safeLink = confirmationLink.trim().length > 0 ? confirmationLink : frontendBaseUrl;

  const subject = `${SYSTEM_NAME} - Confirme seu e-mail`;
  const textLines = [
    `Olá ${normalizedUserName},`,
    '',
    `Para concluir seu cadastro no ${SYSTEM_NAME}, confirme seu e-mail acessando o link abaixo:`,
    safeLink,
    '',
    'Se você não realizou este cadastro, desconsidere esta mensagem.',
  ];

  const text = `${textLines.join('\n')}\n`;

  const htmlLines = [
    `<p>Olá ${escapeHtml(normalizedUserName)},</p>`,
    `<p>Para concluir seu cadastro no ${escapeHtml(SYSTEM_NAME)}, confirme seu e-mail clicando no botão abaixo:</p>`,
    `<p style="margin: 24px 0; text-align: center;">`,
    `  <a href="${escapeHtml(safeLink)}" target="_blank" rel="noopener noreferrer"`,
    '     style="background-color:#2563eb;color:#ffffff;padding:12px 24px;border-radius:8px;display:inline-block;text-decoration:none;font-weight:600;">',
    '    Confirmar e-mail',
    '  </a>',
    '</p>',
    `<p>Se o botão não funcionar, copie e cole este link no navegador:</p>`,
    `<p><a href="${escapeHtml(safeLink)}" target="_blank" rel="noopener noreferrer">${escapeHtml(safeLink)}</a></p>`,
    '<p>Se você não realizou este cadastro, desconsidere esta mensagem.</p>',
  ];

  const html = htmlLines.join('\n');

  return {
    subject,
    text,
    html,
  };
}
