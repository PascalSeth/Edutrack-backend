"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const curriculumController_1 = require("../controllers/curriculumController");
const setup_1 = require("../utils/setup");
const router = (0, express_1.Router)();
// Apply authentication middleware to all routes
router.use(setup_1.authMiddleware);
// Curriculum routes
router.get("/", curriculumController_1.getCurriculums);
router.get("/:id", curriculumController_1.getCurriculumById);
router.post("/", curriculumController_1.createCurriculum);
router.put("/:id", curriculumController_1.updateCurriculum);
router.delete("/:id", curriculumController_1.deleteCurriculum);
// Curriculum subject routes
router.post("/subjects", curriculumController_1.createCurriculumSubject);
// Learning objective routes
router.get("/subjects/:curriculumSubjectId/objectives", curriculumController_1.getLearningObjectives);
router.post("/objectives", curriculumController_1.createLearningObjective);
// Student progress routes
router.put("/progress", curriculumController_1.updateStudentProgress);
router.get("/progress/student/:studentId", curriculumController_1.getStudentProgress);
router.get("/:curriculumId/progress", curriculumController_1.getCurriculumProgress);
exports.default = router;
