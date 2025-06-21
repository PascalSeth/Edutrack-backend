"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const analyticsController_1 = require("../controllers/analyticsController");
const setup_1 = require("../utils/setup");
const router = (0, express_1.Router)();
// Get school analytics (principals and school admins only)
router.get("/school", (0, setup_1.authMiddleware)(["SUPER_ADMIN", "PRINCIPAL", "SCHOOL_ADMIN"]), analyticsController_1.getSchoolAnalytics);
// Get student analytics
router.get("/student/:studentId", (0, setup_1.authMiddleware)(["SUPER_ADMIN", "PRINCIPAL", "TEACHER", "PARENT"]), analyticsController_1.getStudentAnalytics);
// Get class analytics
router.get("/class/:classId", (0, setup_1.authMiddleware)(["SUPER_ADMIN", "PRINCIPAL", "TEACHER"]), analyticsController_1.getClassAnalytics);
// Get parent engagement analytics (principals and school admins only)
router.get("/engagement", (0, setup_1.authMiddleware)(["SUPER_ADMIN", "PRINCIPAL", "SCHOOL_ADMIN"]), analyticsController_1.getParentEngagementAnalytics);
exports.default = router;
