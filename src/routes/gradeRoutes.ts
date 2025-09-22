// src/routes/gradeRoutes.ts
import { Router } from 'express';
import { getGrades, getGradeById, createGrade, updateGrade, deleteGrade } from '../controllers/gradeController';
import { authMiddleware } from '../utils/setup';

const router = Router();

router.get('/', authMiddleware(['SUPER_ADMIN', 'PRINCIPAL', 'SCHOOL_ADMIN', 'TEACHER']), getGrades);
router.get('/:id', authMiddleware(['SUPER_ADMIN', 'PRINCIPAL', 'SCHOOL_ADMIN', 'TEACHER']), getGradeById);
router.post('/', authMiddleware(['SUPER_ADMIN', 'PRINCIPAL', 'SCHOOL_ADMIN']), createGrade);
router.put('/:id', authMiddleware(['SUPER_ADMIN', 'PRINCIPAL', 'SCHOOL_ADMIN']), updateGrade);
router.delete('/:id', authMiddleware(['SUPER_ADMIN', 'PRINCIPAL', 'SCHOOL_ADMIN']), deleteGrade);

export default router;
