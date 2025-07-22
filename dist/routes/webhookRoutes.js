"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const webhookController_1 = require("../controllers/webhookController");
const router = (0, express_1.Router)();
// Webhook endpoints
router.post("/paystack", webhookController_1.handlePaystackWebhook);
// Manual operations
router.post("/payments/:paymentId/retry-transfer", webhookController_1.retryTransfer);
exports.default = router;
