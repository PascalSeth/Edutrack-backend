"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const examController_1 = require("../controllers/examController");
const setup_1 = require("../utils/setup");
const router = (0, express_1.Router)();
// Apply authentication middleware to all routes
router.use(setup_1.authMiddleware);
// Exam routes
router.get("/", examController_1.getExams);
router.get("/:id", examController_1.getExamById);
router.post("/", examController_1.createExam);
router.put("/:id", examController_1.updateExam);
router.delete("/:id", examController_1.deleteExam);
// Exam session routes
router.get("/:examId/sessions", examController_1.getExamSessions);
router.post("/sessions", examController_1.createExamSession);
router.put("/sessions/:id", examController_1.updateExamSession);
router.delete("/sessions/:id", examController_1.deleteExamSession);
exports.default = router;
