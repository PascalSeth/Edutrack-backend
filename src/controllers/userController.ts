import { Response } from 'express';
import { z } from 'zod';
import { prisma, AuthRequest, handleError, logger } from '../utils/setup';

// Validation Schema for updateUser
const updateUserSchema = z.object({
  email: z.string().email('Invalid email').optional(),
  username: z.string().min(1, 'Username is required').optional(),
  name: z.string().min(1, 'Name is required').optional(),
  surname: z.string().min(1, 'Surname is required').optional(),
  role: z.enum(['SUPER_ADMIN', 'PRINCIPAL', 'TEACHER', 'PARENT'], { message: 'Invalid role' }).optional(),
}).refine(data => Object.keys(data).length > 0, { message: 'At least one field must be provided for update' });

export const getUsers = async (req: AuthRequest, res: Response) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 10;
    const skip = (page - 1) * limit;

    // Restrict non-SUPER_ADMIN users to their own data
    let where = {};
    if (req.user?.role !== 'SUPER_ADMIN') {
      where = { id: req.user?.id };
    }

    const [users, total] = await Promise.all([
      prisma.user.findMany({
        where,
        skip,
        take: limit,
        select: {
          id: true,
          email: true,
          username: true,
          name: true,
          surname: true,
          role: true,
          createdAt: true,
        },
      }),
      prisma.user.count({ where }),
    ]);

    logger.info('Users retrieved', { userId: req.user?.id, page, limit });
    res.status(200).json({
      message: 'Users retrieved successfully',
      users,
      pagination: { page, limit, total, pages: Math.ceil(total / limit) },
    });
  } catch (error) {
    handleError(res, error, 'Failed to retrieve users');
  }
};

export const getUserById = async (req: AuthRequest, res: Response) => {
  const { id } = req.params;
  try {
    // Restrict non-SUPER_ADMIN users to their own data
    if (req.user?.role !== 'SUPER_ADMIN' && req.user?.id !== id) {
      logger.warn('Unauthorized user access', { userId: req.user?.id, requestedUserId: id });
      return res.status(403).json({ message: 'Unauthorized to access this user' });
    }

    const user = await prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        email: true,
        username: true,
        name: true,
        surname: true,
        role: true,
        createdAt: true,
      },
    });

    if (!user) {
      logger.warn('User not found', { userId: req.user?.id, requestedUserId: id });
      return res.status(404).json({ message: 'User not found' });
    }

    logger.info('User retrieved', { userId: req.user?.id, requestedUserId: id });
    res.status(200).json({ message: 'User retrieved successfully', user });
  } catch (error) {
    handleError(res, error, 'Failed to retrieve user');
  }
};

export const updateUser = async (req: AuthRequest, res: Response) => {
  const { id } = req.params;
  try {
    const data = updateUserSchema.parse(req.body);

    // Restrict to SUPER_ADMIN or the user themselves
    if (req.user?.role !== 'SUPER_ADMIN' && req.user?.id !== id) {
      logger.warn('Unauthorized attempt to update user', { userId: req.user?.id, requestedUserId: id });
      return res.status(403).json({ message: 'Unauthorized to update this user' });
    }

    // Prevent non-SUPER_ADMIN from changing role
    if (data.role && req.user?.role !== 'SUPER_ADMIN') {
      logger.warn('Unauthorized attempt to change role', { userId: req.user?.id, requestedUserId: id });
      return res.status(403).json({ message: 'Only SUPER_ADMIN can change roles' });
    }

    // Check for email/username conflicts
    if (data.email || data.username) {
      const existingUser = await prisma.user.findFirst({
        where: {
          OR: [
            data.email ? { email: data.email, id: { not: id } } : {},
            data.username ? { username: data.username, id: { not: id } } : {},
          ].filter(Boolean),
        },
      });
      if (existingUser) {
        logger.warn('Update failed: Email or username already exists', { userId: req.user?.id, requestedUserId: id });
        return res.status(409).json({ message: 'Email or username already exists' });
      }
    }

    const user = await prisma.user.update({
      where: { id },
      data: {
        email: data.email,
        username: data.username,
        name: data.name,
        surname: data.surname,
        role: data.role,
        updatedAt: new Date(),
      },
    });

    logger.info('User updated', { userId: req.user?.id, updatedUserId: id });
    res.status(200).json({ message: 'User updated successfully', user });
  } catch (error) {
    if (error instanceof z.ZodError) {
      logger.warn('Invalid input for user update', { userId: req.user?.id, errors: error.errors });
      return res.status(400).json({ message: 'Invalid input', errors: error.errors });
    }
    handleError(res, error, 'Failed to update user');
  }
};

export const deleteUser = async (req: AuthRequest, res: Response) => {
  const { id } = req.params;
  try {
    // Restrict to SUPER_ADMIN
    if (req.user?.role !== 'SUPER_ADMIN') {
      logger.warn('Unauthorized attempt to delete user', { userId: req.user?.id, requestedUserId: id });
      return res.status(403).json({ message: 'Only SUPER_ADMIN can delete users' });
    }

    await prisma.user.delete({ where: { id } });
    logger.info('User deleted', { userId: req.user?.id, deletedUserId: id });
    res.status(200).json({ message: 'User deleted successfully' });
  } catch (error) {
    handleError(res, error, 'Failed to delete user');
  }
};
