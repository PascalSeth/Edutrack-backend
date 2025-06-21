import { Router } from "express"
import {
  getParentChildren,
  getParentSchools,
  getTeacherClasses,
  getTeacherSubjects,
  getTeacherStudents,
  getPrincipalSchoolOverview,
  addChildToParent,
  verifyParentChild,
  assignStudentToClass,
  getUnassignedStudents,
  searchAcrossSchools,
} from "../controllers/multiTenantController"
import { authMiddleware } from "../utils/setup"

const router = Router()

// Parent-specific multi-tenant endpoints
router.get("/parent/children", authMiddleware(["PARENT"]), getParentChildren)
router.get("/parent/schools", authMiddleware(["PARENT"]), getParentSchools)
router.post("/parent/add-child", authMiddleware(["PARENT"]), addChildToParent)
router.get("/parent/search", authMiddleware(["PARENT"]), searchAcrossSchools)

// Teacher-specific endpoints
router.get("/teacher/classes", authMiddleware(["TEACHER"]), getTeacherClasses)
router.get("/teacher/subjects", authMiddleware(["TEACHER"]), getTeacherSubjects)
router.get("/teacher/students", authMiddleware(["TEACHER"]), getTeacherStudents)

// Principal-specific endpoints
router.get("/principal/overview", authMiddleware(["PRINCIPAL"]), getPrincipalSchoolOverview)
router.get("/principal/unassigned-students", authMiddleware(["PRINCIPAL", "SCHOOL_ADMIN"]), getUnassignedStudents)

// Student management endpoints
router.post("/students/:studentId/assign-class", authMiddleware(["PRINCIPAL", "SCHOOL_ADMIN"]), assignStudentToClass)
router.post("/students/:studentId/verify-parent", authMiddleware(["PRINCIPAL", "SCHOOL_ADMIN"]), verifyParentChild)

export default router
