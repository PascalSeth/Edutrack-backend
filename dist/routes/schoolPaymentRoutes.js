"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const schoolPaymentController_1 = require("../controllers/schoolPaymentController");
const router = (0, express_1.Router)();
// Payment Account Management
router.get("/schools/:schoolId/payment-account", schoolPaymentController_1.getSchoolPaymentAccount);
router.post("/schools/:schoolId/payment-account", schoolPaymentController_1.createSchoolPaymentAccount);
router.put("/payment-accounts/:accountId/status", schoolPaymentController_1.updatePaymentAccountStatus);
// Statistics and History
router.get("/schools/:schoolId/payment-statistics", schoolPaymentController_1.getPaymentStatistics);
router.get("/schools/:schoolId/transfer-history", schoolPaymentController_1.getTransferHistory);
exports.default = router;
