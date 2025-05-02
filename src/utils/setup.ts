// src/utils/setup.ts
import { Prisma, PrismaClient } from '@prisma/client';
import winston from 'winston';
import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';

// Prisma Client
export const prisma = new PrismaClient();

// Logger
export const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  transports: [
    new winston.transports.File({ filename: 'error.log', level: 'error' }),
    new winston.transports.File({ filename: 'combined.log' }),
  ],
});

if (process.env.NODE_ENV !== 'production') {
  logger.add(new winston.transports.Console({ format: winston.format.simple() }));
}

// Authentication Middleware
export interface AuthRequest extends Request {
  user?: { id: string; role: string };
}

export const authMiddleware = (requiredRoles: string[]) => async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) {
    logger.warn('No token provided', { path: req.path });
    return res.status(401).json({ message: 'No token provided' });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET!) as { id: string; role: string };
    if (requiredRoles.length && !requiredRoles.includes(decoded.role)) {
      logger.warn('Insufficient permissions', { userId: decoded.id, role: decoded.role, path: req.path });
      return res.status(403).json({ message: 'Insufficient permissions' });
    }
    req.user = decoded;
    next();
  } catch (error) {
    logger.error('Invalid token', { error, path: req.path });
    return res.status(401).json({ message: 'Invalid token' });
  }
};

// Error Handler
export const handleError = (res: Response, error: unknown, defaultMessage: string) => {
  logger.error(defaultMessage, { error });
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    if (error.code === 'P2025') {
      return res.status(404).json({ message: 'Resource not found' });
    }
    if (error.code === 'P2002') {
      return res.status(409).json({ message: 'Unique constraint violation' });
    }
  }
  if (error instanceof Error) {
    return res.status(400).json({ message: error.message });
  }
  return res.status(500).json({ message: defaultMessage });
};