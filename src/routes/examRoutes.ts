import { Router } from "express"
import {
  getExams,
  getExamById,
  createExam,
  updateExam,
  deleteExam,
  createExamSession,
  updateExamSession,
  deleteExamSession,
  getExamSessions,
} from "../controllers/examController"
import { authMiddleware } from "../utils/setup"

const router = Router()

// Apply authentication middleware to all routes
router.use(authMiddleware)

// Exam routes
router.get("/", getExams)
router.get("/:id", getExamById)
router.post("/", createExam)
router.put("/:id", updateExam)
router.delete("/:id", deleteExam)

// Exam session routes
router.get("/:examId/sessions", getExamSessions)
router.post("/sessions", createExamSession)
router.put("/sessions/:id", updateExamSession)
router.delete("/sessions/:id", deleteExamSession)

export default router
