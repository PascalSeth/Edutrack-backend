"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const schoolController_1 = require("../controllers/schoolController");
const setup_1 = require("../utils/setup");
const router = (0, express_1.Router)();
// Get all schools (SUPER_ADMIN, PRINCIPAL, TEACHER, PARENT)
router.get('/', (0, setup_1.authMiddleware)(['SUPER_ADMIN', 'PRINCIPAL', 'TEACHER', 'PARENT']), schoolController_1.getSchools);
// Get school by ID (SUPER_ADMIN, PRINCIPAL, TEACHER, PARENT)
router.get('/:id', (0, setup_1.authMiddleware)(['SUPER_ADMIN', 'PRINCIPAL', 'TEACHER', 'PARENT']), schoolController_1.getSchoolById);
// Create school (SUPER_ADMIN only)
router.post('/', (0, setup_1.authMiddleware)(['SUPER_ADMIN']), schoolController_1.registerSchool);
// Update school (SUPER_ADMIN only)
router.put('/:id', (0, setup_1.authMiddleware)(['SUPER_ADMIN']), schoolController_1.updateSchool);
// Delete school (SUPER_ADMIN only)
router.delete('/:id', (0, setup_1.authMiddleware)(['SUPER_ADMIN']), schoolController_1.deleteSchool);
exports.default = router;
