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

// Apply authentication middleware to all routes
router.use(authMiddleware)

// Report card routes
router.get("/", getReportCards)
router.get("/:id", getReportCardById)
router.post("/", createReportCard)
router.put("/:id", updateReportCard)
router.post("/:id/approve", approveReportCard)
router.post("/:id/publish", publishReportCard)

// Bulk generation
router.post("/generate", generateReportCards)

// Subject report routes
router.post("/subject-reports", createSubjectReport)
router.put("/subject-reports/:id", updateSubjectReport)

// Student-specific routes
router.get("/student/:studentId", getStudentReportCards)

export default router
