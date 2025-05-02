// src/routes/classRoutes.ts
import { Router } from 'express';
import { getClasses, getClassById, createClass, updateClass, deleteClass } from '../controllers/classController';
import { authMiddleware } from '../utils/setup';

const router = Router();

router.get('/', authMiddleware(['SUPER_ADMIN', 'PRINCIPAL', 'TEACHER']), getClasses);
router.get('/:id', authMiddleware(['SUPER_ADMIN', 'PRINCIPAL', 'TEACHER']), getClassById);
router.post('/', authMiddleware(['SUPER_ADMIN', 'PRINCIPAL']), createClass);
router.put('/:id', authMiddleware(['SUPER_ADMIN', 'PRINCIPAL']), updateClass);
router.delete('/:id', authMiddleware(['SUPER_ADMIN', 'PRINCIPAL']), deleteClass);

export default router;