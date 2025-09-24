"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const curriculumController_1 = require("../controllers/curriculumController");
const setup_1 = require("../utils/setup");
const router = (0, express_1.Router)();
// Curriculum routes
router.get("/", (0, setup_1.authMiddleware)(["SUPER_ADMIN", "PRINCIPAL", "SCHOOL_ADMIN", "TEACHER"]), curriculumController_1.getCurriculums);
router.get("/:id", (0, setup_1.authMiddleware)(["SUPER_ADMIN", "PRINCIPAL", "SCHOOL_ADMIN", "TEACHER"]), curriculumController_1.getCurriculumById);
router.post("/", (0, setup_1.authMiddleware)(["SUPER_ADMIN", "PRINCIPAL", "SCHOOL_ADMIN"]), curriculumController_1.createCurriculum);
router.put("/:id", (0, setup_1.authMiddleware)(["SUPER_ADMIN", "PRINCIPAL", "SCHOOL_ADMIN"]), curriculumController_1.updateCurriculum);
router.delete("/:id", (0, setup_1.authMiddleware)(["SUPER_ADMIN", "PRINCIPAL", "SCHOOL_ADMIN"]), curriculumController_1.deleteCurriculum);
// Curriculum subject routes
router.post("/subjects", (0, setup_1.authMiddleware)(["SUPER_ADMIN", "PRINCIPAL", "SCHOOL_ADMIN"]), curriculumController_1.createCurriculumSubject);
// Learning objective routes
router.get("/subjects/:curriculumSubjectId/objectives", (0, setup_1.authMiddleware)(["SUPER_ADMIN", "PRINCIPAL", "SCHOOL_ADMIN", "TEACHER"]), curriculumController_1.getLearningObjectives);
router.post("/objectives", (0, setup_1.authMiddleware)(["SUPER_ADMIN", "PRINCIPAL", "SCHOOL_ADMIN"]), curriculumController_1.createLearningObjective);
// Student progress routes
router.put("/progress", (0, setup_1.authMiddleware)(["SUPER_ADMIN", "PRINCIPAL", "SCHOOL_ADMIN", "TEACHER"]), curriculumController_1.updateStudentProgress);
router.get("/progress/student/:studentId", (0, setup_1.authMiddleware)(["SUPER_ADMIN", "PRINCIPAL", "SCHOOL_ADMIN", "TEACHER", "PARENT"]), curriculumController_1.getStudentProgress);
router.get("/:curriculumId/progress", (0, setup_1.authMiddleware)(["SUPER_ADMIN", "PRINCIPAL", "SCHOOL_ADMIN", "TEACHER"]), curriculumController_1.getCurriculumProgress);
exports.default = router;
