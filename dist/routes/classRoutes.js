"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
// src/routes/classRoutes.ts
const express_1 = require("express");
const classController_1 = require("../controllers/classController");
const setup_1 = require("../utils/setup");
const router = (0, express_1.Router)();
router.get('/', (0, setup_1.authMiddleware)(['SUPER_ADMIN', 'PRINCIPAL', 'SCHOOL_ADMIN', 'TEACHER']), classController_1.getClasses);
router.get('/:id', (0, setup_1.authMiddleware)(['SUPER_ADMIN', 'PRINCIPAL', 'SCHOOL_ADMIN', 'TEACHER']), classController_1.getClassById);
router.post('/', (0, setup_1.authMiddleware)(['SUPER_ADMIN', 'PRINCIPAL', 'SCHOOL_ADMIN']), classController_1.createClass);
router.put('/:id', (0, setup_1.authMiddleware)(['SUPER_ADMIN', 'PRINCIPAL', 'SCHOOL_ADMIN']), classController_1.updateClass);
router.delete('/:id', (0, setup_1.authMiddleware)(['SUPER_ADMIN', 'PRINCIPAL', 'SCHOOL_ADMIN']), classController_1.deleteClass);
exports.default = router;
