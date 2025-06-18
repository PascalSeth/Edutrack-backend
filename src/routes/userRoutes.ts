import { Router } from 'express';
import {
  getUsers,
  getUserById,
  updateUser,
  deleteUser,
} from '../controllers/userController';
import { authMiddleware } from '../utils/setup';

const router = Router();

router.get('/', getUsers);
router.get('/:id', authMiddleware(['SUPER_ADMIN', 'PRINCIPAL', 'TEACHER', 'PARENT']), getUserById);
router.put('/:id', authMiddleware(['SUPER_ADMIN', 'PRINCIPAL', 'TEACHER', 'PARENT']), updateUser);
router.delete('/:id', authMiddleware(['SUPER_ADMIN']), deleteUser);

export default router;
