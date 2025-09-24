"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
// src/routes/gradeRoutes.ts
const express_1 = require("express");
const gradeController_1 = require("../controllers/gradeController");
const setup_1 = require("../utils/setup");
const router = (0, express_1.Router)();
router.get('/', (0, setup_1.authMiddleware)(['SUPER_ADMIN', 'PRINCIPAL', 'SCHOOL_ADMIN', 'TEACHER']), gradeController_1.getGrades);
router.get('/:id', (0, setup_1.authMiddleware)(['SUPER_ADMIN', 'PRINCIPAL', 'SCHOOL_ADMIN', 'TEACHER']), gradeController_1.getGradeById);
router.post('/', (0, setup_1.authMiddleware)(['SUPER_ADMIN', 'PRINCIPAL', 'SCHOOL_ADMIN']), gradeController_1.createGrade);
router.put('/:id', (0, setup_1.authMiddleware)(['SUPER_ADMIN', 'PRINCIPAL', 'SCHOOL_ADMIN']), gradeController_1.updateGrade);
router.delete('/:id', (0, setup_1.authMiddleware)(['SUPER_ADMIN', 'PRINCIPAL', 'SCHOOL_ADMIN']), gradeController_1.deleteGrade);
exports.default = router;
