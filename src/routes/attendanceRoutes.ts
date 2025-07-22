import { Router } from "express"
import {
  recordAttendance,
  recordBulkAttendance,
  getStudentAttendance,
  getClassAttendance,
  getAttendanceAnalytics,
} from "../controllers/attendanceController"
import { authMiddleware } from "../utils/setup"

const router = Router()

// Record single attendance (teachers only)
router.post("/", authMiddleware(["TEACHER","SUPER_ADMIN"]), recordAttendance)

// Record bulk attendance (teachers only)
router.post("/bulk", authMiddleware(["TEACHER","SUPER_ADMIN"]), recordBulkAttendance)

// Get student attendance
router.get(
  "/student/:studentId",
  authMiddleware(["SUPER_ADMIN", "PRINCIPAL", "TEACHER", "PARENT"]),
  getStudentAttendance,
)

// Get class attendance
router.get("/class/:classId", authMiddleware(["SUPER_ADMIN", "PRINCIPAL", "TEACHER"]), getClassAttendance)

// Get attendance analytics
router.get("/analytics", authMiddleware(["SUPER_ADMIN", "PRINCIPAL", "TEACHER", "PARENT"]), getAttendanceAnalytics)

export default router
