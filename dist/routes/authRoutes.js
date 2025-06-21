"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
// src/routes/authRoutes.ts
const express_1 = require("express");
const authController_1 = require("../controllers/authController");
const setup_1 = require("../utils/setup");
const authRouter = (0, express_1.Router)();
authRouter.post('/register', authController_1.register);
authRouter.post('/login', authController_1.login);
authRouter.post('/refresh-token', authController_1.refreshToken);
authRouter.post('/logout', (0, setup_1.authMiddleware)(['SUPER_ADMIN', 'PRINCIPAL', 'TEACHER', 'PARENT']), authController_1.logout);
authRouter.post('/request-password-reset', authController_1.requestPasswordReset);
authRouter.post('/reset-password', authController_1.resetPassword);
exports.default = authRouter;
