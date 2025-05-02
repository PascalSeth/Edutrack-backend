// src/controllers/teacherController.ts
import { Response } from 'express';
import { z } from 'zod';
import { prisma, AuthRequest, handleError, logger } from '../utils/setup';

// Validation Schemas
const createTeacherSchema = z.object({
  userId: z.string().uuid('Invalid user ID'),
  schoolId: z.string().uuid('Invalid school ID'),
  bloodType: z.string().optional(),
  sex: z.enum(['MALE', 'FEMALE', 'OTHER']).optional(),
  imageUrl: z.string().url().optional(),
  birthday: z.string().datetime().optional(),
  bio: z.string().optional(),
  qualifications: z.string().optional(),
});

const updateTeacherSchema = z.object({
  bloodType: z.string().optional(),
  sex: z.enum(['MALE', 'FEMALE', 'OTHER']).optional(),
  imageUrl: z.string().url().optional(),
  birthday: z.string().datetime().optional(),
  bio: z.string().optional(),
  qualifications: z.string().optional(),
});

export const getTeachers = async (req: AuthRequest, res: Response) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 10;
    const skip = (page - 1) * limit;

    const [teachers, total] = await Promise.all([
      prisma.teacher.findMany({
        skip,
        take: limit,
        select: {
          id: true,
          user: { select: { email: true, name: true, surname: true } },
          schoolId: true,
          qualifications: true,
        },
      }),
      prisma.teacher.count(),
    ]);

    logger.info('Teachers retrieved', { userId: req.user?.id, page, limit });
    res.status(200).json({
      message: 'Teachers retrieved successfully',
      teachers,
      pagination: { page, limit, total, pages: Math.ceil(total / limit) },
    });
  } catch (error) {
    handleError(res, error, 'Failed to retrieve teachers');
  }
};

export const getTeacherById = async (req: AuthRequest, res: Response) => {
  const { id } = req.params;
  try {
    const teacher = await prisma.teacher.findUnique({
      where: { id },
      select: {
        id: true,
        user: { select: { email: true, name: true, surname: true } },
        schoolId: true,
        qualifications: true,
      },
    });
    if (!teacher) {
      logger.warn('Teacher not found', { userId: req.user?.id, teacherId: id });
      return res.status(404).json({ message: 'Teacher not found' });
    }
    logger.info('Teacher retrieved', { userId: req.user?.id, teacherId: id });
    res.status(200).json({ message: 'Teacher retrieved successfully', teacher });
  } catch (error) {
    handleError(res, error, 'Failed to retrieve teacher');
  }
};

export const createTeacher = async (req: AuthRequest, res: Response) => {
  try {
    const data = createTeacherSchema.parse(req.body);

    // Verify user and school
    const [user, school] = await Promise.all([
      prisma.user.findUnique({ where: { id: data.userId } }),
      prisma.school.findUnique({ where: { id: data.schoolId } }),
    ]);
    if (!user) throw new Error('User not found');
    if (user.role !== 'TEACHER') throw new Error('User must have TEACHER role');
    if (!school) throw new Error('School not found');

    // Check if teacher record already exists
    const existingTeacher = await prisma.teacher.findUnique({ where: { id: data.userId } });
    if (existingTeacher) throw new Error('Teacher record already exists for this user');

    const teacher = await prisma.teacher.create({
      data: {
        id: data.userId,
        schoolId: data.schoolId,
        bloodType: data.bloodType,
        sex: data.sex,
        imageUrl: data.imageUrl,
        birthday: data.birthday ? new Date(data.birthday) : undefined,
        bio: data.bio,
        qualifications: data.qualifications,
      },
    });

    logger.info('Teacher created', { userId: req.user?.id, teacherId: teacher.id });
    res.status(201).json({ message: 'Teacher created successfully', teacher });
  } catch (error) {
    if (error instanceof z.ZodError) {
      logger.warn('Invalid input for teacher creation', { userId: req.user?.id, errors: error.errors });
      return res.status(400).json({ message: 'Invalid input', errors: error.errors });
    }
    handleError(res, error, 'Failed to create teacher');
  }
};

export const updateTeacher = async (req: AuthRequest, res: Response) => {
  const { id } = req.params;
  try {
    const data = updateTeacherSchema.parse(req.body);

    const teacher = await prisma.teacher.update({
      where: { id },
      data: {
        bloodType: data.bloodType,
        sex: data.sex,
        imageUrl: data.imageUrl,
        birthday: data.birthday ? new Date(data.birthday) : undefined,
        bio: data.bio,
        qualifications: data.qualifications,
      },
    });

    logger.info('Teacher updated', { userId: req.user?.id, teacherId: id });
    res.status(200).json({ message: 'Teacher updated successfully', teacher });
  } catch (error) {
    if (error instanceof z.ZodError) {
      logger.warn('Invalid input for teacher update', { userId: req.user?.id, errors: error.errors });
      return res.status(400).json({ message: 'Invalid input', errors: error.errors });
    }
    handleError(res, error, 'Failed to update teacher');
  }
};

export const deleteTeacher = async (req: AuthRequest, res: Response) => {
  const { id } = req.params;
  try {
    await prisma.teacher.delete({ where: { id } });
    logger.info('Teacher deleted', { userId: req.user?.id, teacherId: id });
    res.status(200).json({ message: 'Teacher deleted successfully' });
  } catch (error) {
    handleError(res, error, 'Failed to delete teacher');
  }
};