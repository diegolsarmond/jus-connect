import net from 'net';
import tls from 'tls';
import os from 'os';

interface SmtpAuthConfig {
  user: string;
  pass: string;
}

interface SmtpConfig {
  host: string;
  port: number;
  secure: boolean;
  auth: SmtpAuthConfig;
  rejectUnauthorized: boolean;
}

const parseBoolean = (value: string | undefined, defaultValue: boolean): boolean => {
  if (typeof value !== 'string') {
    return defaultValue;
  }

  const normalized = value.trim().toLowerCase();
  if (['1', 'true', 'yes', 'y'].includes(normalized)) {
    return true;
  }

  if (['0', 'false', 'no', 'n'].includes(normalized)) {
    return false;
  }

  return defaultValue;
};

const smtpUser = process.env.SMTP_USER;
const smtpPass = process.env.SMTP_PASSWORD ?? process.env.SMTP_PASS;
const isSmtpConfigured = Boolean(smtpUser && smtpPass);

const DEFAULT_SMTP_CONFIG: SmtpConfig | null = isSmtpConfigured
  ? {
      host: process.env.SMTP_HOST || 'smtp.resend.com',
      port: Number.parseInt(process.env.SMTP_PORT || '587', 10),
      secure: parseBoolean(process.env.SMTP_SECURE, false),
      rejectUnauthorized: parseBoolean(process.env.SMTP_REJECT_UNAUTHORIZED, true),
      auth: {
        user: smtpUser!,
        pass: smtpPass!,
      },
    }
  : null;

const systemName = process.env.SYSTEM_NAME || 'Quantum JUD';
const fallbackFromAddress = 'no-reply@quantumtecnologia.com.br';
const smtpFrom = process.env.SMTP_FROM;
const normalizedSmtpFrom = smtpFrom?.trim();
const normalizedSmtpUser = smtpUser?.trim();
const resolveValidAddress = (value: string | undefined | null) =>
  value && value.includes('@') ? value : null;
const defaultFromAddress =
  resolveValidAddress(normalizedSmtpFrom) ??
  resolveValidAddress(normalizedSmtpUser) ??
  fallbackFromAddress;
const usingFallbackFromAddress =
  !resolveValidAddress(normalizedSmtpFrom) && !resolveValidAddress(normalizedSmtpUser);
const defaultFromName = process.env.SMTP_FROM_NAME || systemName;

export interface SendEmailParams {
  to: string;
  subject: string;
  html: string;
  text: string;
}

interface SmtpResponse {
  code: number;
  message: string;
}

const CRLF = '\r\n';

type SmtpSocket = net.Socket;

function waitForResponse(socket: SmtpSocket, timeoutMs = 15000): Promise<SmtpResponse> {
  return new Promise((resolve, reject) => {
    let buffer = '';
    let resolved = false;

    const handleData = (data: Buffer) => {
      buffer += data.toString('utf8');
      const lines = buffer.split(/\r?\n/).filter((line) => line.length > 0);
      if (lines.length === 0) {
        return;
      }
      const lastLine = lines[lines.length - 1];
      if (lastLine.length >= 4 && lastLine[3] === ' ') {
        const code = Number.parseInt(lastLine.slice(0, 3), 10);
        resolved = true;
        cleanup();
        resolve({ code, message: buffer });
      }
    };

    const handleError = (error: Error) => {
      if (!resolved) {
        resolved = true;
        cleanup();
        reject(error);
      }
    };

    const handleClose = () => {
      if (!resolved) {
        resolved = true;
        cleanup();
        reject(new Error('Conexão SMTP encerrada inesperadamente.'));
      }
    };

    const handleTimeout = () => {
      if (!resolved) {
        resolved = true;
        cleanup();
        reject(new Error('Tempo de espera excedido durante comunicação SMTP.'));
      }
    };

    const cleanup = () => {
      socket.off('data', handleData);
      socket.off('error', handleError);
      socket.off('close', handleClose);
      socket.off('timeout', handleTimeout);
    };

    socket.on('data', handleData);
    socket.on('error', handleError);
    socket.on('close', handleClose);
    socket.setTimeout(timeoutMs, handleTimeout);
  });
}

async function sendCommand(
  socket: SmtpSocket,
  command: string | null,
  expectedCodes: number[]
): Promise<SmtpResponse> {
  if (command) {
    socket.write(`${command}${CRLF}`);
  }

  const response = await waitForResponse(socket);

  if (!expectedCodes.includes(response.code)) {
    throw new Error(`SMTP comando "${command ?? '<inicial>'}" retornou código ${response.code}: ${response.message}`);
  }

  return response;
}

