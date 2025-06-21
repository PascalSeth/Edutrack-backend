"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const assignmentController_1 = require("../controllers/assignmentController");
const setup_1 = require("../utils/setup");
const multer_1 = __importDefault(require("multer"));
const router = (0, express_1.Router)();
const upload = (0, multer_1.default)({ storage: multer_1.default.memoryStorage() });
// Get all assignments
router.get("/", (0, setup_1.authMiddleware)(["SUPER_ADMIN", "PRINCIPAL", "TEACHER", "PARENT"]), assignmentController_1.getAssignments);
// Get assignment by ID
router.get("/:id", (0, setup_1.authMiddleware)(["SUPER_ADMIN", "PRINCIPAL", "TEACHER", "PARENT"]), assignmentController_1.getAssignmentById);
// Create assignment (teachers only)
router.post("/", (0, setup_1.authMiddleware)(["TEACHER"]), assignmentController_1.createAssignment);
// Update assignment (teachers only)
router.put("/:id", (0, setup_1.authMiddleware)(["TEACHER"]), assignmentController_1.updateAssignment);
// Delete assignment (teachers only)
router.delete("/:id", (0, setup_1.authMiddleware)(["TEACHER"]), assignmentController_1.deleteAssignment);
// Upload assignment files (teachers only)
router.post("/:id/files", (0, setup_1.authMiddleware)(["TEACHER"]), upload.array("files", 10), assignmentController_1.uploadAssignmentFiles);
// Submit assignment (parents only)
router.post("/:id/submit", (0, setup_1.authMiddleware)(["PARENT"]), upload.array("files", 5), assignmentController_1.submitAssignment);
// Get student assignments
router.get("/student/:studentId", (0, setup_1.authMiddleware)(["SUPER_ADMIN", "PRINCIPAL", "TEACHER", "PARENT"]), assignmentController_1.getStudentAssignments);
exports.default = router;
