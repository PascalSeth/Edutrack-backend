"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const materialOrderController_1 = require("../controllers/materialOrderController");
const router = (0, express_1.Router)();
// Order Management
router.post("/parents/:parentId/schools/:schoolId/orders", materialOrderController_1.createOrderFromCart);
router.get("/parents/:parentId/orders", materialOrderController_1.getParentOrders);
router.get("/schools/:schoolId/orders", materialOrderController_1.getSchoolOrders);
router.get("/orders/:orderId", materialOrderController_1.getOrderDetails);
router.put("/orders/:orderId/status", materialOrderController_1.updateOrderStatus);
router.put("/orders/:orderId/cancel", materialOrderController_1.cancelOrder);
// Payment
router.post("/orders/:orderId/payment/initialize", materialOrderController_1.initializeOrderPayment);
router.get("/orders/payment/verify/:reference", materialOrderController_1.verifyOrderPayment);
exports.default = router;
