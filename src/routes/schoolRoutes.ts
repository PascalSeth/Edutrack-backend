import { Router } from 'express';
import {
  getSchools,
  getSchoolById,
  registerSchool,
  updateSchool,
  deleteSchool,
  verifySchool,
  uploadSchoolLogo,
  uploadAccreditationDocuments,
  getSchoolStats,
} from '../controllers/schoolController';
import { authMiddleware } from '../utils/setup';
import multer from 'multer'; // For handling file uploads

const router = Router();
const upload = multer({ storage: multer.memoryStorage() }); // Configure multer for file uploads

// Get all schools (SUPER_ADMIN, PRINCIPAL, TEACHER, PARENT)
router.get('/', authMiddleware(['SUPER_ADMIN', 'PRINCIPAL','SCHOOL_ADMIN', 'TEACHER', 'PARENT']), getSchools);

// Get school by ID (SUPER_ADMIN, PRINCIPAL, TEACHER, PARENT)
router.get('/:id', authMiddleware(['SUPER_ADMIN','SCHOOL_ADMIN', 'PRINCIPAL', 'TEACHER', 'PARENT']), getSchoolById);

// Get school statistics (SUPER_ADMIN, PRINCIPAL, TEACHER, PARENT)
router.get('/:id/stats', authMiddleware(['SUPER_ADMIN', 'PRINCIPAL', 'TEACHER', 'PARENT']), getSchoolStats);

// Create school (SUPER_ADMIN only)
router.post('/', authMiddleware(['SUPER_ADMIN']), registerSchool);

// Update school (SUPER_ADMIN only)
router.put('/:id', authMiddleware(['SUPER_ADMIN','SCHOOL_ADMIN']), updateSchool);

// Verify school (SUPER_ADMIN only)
router.patch('/:id/verify', authMiddleware(['SUPER_ADMIN','SCHOOL_ADMIN']), verifySchool);

// Upload school logo (SUPER_ADMIN or authorized users)
router.post('/:id/logo', authMiddleware(['SUPER_ADMIN','SCHOOL_ADMIN', 'SCHOOL_ADMIN']), upload.single('logo'), uploadSchoolLogo);

// Upload accreditation documents (SUPER_ADMIN or authorized users)
router.post('/:id/accreditation', authMiddleware(['SUPER_ADMIN','SCHOOL_ADMIN', 'SCHOOL_ADMIN']), upload.array('documents'), uploadAccreditationDocuments);

// Delete school (SUPER_ADMIN only)
router.delete('/:id', authMiddleware(['SUPER_ADMIN']), deleteSchool);

export default router;