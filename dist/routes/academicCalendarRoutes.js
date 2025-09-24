"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const academicCalendarController_1 = require("../controllers/academicCalendarController");
const setup_1 = require("../utils/setup");
const router = (0, express_1.Router)();
// Term routes
router.get("/terms", (0, setup_1.authMiddleware)(["SUPER_ADMIN", "PRINCIPAL", "SCHOOL_ADMIN", "TEACHER"]), academicCalendarController_1.getTerms);
router.get("/terms/:id", (0, setup_1.authMiddleware)(["SUPER_ADMIN", "PRINCIPAL", "SCHOOL_ADMIN", "TEACHER"]), academicCalendarController_1.getTermById);
router.post("/terms", (0, setup_1.authMiddleware)(["SUPER_ADMIN", "PRINCIPAL", "SCHOOL_ADMIN"]), academicCalendarController_1.createTerm);
router.put("/terms/:id", (0, setup_1.authMiddleware)(["SUPER_ADMIN", "PRINCIPAL", "SCHOOL_ADMIN"]), academicCalendarController_1.updateTerm);
router.delete("/terms/:id", (0, setup_1.authMiddleware)(["SUPER_ADMIN", "PRINCIPAL", "SCHOOL_ADMIN"]), academicCalendarController_1.deleteTerm);
// Holiday routes
router.get("/holidays", (0, setup_1.authMiddleware)(["SUPER_ADMIN", "PRINCIPAL", "SCHOOL_ADMIN", "TEACHER"]), academicCalendarController_1.getHolidays);
router.post("/holidays", (0, setup_1.authMiddleware)(["SUPER_ADMIN", "PRINCIPAL", "SCHOOL_ADMIN"]), academicCalendarController_1.createHoliday);
router.put("/holidays/:id", (0, setup_1.authMiddleware)(["SUPER_ADMIN", "PRINCIPAL", "SCHOOL_ADMIN"]), academicCalendarController_1.updateHoliday);
router.delete("/holidays/:id", (0, setup_1.authMiddleware)(["SUPER_ADMIN", "PRINCIPAL", "SCHOOL_ADMIN"]), academicCalendarController_1.deleteHoliday);
// Calendar item routes
router.post("/calendar-items", (0, setup_1.authMiddleware)(["SUPER_ADMIN", "PRINCIPAL", "SCHOOL_ADMIN"]), academicCalendarController_1.createCalendarItem);
router.get("/calendar/:academicCalendarId/items", (0, setup_1.authMiddleware)(["SUPER_ADMIN", "PRINCIPAL", "SCHOOL_ADMIN", "TEACHER"]), academicCalendarController_1.getCalendarItems);
// Academic calendar overview
router.get("/calendar", (0, setup_1.authMiddleware)(["SUPER_ADMIN", "PRINCIPAL", "SCHOOL_ADMIN", "TEACHER"]), academicCalendarController_1.getAcademicCalendar);
exports.default = router;
