"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.notificationProviderRegistry = void 0;
exports.registerNotificationProvider = registerNotificationProvider;
exports.getNotificationProvider = getNotificationProvider;
exports.listNotificationProviders = listNotificationProviders;
const pjeNotificationService_1 = require("./pjeNotificationService");
const juditNotificationService_1 = require("./juditNotificationService");
const projudiNotificationService_1 = require("./projudiNotificationService");
const registry = new Map();
function registerNotificationProvider(provider, identifier) {
    const derivedId = identifier ?? provider.id;
    if (!derivedId || typeof derivedId !== 'string') {
        throw new Error('Notification provider must define an identifier');
    }
    registry.set(derivedId.toLowerCase(), provider);
}
function getNotificationProvider(identifier) {
    if (!identifier) {
        return undefined;
    }
    return registry.get(identifier.toLowerCase());
}
function listNotificationProviders() {
    return Array.from(registry.values());
}
registerNotificationProvider(pjeNotificationService_1.pjeNotificationProvider, 'pje');
registerNotificationProvider(juditNotificationService_1.juditNotificationProvider, 'judit');
registerNotificationProvider(projudiNotificationService_1.projudiNotificationProvider, 'projudi');
exports.notificationProviderRegistry = registry;
