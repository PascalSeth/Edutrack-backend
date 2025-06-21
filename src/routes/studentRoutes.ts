import { Router } from "express"
import {
  getStudents,
  getStudentById,
  createStudent,
  updateStudent,
  deleteStudent,
  getStudentsBySchool,
} from "../controllers/studentController"
import { authMiddleware } from "../utils/setup"

const router = Router()

// Get all students (with tenant filtering)
router.get("/", authMiddleware(["SUPER_ADMIN", "PRINCIPAL", "SCHOOL_ADMIN", "TEACHER", "PARENT"]), getStudents)

// Get students by specific school
router.get("/by-school", authMiddleware(["SUPER_ADMIN", "PRINCIPAL", "SCHOOL_ADMIN"]), getStudentsBySchool)

// Get student by ID
router.get("/:id", authMiddleware(["SUPER_ADMIN", "PRINCIPAL", "SCHOOL_ADMIN", "TEACHER", "PARENT"]), getStudentById)

// Create student
router.post("/", authMiddleware(["SUPER_ADMIN", "PRINCIPAL", "SCHOOL_ADMIN"]), createStudent)

// Update student
router.put("/:id", authMiddleware(["SUPER_ADMIN", "PRINCIPAL", "SCHOOL_ADMIN", "TEACHER", "PARENT"]), updateStudent)

// Delete student
router.delete("/:id", authMiddleware(["SUPER_ADMIN", "PRINCIPAL", "SCHOOL_ADMIN"]), deleteStudent)

export default router
