"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.buildPasswordResetEmail = buildPasswordResetEmail;
const DEFAULT_SYSTEM_NAME = process.env.SYSTEM_NAME || 'Jus Connect';
function formatExpiration(date) {
    return new Intl.DateTimeFormat('pt-BR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
    }).format(date);
}
function buildPasswordResetEmail({ userName, resetLink, temporaryPassword, expiresAt, systemName = DEFAULT_SYSTEM_NAME, }) {
    const expirationText = formatExpiration(expiresAt);
    const subject = `Redefinição de senha - ${systemName}`;
    const text = `Olá ${userName},\n\n` +
        `Uma solicitação de redefinição de senha foi realizada no ${systemName}.\n` +
        `Utilize a senha temporária ${temporaryPassword} para acessar e clique no link abaixo para criar uma nova senha.\n` +
        `${resetLink}\n\n` +
        `Este link é válido até ${expirationText}. Caso você não tenha solicitado, ignore este e-mail.\n\n` +
        `Atenciosamente,\nEquipe ${systemName}`;
    const html = `<!DOCTYPE html>` +
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
        `<p>Recebemos uma solicitação para redefinir a sua senha no <strong>${systemName}</strong>.</p>` +
        `<p>Use a senha temporária abaixo para acessar e, em seguida, clique no botão para definir uma nova senha permanente:</p>` +
        `<p class="temp-pass">${temporaryPassword}</p>` +
        `<p style="margin: 24px 0;">` +
        `<a class="button" href="${resetLink}" target="_blank" rel="noopener noreferrer">Recuperar senha</a>` +
        `</p>` +
        `<p>Este link expira em <strong>${expirationText}</strong>. Caso você não tenha solicitado esta alteração, ignore este e-mail.</p>` +
        `<p>Se o botão não funcionar, copie e cole o link abaixo no seu navegador:</p>` +
        `<p><a href="${resetLink}" target="_blank" rel="noopener noreferrer">${resetLink}</a></p>` +
        `<p class="footer">` +
        `Este é um e-mail automático. Por favor, não responda.` +
        `<br />Equipe ${systemName}` +
        `</p>` +
        `</div>` +
        `</body>` +
        `</html>`;
    return { subject, text, html };
}
