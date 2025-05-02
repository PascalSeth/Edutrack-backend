// src/controllers/authController.ts
import { Response } from 'express';
import { z } from 'zod';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { prisma, AuthRequest, handleError, logger } from '../utils/setup';

// Validation Schemas
const registerSchema = z.object({
  email: z.string().email('Invalid email').min(1, 'Email is required'),
  username: z.string().min(1, 'Username is required'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  name: z.string().min(1, 'Name is required'),
  surname: z.string().min(1, 'Surname is required'),
  role: z.enum(['SUPER_ADMIN', 'PRINCIPAL', 'TEACHER', 'PARENT'], { message: 'Invalid role' }),
  schoolId: z.string().uuid('Invalid school ID').optional(),
  qualifications: z.string().optional(),
  bio: z.string().optional(),
  imageUrl: z.string().url('Invalid URL').optional(),
});

const loginSchema = z.object({
  email: z.string().email('Invalid email').min(1, 'Email is required'),
  password: z.string().min(1, 'Password is required'),
});

const refreshTokenSchema = z.object({
  refreshToken: z.string().min(1, 'Refresh token is required'),
});

const requestPasswordResetSchema = z.object({
  email: z.string().email('Invalid email').min(1, 'Email is required'),
});

const resetPasswordSchema = z.object({
  token: z.string().min(1, 'Reset token is required'),
  newPassword: z.string().min(8, 'Password must be at least 8 characters'),
});

// Helper to generate tokens
const generateTokens = (user: { id: string; role: string }) => {
  const accessToken = jwt.sign({ id: user.id, role: user.role }, process.env.JWT_SECRET!, {
    expiresIn: '15m',
  });
  const refreshToken = jwt.sign({ id: user.id, role: user.role }, process.env.JWT_REFRESH_SECRET!, {
    expiresIn: '7d',
  });
  return { accessToken, refreshToken };
};

export const register = async (req: AuthRequest, res: Response) => {
  try {
    const data = registerSchema.parse(req.body);
    const existingUser = await prisma.user.findFirst({
      where: { OR: [{ email: data.email }, { username: data.username }] },
    });
    if (existingUser) {
      logger.warn('Registration failed: Email or username already exists', { email: data.email });
      return res.status(409).json({ message: 'Email or username already exists' });
    }
    const passwordHash = await bcrypt.hash(data.password, 10);
    const user = await prisma.$transaction(async (tx) => {
      const newUser = await tx.user.create({
        data: {
          email: data.email,
          username: data.username,
          passwordHash,
          name: data.name,
          surname: data.surname,
          role: data.role,
        },
      });
      switch (data.role) {
        case 'SUPER_ADMIN':
          await tx.admin.create({ data: { id: newUser.id } });
          break;
        case 'PRINCIPAL':
          if (!data.schoolId) throw new Error('schoolId is required for Principal');
          await tx.principal.create({
            data: { id: newUser.id, schoolId: data.schoolId, imageUrl: data.imageUrl },
          });
          break;
        case 'TEACHER':
          if (!data.schoolId) throw new Error('schoolId is required for Teacher');
          await tx.teacher.create({
            data: {
              id: newUser.id,
              schoolId: data.schoolId,
              qualifications: data.qualifications,
              bio: data.bio,
              imageUrl: data.imageUrl,
            },
          });
          break;
        case 'PARENT':
          if (!data.schoolId) throw new Error('schoolId is required for Parent');
          await tx.parent.create({
            data: { id: newUser.id, schoolId: data.schoolId },
          });
          break;
      }
      return newUser;
    });
    const { accessToken, refreshToken } = generateTokens({ id: user.id, role: user.role });
    await prisma.deviceToken.create({
      data: {
        token: refreshToken,
        deviceType: 'WEB',
        userId: user.id,
      },
    });
    logger.info('User registered', { userId: user.id, role: user.role });
    res.status(201).json({
      message: 'User registered successfully',
      user: { id: user.id, email: user.email, role: user.role },
      accessToken,
      refreshToken,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      logger.warn('Invalid input for registration', { errors: error.errors });
      return res.status(400).json({ message: 'Invalid input', errors: error.errors });
    }
    handleError(res, error, 'Failed to register user');
  }
};

export const login = async (req: AuthRequest, res: Response) => {
  try {
    const data = loginSchema.parse(req.body);
    const user = await prisma.user.findUnique({ where: { email: data.email } });
    if (!user) {
      logger.warn('Login failed: User not found', { email: data.email });
      return res.status(401).json({ message: 'Invalid credentials' });
    }
    const isValidPassword = await bcrypt.compare(data.password, user.passwordHash);
    if (!isValidPassword) {
      logger.warn('Login failed: Invalid password', { email: data.email });
      return res.status(401).json({ message: 'Invalid credentials' });
    }
    const { accessToken, refreshToken } = generateTokens({ id: user.id, role: user.role });
    await prisma.deviceToken.create({
      data: {
        token: refreshToken,
        deviceType: 'WEB',
        userId: user.id,
      },
    });
    await prisma.user.update({
      where: { id: user.id },
      data: { lastLogin: new Date() },
    });
    logger.info('User logged in', { userId: user.id, role: user.role });
    res.status(200).json({
      message: 'Login successful',
      user: { id: user.id, email: user.email, role: user.role },
      accessToken,
      refreshToken,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      logger.warn('Invalid input for login', { errors: error.errors });
      return res.status(400).json({ message: 'Invalid input', errors: error.errors });
    }
    handleError(res, error, 'Failed to login');
  }
};

export const refreshToken = async (req: AuthRequest, res: Response) => {
  try {
    const data = refreshTokenSchema.parse(req.body);
    let decoded: { id: string; role: string };
    try {
      decoded = jwt.verify(data.refreshToken, process.env.JWT_REFRESH_SECRET!) as { id: string; role: string };
    } catch (error) {
      logger.warn('Invalid refresh token', { refreshToken: data.refreshToken });
      return res.status(401).json({ message: 'Invalid refresh token' });
    }
    const storedToken = await prisma.deviceToken.findUnique({ where: { token: data.refreshToken } });
    if (!storedToken) {
      logger.warn('Refresh token not found in database', { refreshToken: data.refreshToken });
      return res.status(401).json({ message: 'Invalid refresh token' });
    }
    const user = await prisma.user.findUnique({ where: { id: decoded.id } });
    if (!user) {
      logger.warn('User not found for refresh token', { userId: decoded.id });
      return res.status(401).json({ message: 'User not found' });
    }
    const accessToken = jwt.sign({ id: user.id, role: user.role }, process.env.JWT_SECRET!, {
      expiresIn: '15m',
    });
    logger.info('Access token refreshed', { userId: user.id });
    res.status(200).json({ message: 'Token refreshed successfully', accessToken });
  } catch (error) {
    if (error instanceof z.ZodError) {
      logger.warn('Invalid input for token refresh', { errors: error.errors });
      return res.status(400).json({ message: 'Invalid input', errors: error.errors });
    }
    handleError(res, error, 'Failed to refresh token');
  }
};

export const logout = async (req: AuthRequest, res: Response) => {
  try {
    const refreshToken = req.body.refreshToken;
    if (!refreshToken) {
      logger.warn('No refresh token provided for logout', { userId: req.user?.id });
      return res.status(400).json({ message: 'Refresh token required' });
    }
    await prisma.deviceToken.deleteMany({ where: { token: refreshToken, userId: req.user?.id } });
    logger.info('User logged out', { userId: req.user?.id });
    res.status(200).json({ message: 'Logout successful' });
  } catch (error) {
    handleError(res, error, 'Failed to logout');
  }
};

export const requestPasswordReset = async (req: AuthRequest, res: Response) => {
  try {
    const data = requestPasswordResetSchema.parse(req.body);
    const user = await prisma.user.findUnique({ where: { email: data.email } });
    if (!user) {
      logger.warn('Password reset requested for non-existent email', { email: data.email });
      return res.status(200).json({ message: 'If the email exists, a reset link will be sent' });
    }
    const resetToken = jwt.sign({ id: user.id, email: user.email }, process.env.JWT_RESET_SECRET!, {
      expiresIn: '1h',
    });
    logger.info('Password reset token generated', { userId: user.id, email: user.email });
    res.status(200).json({ message: 'Password reset token generated', resetToken }); // In production, send via email
  } catch (error) {
    if (error instanceof z.ZodError) {
      logger.warn('Invalid input for password reset request', { errors: error.errors });
      return res.status(400).json({ message: 'Invalid input', errors: error.errors });
    }
    handleError(res, error, 'Failed to request password reset');
  }
};

export const resetPassword = async (req: AuthRequest, res: Response) => {
  try {
    const data = resetPasswordSchema.parse(req.body);
    let decoded: { id: string; email: string };
    try {
      decoded = jwt.verify(data.token, process.env.JWT_RESET_SECRET!) as { id: string; email: string };
    } catch (error) {
      logger.warn('Invalid reset token', { token: data.token });
      return res.status(401).json({ message: 'Invalid or expired reset token' });
    }
    const user = await prisma.user.findUnique({ where: { id: decoded.id, email: decoded.email } });
    if (!user) {
      logger.warn('User not found for password reset', { userId: decoded.id });
      return res.status(404).json({ message: 'User not found' });
    }
    const passwordHash = await bcrypt.hash(data.newPassword, 10);
    await prisma.user.update({
      where: { id: user.id },
      data: { passwordHash },
    });
    await prisma.deviceToken.deleteMany({ where: { userId: user.id } });
    logger.info('Password reset successful', { userId: user.id });
    res.status(200).json({ message: 'Password reset successfully' });
  } catch (error) {
    if (error instanceof z.ZodError) {
      logger.warn('Invalid input for password reset', { errors: error.errors });
      return res.status(400).json({ message: 'Invalid input', errors: error.errors });
    }
    handleError(res, error, 'Failed to reset password');
  }
};