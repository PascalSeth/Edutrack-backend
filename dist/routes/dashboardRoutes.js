"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const dashboardController_1 = require("../controllers/dashboardController");
const setup_1 = require("../utils/setup");
const router = (0, express_1.Router)();
// Role-specific dashboard endpoints
router.get("/super-admin", (0, setup_1.authMiddleware)(["SUPER_ADMIN"]), dashboardController_1.getSuperAdminDashboard);
router.get("/school-admin", (0, setup_1.authMiddleware)(["SCHOOL_ADMIN"]), dashboardController_1.getSchoolAdminDashboard);
router.get("/principal", (0, setup_1.authMiddleware)(["PRINCIPAL"]), dashboardController_1.getPrincipalDashboard);
router.get("/teacher", (0, setup_1.authMiddleware)(["TEACHER"]), dashboardController_1.getTeacherDashboard);
router.get("/parent", (0, setup_1.authMiddleware)(["PARENT"]), dashboardController_1.getParentDashboard);
exports.default = router;
