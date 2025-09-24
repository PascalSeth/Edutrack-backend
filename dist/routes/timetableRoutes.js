"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const timetableController_1 = require("../controllers/timetableController");
const setup_1 = require("../utils/setup");
const router = (0, express_1.Router)();
// Timetable routes
router.get("/", (0, setup_1.authMiddleware)(["SUPER_ADMIN", "PRINCIPAL", "SCHOOL_ADMIN", "TEACHER"]), timetableController_1.getTimetables);
router.get("/:id", (0, setup_1.authMiddleware)(["SUPER_ADMIN", "PRINCIPAL", "SCHOOL_ADMIN", "TEACHER"]), timetableController_1.getTimetableById);
router.post("/", (0, setup_1.authMiddleware)(["SUPER_ADMIN", "PRINCIPAL", "SCHOOL_ADMIN"]), timetableController_1.createTimetable);
router.put("/:id", (0, setup_1.authMiddleware)(["SUPER_ADMIN", "PRINCIPAL", "SCHOOL_ADMIN"]), timetableController_1.updateTimetable);
router.delete("/:id", (0, setup_1.authMiddleware)(["SUPER_ADMIN", "PRINCIPAL", "SCHOOL_ADMIN"]), timetableController_1.deleteTimetable);
// Timetable slot routes
router.post("/slots", (0, setup_1.authMiddleware)(["SUPER_ADMIN", "PRINCIPAL", "SCHOOL_ADMIN"]), timetableController_1.createTimetableSlot);
router.put("/slots/:id", (0, setup_1.authMiddleware)(["SUPER_ADMIN", "PRINCIPAL", "SCHOOL_ADMIN"]), timetableController_1.updateTimetableSlot);
router.delete("/slots/:id", (0, setup_1.authMiddleware)(["SUPER_ADMIN", "PRINCIPAL", "SCHOOL_ADMIN"]), timetableController_1.deleteTimetableSlot);
// Specialized timetable views
router.get("/teacher/:teacherId", (0, setup_1.authMiddleware)(["SUPER_ADMIN", "PRINCIPAL", "SCHOOL_ADMIN", "TEACHER"]), timetableController_1.getTeacherTimetable);
router.get("/class/:classId", (0, setup_1.authMiddleware)(["SUPER_ADMIN", "PRINCIPAL", "SCHOOL_ADMIN", "TEACHER"]), timetableController_1.getClassTimetable);
exports.default = router;
