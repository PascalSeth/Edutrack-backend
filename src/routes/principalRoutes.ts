// src/routes/principalRoutes.ts
import { Router } from 'express';
import { getPrincipals, getPrincipalById, createPrincipal, updatePrincipal, deletePrincipal, verifyPrincipal } from '../controllers/principalController';
import { authMiddleware } from '../utils/setup';

const router = Router();

router.get('/', authMiddleware(['SUPER_ADMIN', 'PRINCIPAL','SCHOOL_ADMIN']), getPrincipals);
router.get('/:id', authMiddleware(['SUPER_ADMIN', 'PRINCIPAL','SCHOOL_ADMIN']), getPrincipalById);
router.post('/', authMiddleware(['SUPER_ADMIN', 'PRINCIPAL','SCHOOL_ADMIN']), createPrincipal);
router.put('/:id', authMiddleware(['SUPER_ADMIN', 'PRINCIPAL','SCHOOL_ADMIN']), updatePrincipal);
router.put('/:id/verify', authMiddleware(['SUPER_ADMIN', 'SCHOOL_ADMIN']), verifyPrincipal);
router.delete('/:id', authMiddleware(['SUPER_ADMIN', 'PRINCIPAL','SCHOOL_ADMIN']), deletePrincipal);

export default router;