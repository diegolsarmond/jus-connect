interface PasswordResetEmailParams {
  userName: string;
  resetLink: string;
  temporaryPassword?: string | null;
  expiresAt?: Date | null;
  systemName?: string;
}

interface PasswordResetEmailContent {
  subject: string;
  html: string;
  text: string;
}

const DEFAULT_SYSTEM_NAME = process.env.SYSTEM_NAME || 'Quantum JUD';

function formatExpiration(date: Date): string {
  return new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
}

export function buildPasswordResetEmail({
  userName,
  resetLink,
  temporaryPassword,
  expiresAt,
  systemName = DEFAULT_SYSTEM_NAME,
}: PasswordResetEmailParams): PasswordResetEmailContent {
  const normalizedTemporaryPassword =
    typeof temporaryPassword === 'string' ? temporaryPassword.trim() : '';
  const hasTemporaryPassword = normalizedTemporaryPassword.length > 0;
  const normalizedExpiration =
    expiresAt instanceof Date && !Number.isNaN(expiresAt.getTime()) ? expiresAt : null;
  const subject = `Redefinição de senha - ${systemName}`;

  const textLines: string[] = [
    `Olá ${userName},`,
    '',
    `Uma solicitação de redefinição de senha foi realizada no ${systemName}.`,
  ];

  if (hasTemporaryPassword) {
    textLines.push(
      `Utilize a senha temporária ${normalizedTemporaryPassword} para acessar e clique no link abaixo para criar uma nova senha.`,
      resetLink
    );
  } else {
    textLines.push('Clique no link abaixo para redefinir a sua senha:', resetLink);
  }

  if (normalizedExpiration) {
    textLines.push('', `Este link é válido até ${formatExpiration(normalizedExpiration)}.`);
  }

  textLines.push(
    '',
    'Caso você não tenha solicitado, ignore este e-mail.',
    '',
    'Atenciosamente,',
    `Equipe ${systemName}`
  );

  const text = `${textLines.join('\n')}\n`;

  const htmlSections: string[] = [
    `<p>Olá ${userName},</p>`,
    `<p>Recebemos uma solicitação para redefinir a sua senha no <strong>${systemName}</strong>.</p>`,
  ];

  if (hasTemporaryPassword) {
    htmlSections.push(
      '<p>Use a senha temporária abaixo para acessar e, em seguida, clique no botão para definir uma nova senha permanente:</p>',
      `<p class="temp-pass">${normalizedTemporaryPassword}</p>`
    );
  } else {
    htmlSections.push('<p>Clique no botão abaixo para redefinir a sua senha:</p>');
  }

  htmlSections.push(
    `<p style="margin: 24px 0;">`,
    `<a class="button" href="${resetLink}" target="_blank" rel="noopener noreferrer">Recuperar senha</a>`,
    `</p>`
  );

  if (normalizedExpiration) {
    htmlSections.push(
      `<p>Este link expira em <strong>${formatExpiration(normalizedExpiration)}</strong>. Caso você não tenha solicitado esta alteração, ignore este e-mail.</p>`
    );
  } else {
    htmlSections.push('<p>Caso você não tenha solicitado esta alteração, ignore este e-mail.</p>');
  }

  htmlSections.push(
    '<p>Se o botão não funcionar, copie e cole o link abaixo no seu navegador:</p>',
    `<p><a href="${resetLink}" target="_blank" rel="noopener noreferrer">${resetLink}</a></p>`,
    `<p class="footer">Este é um e-mail automático. Por favor, não responda.<br />Equipe ${systemName}</p>`
  );

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
    htmlSections.join('') +
    `</div>` +
    `</body>` +
    `</html>`;

  return { subject, text, html };
}
