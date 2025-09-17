"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const wahaWebhookController_1 = require("../controllers/wahaWebhookController");
const router = (0, express_1.Router)();
router.post('/webhooks/waha', wahaWebhookController_1.handleWahaWebhook);
exports.default = router;
