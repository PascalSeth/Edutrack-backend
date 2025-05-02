// src/routes/parentRoutes.ts
import { Router } from 'express';
import { getParents, getParentById, createParent, updateParent, deleteParent } from '../controllers/parentController';
import { authMiddleware } from '../utils/setup';

const router = Router();

router.get('/', authMiddleware(['SUPER_ADMIN', 'PRINCIPAL', 'TEACHER']), getParents);
router.get('/:id', authMiddleware(['SUPER_ADMIN', 'PRINCIPAL', 'TEACHER', 'PARENT']), getParentById);
router.post('/', authMiddleware(['SUPER_ADMIN', 'PRINCIPAL']), createParent);
router.put('/:id', authMiddleware(['SUPER_ADMIN', 'PRINCIPAL']), updateParent);
router.delete('/:id', authMiddleware(['SUPER_ADMIN', 'PRINCIPAL']), deleteParent);

export default router;