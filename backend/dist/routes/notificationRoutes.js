"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const notificationController_1 = require("../controllers/notificationController");
const registry_1 = require("../services/notificationProviders/registry");
const types_1 = require("../services/notificationProviders/types");
const router = (0, express_1.Router)();
router.get('/notifications', notificationController_1.listNotificationsHandler);
router.get('/notifications/unread-count', notificationController_1.getUnreadCountHandler);
router.get('/notifications/preferences', notificationController_1.getNotificationPreferencesHandler);
router.get('/notifications/:id', notificationController_1.getNotificationHandler);
router.post('/notifications', notificationController_1.createNotificationHandler);
router.post('/notifications/webhooks/:providerId?', async (req, res) => {
    const headerProvider = req.header('x-notification-provider') ??
        req.header('x-notification-source') ??
        req.header('x-provider-id');
    const providerId = (req.params.providerId || headerProvider)?.toLowerCase();
    if (!providerId) {
        return res.status(400).json({ error: 'Notification provider identifier is required' });
    }
    const provider = (0, registry_1.getNotificationProvider)(providerId);
    if (!provider) {
        return res.status(404).json({ error: `Notification provider '${providerId}' not found` });
    }
    try {
        const notifications = await provider.handleWebhook(req);
        res.status(202).json({
            provider: providerId,
            received: notifications.length,
            notifications,
        });
    }
    catch (error) {
        if (error instanceof types_1.NotificationProviderError) {
            return res.status(error.statusCode).json({ error: error.message });
        }
        console.error(`Failed to handle webhook from provider ${providerId}`, error);
        res.status(500).json({ error: 'Failed to process notification webhook' });
    }
});
router.post('/notifications/pje/webhook', notificationController_1.receivePjeNotificationHandler);
router.get('/notificacoes/projudi/sync', notificationController_1.triggerProjudiSyncHandler);
router.post('/notifications/read-all', notificationController_1.markAllNotificationsAsReadHandler);
router.post('/notifications/:id/read', notificationController_1.markNotificationAsReadHandler);
router.post('/notifications/:id/unread', notificationController_1.markNotificationAsUnreadHandler);
router.put('/notifications/preferences', notificationController_1.updateNotificationPreferencesHandler);
router.delete('/notifications/:id', notificationController_1.deleteNotificationHandler);
exports.default = router;
