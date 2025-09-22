import { Router } from "express"
import {
  getReportCards,
  getReportCardById,
  createReportCard,
  updateReportCard,
  approveReportCard,
  publishReportCard,
  createSubjectReport,
  updateSubjectReport,
  generateReportCards,
  getStudentReportCards,
} from "../controllers/reportCardController"
import { authMiddleware } from "../utils/setup"

const router = Router()

// Report card routes
router.get("/", authMiddleware(["SUPER_ADMIN", "PRINCIPAL", "SCHOOL_ADMIN", "TEACHER"]), getReportCards)
router.get("/:id", authMiddleware(["SUPER_ADMIN", "PRINCIPAL", "SCHOOL_ADMIN", "TEACHER"]), getReportCardById)
router.post("/", authMiddleware(["SUPER_ADMIN", "PRINCIPAL", "SCHOOL_ADMIN"]), createReportCard)
router.put("/:id", authMiddleware(["SUPER_ADMIN", "PRINCIPAL", "SCHOOL_ADMIN"]), updateReportCard)
router.post("/:id/approve", authMiddleware(["SUPER_ADMIN", "PRINCIPAL", "SCHOOL_ADMIN"]), approveReportCard)
router.post("/:id/publish", authMiddleware(["SUPER_ADMIN", "PRINCIPAL", "SCHOOL_ADMIN"]), publishReportCard)

// Bulk generation
router.post("/generate", authMiddleware(["SUPER_ADMIN", "PRINCIPAL", "SCHOOL_ADMIN"]), generateReportCards)

// Subject report routes
router.post("/subject-reports", authMiddleware(["SUPER_ADMIN", "PRINCIPAL", "SCHOOL_ADMIN"]), createSubjectReport)
router.put("/subject-reports/:id", authMiddleware(["SUPER_ADMIN", "PRINCIPAL", "SCHOOL_ADMIN"]), updateSubjectReport)

// Student-specific routes
router.get("/student/:studentId", authMiddleware(["SUPER_ADMIN", "PRINCIPAL", "SCHOOL_ADMIN", "TEACHER", "PARENT"]), getStudentReportCards)

export default router
