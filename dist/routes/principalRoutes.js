"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
// src/routes/principalRoutes.ts
const express_1 = require("express");
const principalController_1 = require("../controllers/principalController");
const setup_1 = require("../utils/setup");
const router = (0, express_1.Router)();
router.get('/', (0, setup_1.authMiddleware)(['SUPER_ADMIN', 'PRINCIPAL', 'SCHOOL_ADMIN']), principalController_1.getPrincipals);
router.get('/:id', (0, setup_1.authMiddleware)(['SUPER_ADMIN', 'PRINCIPAL', 'SCHOOL_ADMIN']), principalController_1.getPrincipalById);
router.post('/', (0, setup_1.authMiddleware)(['SUPER_ADMIN', 'PRINCIPAL', 'SCHOOL_ADMIN']), principalController_1.createPrincipal);
router.put('/:id', (0, setup_1.authMiddleware)(['SUPER_ADMIN', 'PRINCIPAL', 'SCHOOL_ADMIN']), principalController_1.updatePrincipal);
router.put('/:id/verify', (0, setup_1.authMiddleware)(['SUPER_ADMIN', 'SCHOOL_ADMIN']), principalController_1.verifyPrincipal);
router.delete('/:id', (0, setup_1.authMiddleware)(['SUPER_ADMIN', 'PRINCIPAL', 'SCHOOL_ADMIN']), principalController_1.deletePrincipal);
exports.default = router;
