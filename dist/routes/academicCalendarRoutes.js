"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const academicCalendarController_1 = require("../controllers/academicCalendarController");
const setup_1 = require("../utils/setup");
const router = (0, express_1.Router)();
// Apply authentication middleware to all routes
router.use(setup_1.authMiddleware);
// Term routes
router.get("/terms", academicCalendarController_1.getTerms);
router.get("/terms/:id", academicCalendarController_1.getTermById);
router.post("/terms", academicCalendarController_1.createTerm);
router.put("/terms/:id", academicCalendarController_1.updateTerm);
router.delete("/terms/:id", academicCalendarController_1.deleteTerm);
// Holiday routes
router.get("/holidays", academicCalendarController_1.getHolidays);
router.post("/holidays", academicCalendarController_1.createHoliday);
router.put("/holidays/:id", academicCalendarController_1.updateHoliday);
router.delete("/holidays/:id", academicCalendarController_1.deleteHoliday);
// Calendar item routes
router.post("/calendar-items", academicCalendarController_1.createCalendarItem);
router.get("/calendar/:academicCalendarId/items", academicCalendarController_1.getCalendarItems);
// Academic calendar overview
router.get("/calendar", academicCalendarController_1.getAcademicCalendar);
exports.default = router;
