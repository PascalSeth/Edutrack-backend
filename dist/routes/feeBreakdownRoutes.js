"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const feeBreakdownController_1 = require("../controllers/feeBreakdownController");
const setup_1 = require("../utils/setup");
const router = express_1.default.Router();
// School admin and principal routes for managing fee structures
router.get("/schools/:schoolId/fee-structures", (0, setup_1.authMiddleware)(["SCHOOL_ADMIN", "PRINCIPAL"]), feeBreakdownController_1.getFeeStructures);
router.get("/fee-structures/:feeStructureId", (0, setup_1.authMiddleware)(["SCHOOL_ADMIN", "PRINCIPAL"]), feeBreakdownController_1.getFeeStructure);
router.post("/schools/:schoolId/fee-structures", (0, setup_1.authMiddleware)(["SCHOOL_ADMIN", "PRINCIPAL"]), feeBreakdownController_1.createFeeStructure);
router.put("/fee-structures/:feeStructureId", (0, setup_1.authMiddleware)(["SCHOOL_ADMIN", "PRINCIPAL"]), feeBreakdownController_1.updateFeeStructure);
// Fee breakdown item management
router.post("/fee-structures/:feeStructureId/items", (0, setup_1.authMiddleware)(["SCHOOL_ADMIN", "PRINCIPAL"]), feeBreakdownController_1.addFeeBreakdownItem);
router.put("/fee-breakdown-items/:itemId", (0, setup_1.authMiddleware)(["SCHOOL_ADMIN", "PRINCIPAL"]), feeBreakdownController_1.updateFeeBreakdownItem);
router.delete("/fee-breakdown-items/:itemId", (0, setup_1.authMiddleware)(["SCHOOL_ADMIN", "PRINCIPAL"]), feeBreakdownController_1.deleteFeeBreakdownItem);
// Student-specific overrides
router.put("/fee-breakdown-items/:itemId/students/:studentId/override", (0, setup_1.authMiddleware)(["SCHOOL_ADMIN", "PRINCIPAL"]), feeBreakdownController_1.setStudentOverride);
// Parent routes for viewing fee breakdowns
router.get("/students/:studentId/fee-breakdown", (0, setup_1.authMiddleware)(["PARENT"]), feeBreakdownController_1.getStudentFeeBreakdown);
exports.default = router;
