// src/routes/teacherRoutes.ts
import { Router } from 'express';
import { getTeachers, getTeacherById, createTeacher, updateTeacher, deleteTeacher } from '../controllers/teacherController';
import { authMiddleware } from '../utils/setup';

const router = Router();

router.get('/', authMiddleware(['SUPER_ADMIN', 'PRINCIPAL','SCHOOL_ADMIN']), getTeachers);
router.get('/:id', authMiddleware(['SUPER_ADMIN', 'PRINCIPAL', 'TEACHER','SCHOOL_ADMIN']), getTeacherById);
router.post('/', authMiddleware(['SUPER_ADMIN', 'PRINCIPAL','SCHOOL_ADMIN']), createTeacher);
router.put('/:id', authMiddleware(['SUPER_ADMIN', 'PRINCIPAL','SCHOOL_ADMIN']), updateTeacher);
router.delete('/:id', authMiddleware(['SUPER_ADMIN', 'PRINCIPAL','SCHOOL_ADMIN']), deleteTeacher);

export default router;
