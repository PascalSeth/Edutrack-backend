// src/controllers/parentController.ts
import { Response } from 'express';
import { z } from 'zod';
import { prisma, AuthRequest, handleError, logger } from '../utils/setup';

// Validation Schemas
const createParentSchema = z.object({
  userId: z.string().uuid('Invalid user ID'),
  schoolId: z.string().uuid('Invalid school ID'),
});

const updateParentSchema = z.object({}); // No fields to update directly in Parent model

export const getParents = async (req: AuthRequest, res: Response) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 10;
    const skip = (page - 1) * limit;

    const [parents, total] = await Promise.all([
      prisma.parent.findMany({
        skip,
        take: limit,
        select: {
          id: true,
          user: { select: { email: true, name: true, surname: true } },
          schoolId: true,
        },
      }),
      prisma.parent.count(),
    ]);

    logger.info('Parents retrieved', { userId: req.user?.id, page, limit });
    res.status(200).json({
      message: 'Parents retrieved successfully',
      parents,
      pagination: { page, limit, total, pages: Math.ceil(total / limit) },
    });
  } catch (error) {
    handleError(res, error, 'Failed to retrieve parents');
  }
};

export const getParentById = async (req: AuthRequest, res: Response) => {
  const { id } = req.params;
  try {
    const parent = await prisma.parent.findUnique({
      where: { id },
      select: {
        id: true,
        user: { select: { email: true, name: true, surname: true } },
        schoolId: true,
      },
    });
    if (!parent) {
      logger.warn('Parent not found', { userId: req.user?.id, parentId: id });
      return res.status(404).json({ message: 'Parent not found' });
    }
    logger.info('Parent retrieved', { userId: req.user?.id, parentId: id });
    res.status(200).json({ message: 'Parent retrieved successfully', parent });
  } catch (error) {
    handleError(res, error, 'Failed to retrieve parent');
  }
};

export const createParent = async (req: AuthRequest, res: Response) => {
  try {
    const data = createParentSchema.parse(req.body);

    // Verify user and school
    const [user, school] = await Promise.all([
      prisma.user.findUnique({ where: { id: data.userId } }),
      prisma.school.findUnique({ where: { id: data.schoolId } }),
    ]);
    if (!user) throw new Error('User not found');
    if (user.role !== 'PARENT') throw new Error('User must have PARENT role');
    if (!school) throw new Error('School not found');

    // Check if parent record already exists
    const existingParent = await prisma.parent.findUnique({ where: { id: data.userId } });
    if (existingParent) throw new Error('Parent record already exists for this user');

    const parent = await prisma.parent.create({
      data: {
        id: data.userId,
        schoolId: data.schoolId,
      },
    });

    logger.info('Parent created', { userId: req.user?.id, parentId: parent.id });
    res.status(201).json({ message: 'Parent created successfully', parent });
  } catch (error) {
    if (error instanceof z.ZodError) {
      logger.warn('Invalid input for parent creation', { userId: req.user?.id, errors: error.errors });
      return res.status(400).json({ message: 'Invalid input', errors: error.errors });
    }
    handleError(res, error, 'Failed to create parent');
  }
};

export const updateParent = async (req: AuthRequest, res: Response) => {
  const { id } = req.params;
  try {
    // No fields to update directly in Parent model, but included for consistency
    const parent = await prisma.parent.findUnique({ where: { id } });
    if (!parent) {
      logger.warn('Parent not found', { userId: req.user?.id, parentId: id });
      return res.status(404).json({ message: 'Parent not found' });
    }
    logger.info('Parent update requested (no changes)', { userId: req.user?.id, parentId: id });
    res.status(200).json({ message: 'Parent unchanged', parent });
  } catch (error) {
    handleError(res, error, 'Failed to update parent');
  }
};

export const deleteParent = async (req: AuthRequest, res: Response) => {
  const { id } = req.params;
  try {
    await prisma.parent.delete({ where: { id } });
    logger.info('Parent deleted', { userId: req.user?.id, parentId: id });
    res.status(200).json({ message: 'Parent deleted successfully' });
  } catch (error) {
    handleError(res, error, 'Failed to delete parent');
  }
};
