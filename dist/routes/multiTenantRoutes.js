"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const multiTenantController_1 = require("../controllers/multiTenantController");
const setup_1 = require("../utils/setup");
const router = (0, express_1.Router)();
// Parent-specific multi-tenant endpoints
router.get("/parent/children", (0, setup_1.authMiddleware)(["PARENT"]), multiTenantController_1.getParentChildren);
router.get("/parent/schools", (0, setup_1.authMiddleware)(["PARENT"]), multiTenantController_1.getParentSchools);
router.post("/parent/add-child", (0, setup_1.authMiddleware)(["PARENT"]), multiTenantController_1.addChildToParent);
router.get("/parent/search", (0, setup_1.authMiddleware)(["PARENT"]), multiTenantController_1.searchAcrossSchools);
// Teacher-specific endpoints
router.get("/teacher/classes", (0, setup_1.authMiddleware)(["TEACHER"]), multiTenantController_1.getTeacherClasses);
router.get("/teacher/subjects", (0, setup_1.authMiddleware)(["TEACHER"]), multiTenantController_1.getTeacherSubjects);
router.get("/teacher/students", (0, setup_1.authMiddleware)(["TEACHER"]), multiTenantController_1.getTeacherStudents);
// Principal-specific endpoints
router.get("/principal/overview", (0, setup_1.authMiddleware)(["PRINCIPAL"]), multiTenantController_1.getPrincipalSchoolOverview);
router.get("/principal/unassigned-students", (0, setup_1.authMiddleware)(["PRINCIPAL", "SCHOOL_ADMIN"]), multiTenantController_1.getUnassignedStudents);
// Student management endpoints
router.post("/students/:studentId/assign-class", (0, setup_1.authMiddleware)(["PRINCIPAL", "SCHOOL_ADMIN"]), multiTenantController_1.assignStudentToClass);
router.post("/students/:studentId/verify-parent", (0, setup_1.authMiddleware)(["PRINCIPAL", "SCHOOL_ADMIN"]), multiTenantController_1.verifyParentChild);
exports.default = router;
