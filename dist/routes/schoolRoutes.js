"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const schoolController_1 = require("../controllers/schoolController");
const setup_1 = require("../utils/setup");
const multer_1 = __importDefault(require("multer")); // For handling file uploads
const router = (0, express_1.Router)();
const upload = (0, multer_1.default)({ storage: multer_1.default.memoryStorage() }); // Configure multer for file uploads
// Get all schools (SUPER_ADMIN, PRINCIPAL, TEACHER, PARENT)
router.get('/', (0, setup_1.authMiddleware)(['SUPER_ADMIN', 'PRINCIPAL', 'SCHOOL_ADMIN', 'TEACHER', 'PARENT']), schoolController_1.getSchools);
// Get school by ID (SUPER_ADMIN, PRINCIPAL, TEACHER, PARENT)
router.get('/:id', (0, setup_1.authMiddleware)(['SUPER_ADMIN', 'SCHOOL_ADMIN', 'PRINCIPAL', 'TEACHER', 'PARENT']), schoolController_1.getSchoolById);
// Get school statistics (SUPER_ADMIN, PRINCIPAL, TEACHER, PARENT)
router.get('/:id/stats', (0, setup_1.authMiddleware)(['SUPER_ADMIN', 'PRINCIPAL', 'TEACHER', 'PARENT']), schoolController_1.getSchoolStats);
// Create school (SUPER_ADMIN only)
router.post('/', (0, setup_1.authMiddleware)(['SUPER_ADMIN']), schoolController_1.registerSchool);
// Update school (SUPER_ADMIN only)
router.put('/:id', (0, setup_1.authMiddleware)(['SUPER_ADMIN', 'SCHOOL_ADMIN']), schoolController_1.updateSchool);
// Verify school (SUPER_ADMIN only)
router.patch('/:id/verify', (0, setup_1.authMiddleware)(['SUPER_ADMIN', 'SCHOOL_ADMIN']), schoolController_1.verifySchool);
// Upload school logo (SUPER_ADMIN or authorized users)
router.post('/:id/logo', (0, setup_1.authMiddleware)(['SUPER_ADMIN', 'SCHOOL_ADMIN', 'SCHOOL_ADMIN']), upload.single('logo'), schoolController_1.uploadSchoolLogo);
// Upload accreditation documents (SUPER_ADMIN or authorized users)
router.post('/:id/accreditation', (0, setup_1.authMiddleware)(['SUPER_ADMIN', 'SCHOOL_ADMIN', 'SCHOOL_ADMIN']), upload.array('documents'), schoolController_1.uploadAccreditationDocuments);
// Delete school (SUPER_ADMIN only)
router.delete('/:id', (0, setup_1.authMiddleware)(['SUPER_ADMIN']), schoolController_1.deleteSchool);
exports.default = router;
