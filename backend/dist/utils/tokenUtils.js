"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.parseExpiration = exports.verifyToken = exports.signToken = void 0;
const crypto_1 = __importDefault(require("crypto"));
const base64UrlEncode = (input) => Buffer.from(input, 'utf8').toString('base64url');
const base64UrlDecode = (input) => Buffer.from(input, 'base64url').toString('utf8');
const createSignature = (header, payload, secret) => crypto_1.default
    .createHmac('sha256', secret)
    .update(`${header}.${payload}`)
    .digest('base64url');
const timingSafeStringCompare = (a, b) => {
    const bufferA = Buffer.from(a, 'utf8');
    const bufferB = Buffer.from(b, 'utf8');
    if (bufferA.length !== bufferB.length) {
        return false;
    }
    return crypto_1.default.timingSafeEqual(bufferA, bufferB);
};
const signToken = (payload, secret, expiresInSeconds) => {
    if (!Number.isFinite(expiresInSeconds) || expiresInSeconds <= 0) {
        throw new Error('Token expiration must be a positive number of seconds.');
    }
    const header = {
        alg: 'HS256',
        typ: 'JWT',
    };
    const issuedAt = Math.floor(Date.now() / 1000);
    const tokenPayload = {
        ...payload,
        iat: issuedAt,
        exp: issuedAt + expiresInSeconds,
    };
    const encodedHeader = base64UrlEncode(JSON.stringify(header));
    const encodedPayload = base64UrlEncode(JSON.stringify(tokenPayload));
    const signature = createSignature(encodedHeader, encodedPayload, secret);
    return `${encodedHeader}.${encodedPayload}.${signature}`;
};
exports.signToken = signToken;
const verifyToken = (token, secret) => {
    const parts = token.split('.');
    if (parts.length !== 3) {
        throw new Error('Invalid token format');
    }
    const [encodedHeader, encodedPayload, providedSignature] = parts;
    const expectedSignature = createSignature(encodedHeader, encodedPayload, secret);
    if (!timingSafeStringCompare(providedSignature, expectedSignature)) {
        throw new Error('Invalid token signature');
    }
    const header = JSON.parse(base64UrlDecode(encodedHeader));
    if (header.alg !== 'HS256') {
        throw new Error('Unsupported token algorithm');
    }
    const payload = JSON.parse(base64UrlDecode(encodedPayload));
    if (typeof payload.exp !== 'number') {
        throw new Error('Token payload missing expiration');
    }
    const now = Math.floor(Date.now() / 1000);
    if (payload.exp < now) {
        throw new Error('Token expired');
    }
    return payload;
};
exports.verifyToken = verifyToken;
const durationRegex = /^(\d+)([smhd])$/i;
const durationMultipliers = {
    s: 1,
    m: 60,
    h: 60 * 60,
    d: 60 * 60 * 24,
};
const parseExpiration = (value, fallbackSeconds = 60 * 60) => {
    if (!value) {
        return fallbackSeconds;
    }
    const trimmed = value.trim();
    if (trimmed === '') {
        return fallbackSeconds;
    }
    if (/^\d+$/.test(trimmed)) {
        return Number.parseInt(trimmed, 10);
    }
    const match = trimmed.match(durationRegex);
    if (!match) {
        return fallbackSeconds;
    }
    const amount = Number.parseInt(match[1], 10);
    const unit = match[2].toLowerCase();
    const multiplier = durationMultipliers[unit];
    if (!Number.isFinite(amount) || amount <= 0 || !multiplier) {
        return fallbackSeconds;
    }
    return amount * multiplier;
};
exports.parseExpiration = parseExpiration;
