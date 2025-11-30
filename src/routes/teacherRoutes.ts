// src/routes/teacherRoutes.ts
import { Router } from 'express';
import { getTeachers, getTeacherById, createTeacher, updateTeacher, deleteTeacher, verifyTeacher } from '../controllers/teacherController';
import { authMiddleware } from '../utils/setup';
import multer from 'multer';

const router = Router();
const upload = multer({ storage: multer.memoryStorage() });

router.get('/', authMiddleware(['SUPER_ADMIN', 'PRINCIPAL','SCHOOL_ADMIN']), getTeachers);
router.get('/:id', authMiddleware(['SUPER_ADMIN', 'PRINCIPAL', 'TEACHER','SCHOOL_ADMIN']), getTeacherById);
router.post('/', authMiddleware(['SUPER_ADMIN', 'PRINCIPAL','SCHOOL_ADMIN']), upload.single('profileImage'), createTeacher);
router.put('/:id', authMiddleware(['SUPER_ADMIN', 'PRINCIPAL','SCHOOL_ADMIN']), updateTeacher);
router.put('/:id/verify', authMiddleware(['SUPER_ADMIN', 'PRINCIPAL','SCHOOL_ADMIN']), verifyTeacher);
router.delete('/:id', authMiddleware(['SUPER_ADMIN', 'PRINCIPAL','SCHOOL_ADMIN']), deleteTeacher);

export default router;
