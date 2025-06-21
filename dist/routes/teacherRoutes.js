"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
// src/routes/teacherRoutes.ts
const express_1 = require("express");
const teacherController_1 = require("../controllers/teacherController");
const setup_1 = require("../utils/setup");
const router = (0, express_1.Router)();
router.get('/', (0, setup_1.authMiddleware)(['SUPER_ADMIN', 'PRINCIPAL']), teacherController_1.getTeachers);
router.get('/:id', (0, setup_1.authMiddleware)(['SUPER_ADMIN', 'PRINCIPAL', 'TEACHER']), teacherController_1.getTeacherById);
router.post('/', (0, setup_1.authMiddleware)(['SUPER_ADMIN', 'PRINCIPAL']), teacherController_1.createTeacher);
router.put('/:id', (0, setup_1.authMiddleware)(['SUPER_ADMIN', 'PRINCIPAL']), teacherController_1.updateTeacher);
router.delete('/:id', (0, setup_1.authMiddleware)(['SUPER_ADMIN', 'PRINCIPAL']), teacherController_1.deleteTeacher);
exports.default = router;
