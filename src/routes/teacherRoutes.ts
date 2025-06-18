// src/routes/teacherRoutes.ts
import { Router } from 'express';
import { getTeachers, getTeacherById, createTeacher, updateTeacher, deleteTeacher } from '../controllers/teacherController';
import { authMiddleware } from '../utils/setup';

const router = Router();

router.get('/', authMiddleware(['SUPER_ADMIN', 'PRINCIPAL']), getTeachers);
router.get('/:id', authMiddleware(['SUPER_ADMIN', 'PRINCIPAL', 'TEACHER']), getTeacherById);
router.post('/', authMiddleware(['SUPER_ADMIN', 'PRINCIPAL']), createTeacher);
router.put('/:id', authMiddleware(['SUPER_ADMIN', 'PRINCIPAL']), updateTeacher);
router.delete('/:id', authMiddleware(['SUPER_ADMIN', 'PRINCIPAL']), deleteTeacher);

export default router;
