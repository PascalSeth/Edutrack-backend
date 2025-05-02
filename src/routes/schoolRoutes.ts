import { Router } from 'express';
import {
  getSchools,
  getSchoolById,
  createSchool,
  updateSchool,
  deleteSchool,
} from '../controllers/schoolController';
import { authMiddleware } from '../utils/setup';

const router = Router();

// Get all schools (SUPER_ADMIN, PRINCIPAL, TEACHER, PARENT)
router.get('/', authMiddleware(['SUPER_ADMIN', 'PRINCIPAL', 'TEACHER', 'PARENT']), getSchools);

// Get school by ID (SUPER_ADMIN, PRINCIPAL, TEACHER, PARENT)
router.get('/:id', authMiddleware(['SUPER_ADMIN', 'PRINCIPAL', 'TEACHER', 'PARENT']), getSchoolById);

// Create school (SUPER_ADMIN only)
router.post('/', authMiddleware(['SUPER_ADMIN']), createSchool);

// Update school (SUPER_ADMIN only)
router.put('/:id', authMiddleware(['SUPER_ADMIN']), updateSchool);

// Delete school (SUPER_ADMIN only)
router.delete('/:id', authMiddleware(['SUPER_ADMIN']), deleteSchool);

export default router;