"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const subjectController_1 = require("../controllers/subjectController");
const setup_1 = require("../utils/setup");
const router = (0, express_1.Router)();
// Get all subjects
router.get("/", (0, setup_1.authMiddleware)(["SUPER_ADMIN", "PRINCIPAL", "TEACHER", "PARENT"]), subjectController_1.getSubjects);
// Get subject by ID
router.get("/:id", (0, setup_1.authMiddleware)(["SUPER_ADMIN", "PRINCIPAL", "TEACHER", "PARENT"]), subjectController_1.getSubjectById);
// Create subject (principals and school admins only)
router.post("/", (0, setup_1.authMiddleware)(["SUPER_ADMIN", "PRINCIPAL", "SCHOOL_ADMIN"]), subjectController_1.createSubject);
// Update subject (principals and school admins only)
router.put("/:id", (0, setup_1.authMiddleware)(["SUPER_ADMIN", "PRINCIPAL", "SCHOOL_ADMIN"]), subjectController_1.updateSubject);
// Delete subject (principals and school admins only)
router.delete("/:id", (0, setup_1.authMiddleware)(["SUPER_ADMIN", "PRINCIPAL", "SCHOOL_ADMIN"]), subjectController_1.deleteSubject);
// Assign teacher to subject
router.post("/:id/teachers", (0, setup_1.authMiddleware)(["SUPER_ADMIN", "PRINCIPAL", "SCHOOL_ADMIN"]), subjectController_1.assignTeacherToSubject);
// Remove teacher from subject
router.delete("/:id/teachers", (0, setup_1.authMiddleware)(["SUPER_ADMIN", "PRINCIPAL", "SCHOOL_ADMIN"]), subjectController_1.removeTeacherFromSubject);
exports.default = router;
