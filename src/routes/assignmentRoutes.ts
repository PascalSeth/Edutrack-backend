import { Router } from "express"
import {
  getAssignments,
  getAssignmentById,
  createAssignment,
  updateAssignment,
  deleteAssignment,
  uploadAssignmentFiles,
  submitAssignment,
  getStudentAssignments,
} from "../controllers/assignmentController"
import { authMiddleware } from "../utils/setup"
import multer from "multer"

const router = Router()
const upload = multer({ storage: multer.memoryStorage() })

// Get all assignments
router.get("/", authMiddleware(["SUPER_ADMIN", "PRINCIPAL", "TEACHER", "PARENT"]), getAssignments)

// Get assignment by ID
router.get("/:id", authMiddleware(["SUPER_ADMIN", "PRINCIPAL", "TEACHER", "PARENT"]), getAssignmentById)

// Create assignment (teachers only)
router.post("/", authMiddleware(["TEACHER"]), createAssignment)

// Update assignment (teachers only)
router.put("/:id", authMiddleware(["TEACHER"]), updateAssignment)

// Delete assignment (teachers only)
router.delete("/:id", authMiddleware(["TEACHER"]), deleteAssignment)

// Upload assignment files (teachers only)
router.post("/:id/files", authMiddleware(["TEACHER"]), upload.array("files", 10), uploadAssignmentFiles)

// Submit assignment (parents only)
router.post("/:id/submit", authMiddleware(["PARENT"]), upload.array("files", 5), submitAssignment)

// Get student assignments
router.get(
  "/student/:studentId",
  authMiddleware(["SUPER_ADMIN", "PRINCIPAL", "TEACHER", "PARENT"]),
  getStudentAssignments,
)

export default router
