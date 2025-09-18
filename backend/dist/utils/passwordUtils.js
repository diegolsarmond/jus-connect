"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.verifyPassword = void 0;
const crypto_1 = __importDefault(require("crypto"));
const safeCompare = (a, b) => {
    const bufferA = Buffer.from(a, 'utf8');
    const bufferB = Buffer.from(b, 'utf8');
    if (bufferA.length !== bufferB.length) {
        return false;
    }
    return crypto_1.default.timingSafeEqual(bufferA, bufferB);
};
const SHA256_PREFIX = 'sha256:';
const verifySha256Password = (password, storedValue) => {
    const parts = storedValue.split(':');
    if (parts.length !== 3) {
        return false;
    }
    const [, salt, digest] = parts;
    const computedDigest = crypto_1.default
        .createHash('sha256')
        .update(`${salt}:${password}`)
        .digest('hex');
    return safeCompare(digest, computedDigest);
};
const verifyPassword = async (providedPassword, storedValue) => {
    if (typeof storedValue !== 'string' || storedValue.length === 0) {
        return false;
    }
    if (storedValue.startsWith(SHA256_PREFIX)) {
        return verifySha256Password(providedPassword, storedValue);
    }
    return safeCompare(providedPassword, storedValue);
};
exports.verifyPassword = verifyPassword;
