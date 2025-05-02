// src/routes/authRoutes.ts
import { Router } from 'express';
import {
  register,
  login,
  refreshToken,
  logout,
  requestPasswordReset,
  resetPassword,
} from '../controllers/authController';
import { authMiddleware } from '../utils/setup';

const authRouter = Router();

authRouter.post('/register', register);
authRouter.post('/login', login);
authRouter.post('/refresh-token', refreshToken);
authRouter.post('/logout', authMiddleware(['SUPER_ADMIN', 'PRINCIPAL', 'TEACHER', 'PARENT']), logout);
authRouter.post('/request-password-reset', requestPasswordReset);
authRouter.post('/reset-password', resetPassword);

export default authRouter;