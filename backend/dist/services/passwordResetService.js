"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.generateTemporaryPassword = generateTemporaryPassword;
exports.createPasswordResetRequest = createPasswordResetRequest;
const crypto_1 = __importDefault(require("crypto"));
const db_1 = __importDefault(require("./db"));
const passwordUtils_1 = require("../utils/passwordUtils");
const emailService_1 = require("./emailService");
const passwordResetEmailTemplate_1 = require("./passwordResetEmailTemplate");
const PASSWORD_RESET_TOKEN_TTL_MS = 60 * 60 * 1000; // 1 hour
const DEFAULT_FRONTEND_BASE_URL = process.env.FRONTEND_BASE_URL || 'https://quantumtecnologia.com.br';
const PASSWORD_RESET_PATH = process.env.PASSWORD_RESET_PATH || '/redefinir-senha';
function generateTemporaryPassword(length = 12) {
    const charset = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789@#$%';
    const bytes = crypto_1.default.randomBytes(length);
    let password = '';
    for (let i = 0; i < length; i += 1) {
        const index = bytes[i] % charset.length;
        password += charset[index];
    }
    return password;
}
function generateResetToken() {
    const rawToken = crypto_1.default.randomUUID();
    const tokenHash = crypto_1.default.createHash('sha256').update(rawToken).digest('hex');
    return { rawToken, tokenHash };
}
function buildResetLink(rawToken) {
    const baseUrl = DEFAULT_FRONTEND_BASE_URL.endsWith('/')
        ? DEFAULT_FRONTEND_BASE_URL.slice(0, -1)
        : DEFAULT_FRONTEND_BASE_URL;
    const url = new URL(PASSWORD_RESET_PATH, `${baseUrl}/`);
    url.searchParams.set('token', rawToken);
    return url.toString();
}
async function createPasswordResetRequest(user) {
    const temporaryPassword = generateTemporaryPassword();
    const hashedPassword = (0, passwordUtils_1.hashPassword)(temporaryPassword);
    const { rawToken, tokenHash } = generateResetToken();
    const expiresAt = new Date(Date.now() + PASSWORD_RESET_TOKEN_TTL_MS);
    const resetLink = buildResetLink(rawToken);
    const client = await db_1.default.connect();
    let previousPasswordValue = null;
    try {
        await client.query('BEGIN');
        const previousPasswordResult = await client.query('SELECT senha FROM public.usuarios WHERE id = $1 FOR UPDATE', [user.id]);
        if (previousPasswordResult.rowCount === 0) {
            throw new Error('Usuário não encontrado ao tentar resetar senha.');
        }
        const previousPasswordRow = previousPasswordResult.rows[0];
        previousPasswordValue =
            typeof previousPasswordRow.senha === 'string' ? previousPasswordRow.senha : null;
        await client.query('UPDATE public.usuarios SET senha = $1 WHERE id = $2', [hashedPassword, user.id]);
        await client.query('UPDATE public.password_reset_tokens SET used_at = NOW() WHERE user_id = $1 AND used_at IS NULL', [user.id]);
        await client.query('INSERT INTO public.password_reset_tokens (user_id, token_hash, expires_at) VALUES ($1, $2, $3)', [user.id, tokenHash, expiresAt]);
        await client.query('COMMIT');
    }
    catch (error) {
        await client.query('ROLLBACK');
        throw error;
    }
    finally {
        client.release();
    }
    const email = (0, passwordResetEmailTemplate_1.buildPasswordResetEmail)({
        userName: user.nome_completo,
        resetLink,
        temporaryPassword,
        expiresAt,
    });
    try {
        await (0, emailService_1.sendEmail)({
            to: user.email,
            subject: email.subject,
            html: email.html,
            text: email.text,
        });
    }
    catch (error) {
        try {
            await db_1.default.query('UPDATE public.usuarios SET senha = $1 WHERE id = $2', [previousPasswordValue, user.id]);
        }
        catch (rollbackError) {
            console.error('Falha ao restaurar senha original após erro de envio de e-mail.', rollbackError);
        }
        try {
            await db_1.default.query('UPDATE public.password_reset_tokens SET used_at = NOW() WHERE user_id = $1 AND used_at IS NULL', [user.id]);
        }
        catch (rollbackTokenError) {
            console.error('Falha ao invalidar tokens de redefinição após erro de envio de e-mail.', rollbackTokenError);
        }
        throw error;
    }
}
