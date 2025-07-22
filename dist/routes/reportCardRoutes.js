"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const reportCardController_1 = require("../controllers/reportCardController");
const setup_1 = require("../utils/setup");
const router = (0, express_1.Router)();
// Apply authentication middleware to all routes
router.use(setup_1.authMiddleware);
// Report card routes
router.get("/", reportCardController_1.getReportCards);
router.get("/:id", reportCardController_1.getReportCardById);
router.post("/", reportCardController_1.createReportCard);
router.put("/:id", reportCardController_1.updateReportCard);
router.post("/:id/approve", reportCardController_1.approveReportCard);
router.post("/:id/publish", reportCardController_1.publishReportCard);
// Bulk generation
router.post("/generate", reportCardController_1.generateReportCards);
// Subject report routes
router.post("/subject-reports", reportCardController_1.createSubjectReport);
router.put("/subject-reports/:id", reportCardController_1.updateSubjectReport);
// Student-specific routes
router.get("/student/:studentId", reportCardController_1.getStudentReportCards);
exports.default = router;
