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

// Exam routes
router.get("/", authMiddleware(["SUPER_ADMIN", "PRINCIPAL", "SCHOOL_ADMIN", "TEACHER"]), getExams)
router.get("/:id", authMiddleware(["SUPER_ADMIN", "PRINCIPAL", "SCHOOL_ADMIN", "TEACHER"]), getExamById)
router.post("/", authMiddleware(["SUPER_ADMIN", "PRINCIPAL", "SCHOOL_ADMIN"]), createExam)
router.put("/:id", authMiddleware(["SUPER_ADMIN", "PRINCIPAL", "SCHOOL_ADMIN"]), updateExam)
router.delete("/:id", authMiddleware(["SUPER_ADMIN", "PRINCIPAL", "SCHOOL_ADMIN"]), deleteExam)

// Exam session routes
router.get("/:examId/sessions", authMiddleware(["SUPER_ADMIN", "PRINCIPAL", "SCHOOL_ADMIN", "TEACHER"]), getExamSessions)
router.post("/sessions", authMiddleware(["SUPER_ADMIN", "PRINCIPAL", "SCHOOL_ADMIN"]), createExamSession)
router.put("/sessions/:id", authMiddleware(["SUPER_ADMIN", "PRINCIPAL", "SCHOOL_ADMIN"]), updateExamSession)
router.delete("/sessions/:id", authMiddleware(["SUPER_ADMIN", "PRINCIPAL", "SCHOOL_ADMIN"]), deleteExamSession)

export default router
