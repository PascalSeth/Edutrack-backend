import { Router } from "express"
import {
  getParents,
  getParentById,
  createParent,
  updateParent,
  deleteParent,
  getParentChildrenAcrossSchools,
  getParentsBySchool,
  verifyParent,
} from "../controllers/parentController"
import { authMiddleware } from "../utils/setup"

const router = Router()

// Get all parents (with tenant filtering)
router.get("/", authMiddleware(["SUPER_ADMIN", "PRINCIPAL", "SCHOOL_ADMIN", "TEACHER"]), getParents)

// Get parents by specific school
router.get("/by-school", authMiddleware(["SUPER_ADMIN", "PRINCIPAL", "SCHOOL_ADMIN"]), getParentsBySchool)

// Get parent by ID
router.get("/:id", authMiddleware(["SUPER_ADMIN", "PRINCIPAL", "SCHOOL_ADMIN", "TEACHER", "PARENT"]), getParentById)

// Get parent's children across all schools
router.get(
  "/:id/children",
  authMiddleware(["SUPER_ADMIN", "PRINCIPAL", "SCHOOL_ADMIN", "PARENT"]),
  getParentChildrenAcrossSchools,
)

// Create parent
router.post("/", authMiddleware(["SUPER_ADMIN", "PRINCIPAL", "SCHOOL_ADMIN"]), createParent)

// Update parent
router.put("/:id", authMiddleware(["SUPER_ADMIN", "PRINCIPAL", "SCHOOL_ADMIN", "PARENT"]), updateParent)

// Verify parent
router.put("/:id/verify", authMiddleware(["SUPER_ADMIN", "PRINCIPAL", "SCHOOL_ADMIN"]), verifyParent)

// Delete parent
router.delete("/:id", authMiddleware(["SUPER_ADMIN"]), deleteParent)

export default router
