"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AiProviderError = void 0;
class AiProviderError extends Error {
    constructor(message, statusCode = 502) {
        super(message);
        this.statusCode = statusCode;
        this.name = 'AiProviderError';
    }
}
exports.AiProviderError = AiProviderError;
