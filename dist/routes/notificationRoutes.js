"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const notificationController_1 = require("../controllers/notificationController");
const setup_1 = require("../utils/setup");
const router = (0, express_1.Router)();
// Get user notifications
router.get("/", (0, setup_1.authMiddleware)(["SUPER_ADMIN", "PRINCIPAL", "TEACHER", "PARENT"]), notificationController_1.getNotifications);
// Get notification statistics
router.get("/stats", (0, setup_1.authMiddleware)(["SUPER_ADMIN", "PRINCIPAL", "TEACHER", "PARENT"]), notificationController_1.getNotificationStats);
// Get notification preferences
router.get("/preferences", (0, setup_1.authMiddleware)(["SUPER_ADMIN", "PRINCIPAL", "TEACHER", "PARENT"]), notificationController_1.getNotificationPreferences);
// Create notification (principals and school admins only)
router.post("/", (0, setup_1.authMiddleware)(["SUPER_ADMIN", "PRINCIPAL", "SCHOOL_ADMIN"]), notificationController_1.createNotification);
// Mark notifications as read
router.patch("/read", (0, setup_1.authMiddleware)(["SUPER_ADMIN", "PRINCIPAL", "TEACHER", "PARENT"]), notificationController_1.markAsRead);
// Mark all notifications as read
router.patch("/read-all", (0, setup_1.authMiddleware)(["SUPER_ADMIN", "PRINCIPAL", "TEACHER", "PARENT"]), notificationController_1.markAllAsRead);
// Update notification preferences
router.put("/preferences", (0, setup_1.authMiddleware)(["SUPER_ADMIN", "PRINCIPAL", "TEACHER", "PARENT"]), notificationController_1.updateNotificationPreferences);
// Delete notification
router.delete("/:id", (0, setup_1.authMiddleware)(["SUPER_ADMIN", "PRINCIPAL", "TEACHER", "PARENT"]), notificationController_1.deleteNotification);
exports.default = router;