function buildMessageHeaders(to: string, subject: string, boundary: string): string[] {
  return [
    `From: ${defaultFromName} <${defaultFromAddress}>`,
    `To: ${to}`,
    `Subject: ${subject}`,
    'MIME-Version: 1.0',
    `Content-Type: multipart/alternative; boundary="${boundary}"`,
  ];
}

function sanitizeMessageBody(content: string): string {
  return content.replace(/^(\.)/gm, '..$1');
}

function buildMessageBody(text: string, html: string, boundary: string): string {
  const parts = [
    `--${boundary}`,
    'Content-Type: text/plain; charset="utf-8"',
    'Content-Transfer-Encoding: 8bit',
    '',
    text,
    '',
    `--${boundary}`,
    'Content-Type: text/html; charset="utf-8"',
    'Content-Transfer-Encoding: 8bit',
    '',
    html,
    '',
    `--${boundary}--`,
    '',
  ];

  return parts.join(CRLF);
}

function createTlsConnection(options: tls.ConnectionOptions): Promise<tls.TLSSocket> {
  return new Promise((resolve, reject) => {
    const socket = tls.connect(options, () => {
      socket.off('error', handleError);
      resolve(socket);
    });
    const handleError = (error: Error) => {
      socket.destroy();
      reject(error);
    };
    socket.once('error', handleError);
  });
}

export async function sendEmail({ to, subject, html, text }: SendEmailParams): Promise<void> {
  if (!DEFAULT_SMTP_CONFIG) {
    console.warn(
      'Configuração SMTP ausente. Defina SMTP_USER e SMTP_PASSWORD (ou SMTP_PASS) para habilitar o envio de e-mails.'
    );
    return;
  }

  if (usingFallbackFromAddress) {
    console.warn(
      `Remetente SMTP padrão indefinido ou inválido. Defina SMTP_FROM com um endereço de e-mail válido. Usando "${fallbackFromAddress}" como padrão.`
    );
  }

  if (!defaultFromAddress || !defaultFromAddress.includes('@')) {
    console.error(
      'Não foi possível determinar um remetente SMTP válido. Defina SMTP_FROM com um endereço de e-mail válido.'
    );
    return;
  }

  const { host, port, auth, rejectUnauthorized, secure } = DEFAULT_SMTP_CONFIG;
  const clientName = os.hostname() || 'localhost';
  const boundary = `----=_Boundary_${Date.now().toString(36)}_${Math.random().toString(36).slice(2)}`;
  const headers = buildMessageHeaders(to, subject, boundary);
  const messageBody = buildMessageBody(text, html, boundary);
  const message = sanitizeMessageBody([...headers, '', messageBody].join(CRLF));

  let socket: SmtpSocket;

  if (secure) {
    socket = await createTlsConnection({
      host,
      port,
      rejectUnauthorized,
    });
  } else {
    const plainSocket = net.createConnection({ host, port });

    try {
      await waitForResponse(plainSocket); // 220 greeting
      await sendCommand(plainSocket, `EHLO ${clientName}`, [250]);
      await sendCommand(plainSocket, 'STARTTLS', [220]);
    } catch (error) {
      plainSocket.end();
      throw error;
    }

    socket = await createTlsConnection({
      host,
      rejectUnauthorized,
      socket: plainSocket,
    });
  }

  try {
    if (secure) {
      await waitForResponse(socket); // 220 greeting
    }
    await sendCommand(socket, `EHLO ${clientName}`, [250]);
    await sendCommand(socket, 'AUTH LOGIN', [334]);
    await sendCommand(socket, Buffer.from(auth.user, 'utf8').toString('base64'), [334]);
    await sendCommand(socket, Buffer.from(auth.pass, 'utf8').toString('base64'), [235]);
    await sendCommand(socket, `MAIL FROM:<${defaultFromAddress}>`, [250]);
    await sendCommand(socket, `RCPT TO:<${to}>`, [250, 251]);
    await sendCommand(socket, 'DATA', [354]);
    socket.write(`${message}${CRLF}.${CRLF}`);
    await sendCommand(socket, null, [250]);
    await sendCommand(socket, 'QUIT', [221]);
  } finally {
    socket.end();
  }
}
