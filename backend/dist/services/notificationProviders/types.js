"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.NotificationProviderError = void 0;
class NotificationProviderError extends Error {
    constructor(message, statusCode = 400) {
        super(message);
        this.statusCode = statusCode;
        this.name = 'NotificationProviderError';
    }
}
exports.NotificationProviderError = NotificationProviderError;
