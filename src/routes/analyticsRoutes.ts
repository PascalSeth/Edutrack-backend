import { Router } from "express"
import {
  getSchoolAnalytics,
  getStudentAnalytics,
  getClassAnalytics,
  getParentEngagementAnalytics,
} from "../controllers/analyticsController"
import { authMiddleware } from "../utils/setup"

const router = Router()

// Get school analytics (principals and school admins only)
router.get("/school", authMiddleware(["SUPER_ADMIN", "PRINCIPAL", "SCHOOL_ADMIN"]), getSchoolAnalytics)

// Get student analytics
router.get(
  "/student/:studentId",
  authMiddleware(["SUPER_ADMIN", "PRINCIPAL", "TEACHER", "PARENT"]),
  getStudentAnalytics,
)

// Get class analytics
router.get("/class/:classId", authMiddleware(["SUPER_ADMIN", "PRINCIPAL", "TEACHER"]), getClassAnalytics)

// Get parent engagement analytics (principals and school admins only)
router.get("/engagement", authMiddleware(["SUPER_ADMIN", "PRINCIPAL", "SCHOOL_ADMIN"]), getParentEngagementAnalytics)

export default router
