import express from "express"
import {
  getFeeStructures,
  getFeeStructure,
  createFeeStructure,
  updateFeeStructure,
  addFeeBreakdownItem,
  updateFeeBreakdownItem,
  deleteFeeBreakdownItem,
  setStudentOverride,
  getStudentFeeBreakdown
} from "../controllers/feeBreakdownController"
import { authMiddleware } from "../utils/setup"

const router = express.Router()

// School admin and principal routes for managing fee structures
router.get("/schools/:schoolId/fee-structures", authMiddleware(["SCHOOL_ADMIN", "PRINCIPAL"]), getFeeStructures)
router.get("/fee-structures/:feeStructureId", authMiddleware(["SCHOOL_ADMIN", "PRINCIPAL"]), getFeeStructure)
router.post("/schools/:schoolId/fee-structures", authMiddleware(["SCHOOL_ADMIN", "PRINCIPAL"]), createFeeStructure)
router.put("/fee-structures/:feeStructureId", authMiddleware(["SCHOOL_ADMIN", "PRINCIPAL"]), updateFeeStructure)

// Fee breakdown item management
router.post("/fee-structures/:feeStructureId/items", authMiddleware(["SCHOOL_ADMIN", "PRINCIPAL"]), addFeeBreakdownItem)
router.put("/fee-breakdown-items/:itemId", authMiddleware(["SCHOOL_ADMIN", "PRINCIPAL"]), updateFeeBreakdownItem)
router.delete("/fee-breakdown-items/:itemId", authMiddleware(["SCHOOL_ADMIN", "PRINCIPAL"]), deleteFeeBreakdownItem)

// Student-specific overrides
router.put("/fee-breakdown-items/:itemId/students/:studentId/override", authMiddleware(["SCHOOL_ADMIN", "PRINCIPAL"]), setStudentOverride)

// Parent routes for viewing fee breakdowns
router.get("/students/:studentId/fee-breakdown", authMiddleware(["PARENT"]), getStudentFeeBreakdown)

export default router