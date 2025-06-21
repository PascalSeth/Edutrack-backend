"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const studentController_1 = require("../controllers/studentController");
const setup_1 = require("../utils/setup");
const router = (0, express_1.Router)();
// Get all students (with tenant filtering)
router.get("/", (0, setup_1.authMiddleware)(["SUPER_ADMIN", "PRINCIPAL", "SCHOOL_ADMIN", "TEACHER", "PARENT"]), studentController_1.getStudents);
// Get students by specific school
router.get("/by-school", (0, setup_1.authMiddleware)(["SUPER_ADMIN", "PRINCIPAL", "SCHOOL_ADMIN"]), studentController_1.getStudentsBySchool);
// Get student by ID
router.get("/:id", (0, setup_1.authMiddleware)(["SUPER_ADMIN", "PRINCIPAL", "SCHOOL_ADMIN", "TEACHER", "PARENT"]), studentController_1.getStudentById);
// Create student
router.post("/", (0, setup_1.authMiddleware)(["SUPER_ADMIN", "PRINCIPAL", "SCHOOL_ADMIN"]), studentController_1.createStudent);
// Update student
router.put("/:id", (0, setup_1.authMiddleware)(["SUPER_ADMIN", "PRINCIPAL", "SCHOOL_ADMIN", "TEACHER", "PARENT"]), studentController_1.updateStudent);
// Delete student
router.delete("/:id", (0, setup_1.authMiddleware)(["SUPER_ADMIN", "PRINCIPAL", "SCHOOL_ADMIN"]), studentController_1.deleteStudent);
exports.default = router;
