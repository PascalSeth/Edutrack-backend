// src/routes/gradeRoutes.ts
import { Router } from 'express';
import { getGrades, getGradeById, createGrade, updateGrade, deleteGrade } from '../controllers/gradeController';
import { authMiddleware } from '../utils/setup';

const router = Router();

router.get('/', authMiddleware(['SUPER_ADMIN', 'PRINCIPAL', 'TEACHER']), getGrades);
router.get('/:id', authMiddleware(['SUPER_ADMIN', 'PRINCIPAL', 'TEACHER']), getGradeById);
router.post('/', authMiddleware(['SUPER_ADMIN', 'PRINCIPAL']), createGrade);
router.put('/:id', authMiddleware(['SUPER_ADMIN', 'PRINCIPAL']), updateGrade);
router.delete('/:id', authMiddleware(['SUPER_ADMIN', 'PRINCIPAL']), deleteGrade);

export default router;