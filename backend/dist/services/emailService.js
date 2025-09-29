"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.sendEmail = sendEmail;
const tls_1 = __importDefault(require("tls"));
const os_1 = __importDefault(require("os"));
const parseBoolean = (value, defaultValue) => {
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
if (!smtpUser || !smtpPass) {
    const missingParts = [];
    if (!smtpUser) {
        missingParts.push('SMTP_USER');
    }
    if (!smtpPass) {
        missingParts.push('SMTP_PASSWORD (ou SMTP_PASS)');
    }
    const missingDescription = missingParts.join(' e ');
    throw new Error(`Configuração SMTP inválida. Defina ${missingDescription} como variáveis de ambiente antes de iniciar o servidor.`);
}
const DEFAULT_SMTP_CONFIG = {
    host: process.env.SMTP_HOST || 'smtp.hostinger.com',
    port: Number.parseInt(process.env.SMTP_PORT || '465', 10),
    secure: parseBoolean(process.env.SMTP_SECURE, true),
    rejectUnauthorized: parseBoolean(process.env.SMTP_REJECT_UNAUTHORIZED, true),
    auth: {
        user: smtpUser,
        pass: smtpPass,
    },
};
const systemName = process.env.SYSTEM_NAME || 'Quantum JUD';
const defaultFromAddress = process.env.SMTP_FROM || DEFAULT_SMTP_CONFIG.auth.user;
const defaultFromName = process.env.SMTP_FROM_NAME || systemName;
const CRLF = '\r\n';
function waitForResponse(socket, timeoutMs = 15000) {
    return new Promise((resolve, reject) => {
        let buffer = '';
        let resolved = false;
        const handleData = (data) => {
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
        const handleError = (error) => {
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
async function sendCommand(socket, command, expectedCodes) {
    if (command) {
        socket.write(`${command}${CRLF}`);
    }
    const response = await waitForResponse(socket);
    if (!expectedCodes.includes(response.code)) {
        throw new Error(`SMTP comando "${command ?? '<inicial>'}" retornou código ${response.code}: ${response.message}`);
    }
    return response;
}
function buildMessageHeaders(to, subject, boundary) {
    return [
        `From: ${defaultFromName} <${defaultFromAddress}>`,
        `To: ${to}`,
        `Subject: ${subject}`,
        'MIME-Version: 1.0',
        `Content-Type: multipart/alternative; boundary="${boundary}"`,
    ];
}
function sanitizeMessageBody(content) {
    return content.replace(/^(\.)/gm, '..$1');
}
function buildMessageBody(text, html, boundary) {
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
async function sendEmail({ to, subject, html, text }) {
    const { host, port, auth, rejectUnauthorized } = DEFAULT_SMTP_CONFIG;
    const clientName = os_1.default.hostname() || 'localhost';
    const boundary = `----=_Boundary_${Date.now().toString(36)}_${Math.random().toString(36).slice(2)}`;
    const headers = buildMessageHeaders(to, subject, boundary);
    const messageBody = buildMessageBody(text, html, boundary);
    const message = sanitizeMessageBody([...headers, '', messageBody].join(CRLF));
    const socket = tls_1.default.connect({
        host,
        port,
        rejectUnauthorized,
    });
    try {
        await waitForResponse(socket); // 220 greeting
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
    }
    finally {
        socket.end();
    }
}
