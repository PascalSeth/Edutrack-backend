import { Router } from "express"
import {
  getSubjects,
  getSubjectById,
  createSubject,
  updateSubject,
  deleteSubject,
  assignTeacherToSubject,
  removeTeacherFromSubject,
} from "../controllers/subjectController"
import { authMiddleware } from "../utils/setup"

const router = Router()

// Get all subjects
router.get("/", authMiddleware(["SUPER_ADMIN", "PRINCIPAL", "TEACHER", "PARENT"]), getSubjects)

// Get subject by ID
router.get("/:id", authMiddleware(["SUPER_ADMIN", "PRINCIPAL", "TEACHER", "PARENT"]), getSubjectById)

// Create subject (principals and school admins only)
router.post("/", authMiddleware(["SUPER_ADMIN", "PRINCIPAL", "SCHOOL_ADMIN"]), createSubject)

// Update subject (principals and school admins only)
router.put("/:id", authMiddleware(["SUPER_ADMIN", "PRINCIPAL", "SCHOOL_ADMIN"]), updateSubject)

// Delete subject (principals and school admins only)
router.delete("/:id", authMiddleware(["SUPER_ADMIN", "PRINCIPAL", "SCHOOL_ADMIN"]), deleteSubject)

// Assign teacher to subject
router.post("/:id/teachers", authMiddleware(["SUPER_ADMIN", "PRINCIPAL", "SCHOOL_ADMIN"]), assignTeacherToSubject)

// Remove teacher from subject
router.delete("/:id/teachers", authMiddleware(["SUPER_ADMIN", "PRINCIPAL", "SCHOOL_ADMIN"]), removeTeacherFromSubject)

export default router
