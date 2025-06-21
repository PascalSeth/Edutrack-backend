"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const attendanceController_1 = require("../controllers/attendanceController");
const setup_1 = require("../utils/setup");
const router = (0, express_1.Router)();
// Record single attendance (teachers only)
router.post("/", (0, setup_1.authMiddleware)(["TEACHER"]), attendanceController_1.recordAttendance);
// Record bulk attendance (teachers only)
router.post("/bulk", (0, setup_1.authMiddleware)(["TEACHER"]), attendanceController_1.recordBulkAttendance);
// Get student attendance
router.get("/student/:studentId", (0, setup_1.authMiddleware)(["SUPER_ADMIN", "PRINCIPAL", "TEACHER", "PARENT"]), attendanceController_1.getStudentAttendance);
// Get class attendance
router.get("/class/:classId", (0, setup_1.authMiddleware)(["SUPER_ADMIN", "PRINCIPAL", "TEACHER"]), attendanceController_1.getClassAttendance);
// Get attendance analytics
router.get("/analytics", (0, setup_1.authMiddleware)(["SUPER_ADMIN", "PRINCIPAL", "TEACHER", "PARENT"]), attendanceController_1.getAttendanceAnalytics);
exports.default = router;
