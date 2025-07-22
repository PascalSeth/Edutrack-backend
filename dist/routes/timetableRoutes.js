"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const timetableController_1 = require("../controllers/timetableController");
const setup_1 = require("../utils/setup");
const router = (0, express_1.Router)();
// Apply authentication middleware to all routes
router.use(setup_1.authMiddleware);
// Timetable routes
router.get("/", timetableController_1.getTimetables);
router.get("/:id", timetableController_1.getTimetableById);
router.post("/", timetableController_1.createTimetable);
router.put("/:id", timetableController_1.updateTimetable);
router.delete("/:id", timetableController_1.deleteTimetable);
// Timetable slot routes
router.post("/slots", timetableController_1.createTimetableSlot);
router.put("/slots/:id", timetableController_1.updateTimetableSlot);
router.delete("/slots/:id", timetableController_1.deleteTimetableSlot);
// Specialized timetable views
router.get("/teacher/:teacherId", timetableController_1.getTeacherTimetable);
router.get("/class/:classId", timetableController_1.getClassTimetable);
exports.default = router;
