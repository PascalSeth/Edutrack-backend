import { Router } from "express"
import {
  getNotifications,
  createNotification,
  markAsRead,
  markAllAsRead,
  deleteNotification,
  getNotificationStats,
  getNotificationPreferences,
  updateNotificationPreferences,
} from "../controllers/notificationController"
import { authMiddleware } from "../utils/setup"

const router = Router()

// Get user notifications
router.get("/", authMiddleware(["SUPER_ADMIN", "PRINCIPAL", "TEACHER", "PARENT"]), getNotifications)

// Get notification statistics
router.get("/stats", authMiddleware(["SUPER_ADMIN", "PRINCIPAL", "TEACHER", "PARENT"]), getNotificationStats)

// Get notification preferences
router.get(
  "/preferences",
  authMiddleware(["SUPER_ADMIN", "PRINCIPAL", "TEACHER", "PARENT"]),
  getNotificationPreferences,
)

// Create notification (principals and school admins only)
router.post("/", authMiddleware(["SUPER_ADMIN", "PRINCIPAL", "SCHOOL_ADMIN"]), createNotification)

// Mark notifications as read
router.patch("/read", authMiddleware(["SUPER_ADMIN", "PRINCIPAL", "TEACHER", "PARENT"]), markAsRead)

// Mark all notifications as read
router.patch("/read-all", authMiddleware(["SUPER_ADMIN", "PRINCIPAL", "TEACHER", "PARENT"]), markAllAsRead)

// Update notification preferences
router.put(
  "/preferences",
  authMiddleware(["SUPER_ADMIN", "PRINCIPAL", "TEACHER", "PARENT"]),
  updateNotificationPreferences,
)

// Delete notification
router.delete("/:id", authMiddleware(["SUPER_ADMIN", "PRINCIPAL", "TEACHER", "PARENT"]), deleteNotification)

export default router
