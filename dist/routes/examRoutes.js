"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const examController_1 = require("../controllers/examController");
const setup_1 = require("../utils/setup");
const router = (0, express_1.Router)();
// Exam routes
router.get("/", (0, setup_1.authMiddleware)(["SUPER_ADMIN", "PRINCIPAL", "SCHOOL_ADMIN", "TEACHER"]), examController_1.getExams);
router.get("/:id", (0, setup_1.authMiddleware)(["SUPER_ADMIN", "PRINCIPAL", "SCHOOL_ADMIN", "TEACHER"]), examController_1.getExamById);
router.post("/", (0, setup_1.authMiddleware)(["SUPER_ADMIN", "PRINCIPAL", "SCHOOL_ADMIN"]), examController_1.createExam);
router.put("/:id", (0, setup_1.authMiddleware)(["SUPER_ADMIN", "PRINCIPAL", "SCHOOL_ADMIN"]), examController_1.updateExam);
router.delete("/:id", (0, setup_1.authMiddleware)(["SUPER_ADMIN", "PRINCIPAL", "SCHOOL_ADMIN"]), examController_1.deleteExam);
// Exam session routes
router.get("/:examId/sessions", (0, setup_1.authMiddleware)(["SUPER_ADMIN", "PRINCIPAL", "SCHOOL_ADMIN", "TEACHER"]), examController_1.getExamSessions);
router.post("/sessions", (0, setup_1.authMiddleware)(["SUPER_ADMIN", "PRINCIPAL", "SCHOOL_ADMIN"]), examController_1.createExamSession);
router.put("/sessions/:id", (0, setup_1.authMiddleware)(["SUPER_ADMIN", "PRINCIPAL", "SCHOOL_ADMIN"]), examController_1.updateExamSession);
router.delete("/sessions/:id", (0, setup_1.authMiddleware)(["SUPER_ADMIN", "PRINCIPAL", "SCHOOL_ADMIN"]), examController_1.deleteExamSession);
exports.default = router;
