// src/routes/studentRoutes.ts
import { Router } from 'express';
import { getStudents, getStudentById, createStudent, updateStudent, deleteStudent } from '../controllers/studentController';
import { authMiddleware } from '../utils/setup';

const router = Router();

router.get('/', authMiddleware(['SUPER_ADMIN', 'PRINCIPAL', 'TEACHER']), getStudents);
router.get('/:id', authMiddleware(['SUPER_ADMIN', 'PRINCIPAL', 'TEACHER', 'PARENT']), getStudentById);
router.post('/', authMiddleware(['SUPER_ADMIN', 'PRINCIPAL']), createStudent);
router.put('/:id', authMiddleware(['SUPER_ADMIN', 'PRINCIPAL']), updateStudent);
router.delete('/:id', authMiddleware(['SUPER_ADMIN', 'PRINCIPAL']), deleteStudent);

export default router;
