import { Router } from "express"
import {
  getSuperAdminDashboard,
  getSchoolAdminDashboard,
  getPrincipalDashboard,
  getTeacherDashboard,
  getParentDashboard,
} from "../controllers/dashboardController"
import { authMiddleware } from "../utils/setup"

const router = Router()

// Role-specific dashboard endpoints
router.get("/super-admin", authMiddleware(["SUPER_ADMIN"]), getSuperAdminDashboard)
router.get("/school-admin", authMiddleware(["SCHOOL_ADMIN"]), getSchoolAdminDashboard)
router.get("/principal", authMiddleware(["PRINCIPAL"]), getPrincipalDashboard)
router.get("/teacher", authMiddleware(["TEACHER"]), getTeacherDashboard)
router.get("/parent", authMiddleware(["PARENT"]), getParentDashboard)

export default router
