// src/routes/classRoutes.ts
import { Router } from 'express';
import { getClasses, getClassById, createClass, updateClass, deleteClass } from '../controllers/classController';
import { authMiddleware } from '../utils/setup';

const router = Router();

router.get('/', authMiddleware(['SUPER_ADMIN', 'PRINCIPAL', 'SCHOOL_ADMIN', 'TEACHER']), getClasses);
router.get('/:id', authMiddleware(['SUPER_ADMIN', 'PRINCIPAL', 'SCHOOL_ADMIN', 'TEACHER']), getClassById);
router.post('/', authMiddleware(['SUPER_ADMIN', 'PRINCIPAL', 'SCHOOL_ADMIN']), createClass);
router.put('/:id', authMiddleware(['SUPER_ADMIN', 'PRINCIPAL', 'SCHOOL_ADMIN']), updateClass);
router.delete('/:id', authMiddleware(['SUPER_ADMIN', 'PRINCIPAL', 'SCHOOL_ADMIN']), deleteClass);

export default router;
