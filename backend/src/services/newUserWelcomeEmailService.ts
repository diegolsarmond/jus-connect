import { sendEmail } from './emailService';

interface WelcomeEmailParams {

import { buildNewUserWelcomeEmail } from './newUserWelcomeEmailTemplate';

export interface SendWelcomeEmailParams {
  to: string;
  userName: string;
  temporaryPassword: string;
}

interface WelcomeEmailContent {
  subject: string;
  text: string;
  html: string;
}

const DEFAULT_SYSTEM_NAME = process.env.SYSTEM_NAME || 'Jus Connect';
const DEFAULT_FRONTEND_BASE_URL =
  process.env.FRONTEND_BASE_URL || 'https://quantumjud.quantumtecnologia.com.br';
const DEFAULT_LOGIN_PATH = process.env.LOGIN_PATH || '/login';

function buildLoginUrl(): string {
  const baseUrl = DEFAULT_FRONTEND_BASE_URL.endsWith('/')
    ? DEFAULT_FRONTEND_BASE_URL.slice(0, -1)
    : DEFAULT_FRONTEND_BASE_URL;
  const url = new URL(DEFAULT_LOGIN_PATH, `${baseUrl}/`);
  return url.toString();
}

function buildWelcomeEmailContent({
  userName,
  temporaryPassword,
  loginUrl,
  systemName,
}: {
  userName: string;
  temporaryPassword: string;
  loginUrl: string;
  systemName: string;
}): WelcomeEmailContent {
  const subject = `Bem-vindo(a) ao ${systemName}`;
  const text =
    `Olá ${userName},\n\n` +
    `Sua conta no ${systemName} foi criada com sucesso.\n` +
    `Use a senha temporária ${temporaryPassword} para realizar o primeiro acesso em ${loginUrl}.\n` +
    `Após entrar, recomendamos que você altere a senha temporária por uma nova senha segura.\n\n` +
    `Se você não estava aguardando este acesso, entre em contato com o administrador da sua conta.\n\n` +
    `Atenciosamente,\nEquipe ${systemName}`;

  const html =
    `<!DOCTYPE html>` +
    `<html lang="pt-BR">` +
    `<head>` +
    '<meta http-equiv="Content-Type" content="text/html; charset=UTF-8" />' +
    `<title>${subject}</title>` +
    `<style>` +
    'body { font-family: Arial, sans-serif; background-color: #f4f4f5; margin: 0; padding: 0; }' +
    '.container { max-width: 600px; margin: 0 auto; background: #ffffff; padding: 32px; }' +
    '.button { display: inline-block; padding: 12px 24px; background-color: #1d4ed8; color: #ffffff; text-decoration: none; border-radius: 6px; font-weight: bold; }' +
    '.footer { font-size: 12px; color: #6b7280; margin-top: 24px; }' +
    '.temp-pass { font-size: 18px; font-weight: bold; letter-spacing: 2px; color: #111827; background: #f9fafb; padding: 12px; border-radius: 6px; display: inline-block; margin: 16px 0; }' +
    '</style>' +
    `</head>` +
    `<body>` +
    `<div class="container">` +
    `<p>Olá ${userName},</p>` +
    `<p>Sua conta no <strong>${systemName}</strong> foi criada com sucesso.</p>` +
    `<p>Use a senha temporária abaixo para realizar o primeiro acesso e depois cadastre uma nova senha segura:</p>` +
    `<p class="temp-pass">${temporaryPassword}</p>` +
    `<p style="margin: 24px 0;">` +
    `<a class="button" href="${loginUrl}" target="_blank" rel="noopener noreferrer">Acessar o ${systemName}</a>` +
    `</p>` +
    `<p>Se preferir, copie e cole o link a seguir no navegador:</p>` +
    `<p><a href="${loginUrl}" target="_blank" rel="noopener noreferrer">${loginUrl}</a></p>` +
    `<p class="footer">` +
    `Este é um e-mail automático. Por favor, não responda.` +
    `<br />Equipe ${systemName}` +
    `</p>` +
    `</div>` +
    `</body>` +
    `</html>`;

  return { subject, text, html };
}

export const newUserWelcomeEmailService = {
  async sendWelcomeEmail({ to, userName, temporaryPassword }: WelcomeEmailParams): Promise<void> {
    const loginUrl = buildLoginUrl();
    const systemName = DEFAULT_SYSTEM_NAME;
    const emailContent = buildWelcomeEmailContent({
      userName,
      temporaryPassword,
      loginUrl,
      systemName,
    });

    await sendEmail({
      to,
      subject: emailContent.subject,
      html: emailContent.html,
      text: emailContent.text,
    });
  },
};

export type NewUserWelcomeEmailService = typeof newUserWelcomeEmailService;
type SendWelcomeEmailFn = (params: SendWelcomeEmailParams) => Promise<void>;

const defaultSendWelcomeEmail: SendWelcomeEmailFn = async ({
  to,
  userName,
  temporaryPassword,
}: SendWelcomeEmailParams) => {
  const emailContent = buildNewUserWelcomeEmail({ userName, temporaryPassword });

  await sendEmail({
    to,
    subject: emailContent.subject,
    html: emailContent.html,
    text: emailContent.text,
  });
};

let sendWelcomeEmailImplementation: SendWelcomeEmailFn = defaultSendWelcomeEmail;

export const newUserWelcomeEmailService = {
  async sendWelcomeEmail(params: SendWelcomeEmailParams): Promise<void> {
    await sendWelcomeEmailImplementation(params);
  },
};

export const __setSendWelcomeEmailImplementationForTests = (fn: SendWelcomeEmailFn) => {
  sendWelcomeEmailImplementation = fn;
};

export const __resetSendWelcomeEmailImplementationForTests = () => {
  sendWelcomeEmailImplementation = defaultSendWelcomeEmail;
};
