// src/controllers/gradeController.ts
import { Response } from 'express';
import { z } from 'zod';
import { prisma, AuthRequest, handleError, logger } from '../utils/setup';

// Validation Schemas
const createGradeSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  level: z.number().int().min(1, 'Level must be a positive integer'),
  schoolId: z.string().uuid('Invalid school ID'),
});

const updateGradeSchema = z.object({
  name: z.string().min(1).optional(),
  level: z.number().int().min(1).optional(),
});

export const getGrades = async (req: AuthRequest, res: Response) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 10;
    const skip = (page - 1) * limit;

    const [grades, total] = await Promise.all([
      prisma.grade.findMany({
        skip,
        take: limit,
        select: {
          id: true,
          name: true,
          level: true,
          schoolId: true,
        },
      }),
      prisma.grade.count(),
    ]);

    logger.info('Grades retrieved', { userId: req.user?.id, page, limit });
    res.status(200).json({
      message: 'Grades retrieved successfully',
      grades,
      pagination: { page, limit, total, pages: Math.ceil(total / limit) },
    });
  } catch (error) {
    handleError(res, error, 'Failed to retrieve grades');
  }
};

export const getGradeById = async (req: AuthRequest, res: Response) => {
  const { id } = req.params;
  try {
    const grade = await prisma.grade.findUnique({
      where: { id },
      select: {
        id: true,
        name: true,
        level: true,
        schoolId: true,
      },
    });
    if (!grade) {
      logger.warn('Grade not found', { userId: req.user?.id, gradeId: id });
      return res.status(404).json({ message: 'Grade not found' });
    }
    logger.info('Grade retrieved', { userId: req.user?.id, gradeId: id });
    res.status(200).json({ message: 'Grade retrieved successfully', grade });
  } catch (error) {
    handleError(res, error, 'Failed to retrieve grade');
  }
};

export const createGrade = async (req: AuthRequest, res: Response) => {
  try {
    const data = createGradeSchema.parse(req.body);

    // Verify school
    const school = await prisma.school.findUnique({ where: { id: data.schoolId } });
    if (!school) throw new Error('School not found');

    const grade = await prisma.grade.create({
      data: {
        name: data.name,
        level: data.level,
        schoolId: data.schoolId,
      },
    });

    logger.info('Grade created', { userId: req.user?.id, gradeId: grade.id });
    res.status(201).json({ message: 'Grade created successfully', grade });
  } catch (error) {
    if (error instanceof z.ZodError) {
      logger.warn('Invalid input for grade creation', { userId: req.user?.id, errors: error.errors });
      return res.status(400).json({ message: 'Invalid input', errors: error.errors });
    }
    handleError(res, error, 'Failed to create grade');
  }
};

export const updateGrade = async (req: AuthRequest, res: Response) => {
  const { id } = req.params;
  try {
    const data = updateGradeSchema.parse(req.body);

    const grade = await prisma.grade.update({
      where: { id },
      data: {
        name: data.name,
        level: data.level,
      },
    });

    logger.info('Grade updated', { userId: req.user?.id, gradeId: id });
    res.status(200).json({ message: 'Grade updated successfully', grade });
  } catch (error) {
    if (error instanceof z.ZodError) {
      logger.warn('Invalid input for grade update', { userId: req.user?.id, errors: error.errors });
      return res.status(400).json({ message: 'Invalid input', errors: error.errors });
    }
    handleError(res, error, 'Failed to update grade');
  }
};

export const deleteGrade = async (req: AuthRequest, res: Response) => {
  const { id } = req.params;
  try {
    await prisma.grade.delete({ where: { id } });
    logger.info('Grade deleted', { userId: req.user?.id, gradeId: id });
    res.status(200).json({ message: 'Grade deleted successfully' });
  } catch (error) {
    handleError(res, error, 'Failed to delete grade');
  }
};
