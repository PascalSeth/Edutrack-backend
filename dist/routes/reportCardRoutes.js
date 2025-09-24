"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const reportCardController_1 = require("../controllers/reportCardController");
const setup_1 = require("../utils/setup");
const router = (0, express_1.Router)();
// Report card routes
router.get("/", (0, setup_1.authMiddleware)(["SUPER_ADMIN", "PRINCIPAL", "SCHOOL_ADMIN", "TEACHER"]), reportCardController_1.getReportCards);
router.get("/:id", (0, setup_1.authMiddleware)(["SUPER_ADMIN", "PRINCIPAL", "SCHOOL_ADMIN", "TEACHER"]), reportCardController_1.getReportCardById);
router.post("/", (0, setup_1.authMiddleware)(["SUPER_ADMIN", "PRINCIPAL", "SCHOOL_ADMIN"]), reportCardController_1.createReportCard);
router.put("/:id", (0, setup_1.authMiddleware)(["SUPER_ADMIN", "PRINCIPAL", "SCHOOL_ADMIN"]), reportCardController_1.updateReportCard);
router.post("/:id/approve", (0, setup_1.authMiddleware)(["SUPER_ADMIN", "PRINCIPAL", "SCHOOL_ADMIN"]), reportCardController_1.approveReportCard);
router.post("/:id/publish", (0, setup_1.authMiddleware)(["SUPER_ADMIN", "PRINCIPAL", "SCHOOL_ADMIN"]), reportCardController_1.publishReportCard);
// Bulk generation
router.post("/generate", (0, setup_1.authMiddleware)(["SUPER_ADMIN", "PRINCIPAL", "SCHOOL_ADMIN"]), reportCardController_1.generateReportCards);
// Subject report routes
router.post("/subject-reports", (0, setup_1.authMiddleware)(["SUPER_ADMIN", "PRINCIPAL", "SCHOOL_ADMIN"]), reportCardController_1.createSubjectReport);
router.put("/subject-reports/:id", (0, setup_1.authMiddleware)(["SUPER_ADMIN", "PRINCIPAL", "SCHOOL_ADMIN"]), reportCardController_1.updateSubjectReport);
// Student-specific routes
router.get("/student/:studentId", (0, setup_1.authMiddleware)(["SUPER_ADMIN", "PRINCIPAL", "SCHOOL_ADMIN", "TEACHER", "PARENT"]), reportCardController_1.getStudentReportCards);
exports.default = router;
