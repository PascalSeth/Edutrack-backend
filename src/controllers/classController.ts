// src/controllers/classController.ts
import { Response } from 'express';
import { z } from 'zod';
import { prisma, AuthRequest, handleError, logger, getTenantFilter } from '../utils/setup';

// Validation Schemas
const createClassSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  capacity: z.number().int().min(1, 'Capacity must be a positive integer'),
  schoolId: z.string().uuid('Invalid school ID'),
  gradeId: z.string().uuid('Invalid grade ID'),
  supervisorId: z.string().uuid('Invalid teacher ID').optional(),
});

const updateClassSchema = z.object({
  name: z.string().min(1).optional(),
  capacity: z.number().int().min(1).optional(),
  supervisorId: z.string().uuid().optional(),
});

export const getClasses = async (req: AuthRequest, res: Response) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 10;
    const skip = (page - 1) * limit;

    let where: any = {};

    // Apply tenant filtering based on user role
    if (req.user && req.user.role !== "SUPER_ADMIN") {
      where = getTenantFilter(req.user);
    }

    const [classes, total] = await Promise.all([
      prisma.class.findMany({
        where,
        skip,
        take: limit,
        select: {
          id: true,
          name: true,
          capacity: true,
          schoolId: true,
          gradeId: true,
          supervisorId: true,

        },
      }),
      prisma.class.count({ where }),
    ]);

    logger.info('Classes retrieved', { userId: req.user?.id, userRole: req.user?.role, page, limit });
    res.status(200).json({
      message: 'Classes retrieved successfully',
      classes,
      pagination: { page, limit, total, pages: Math.ceil(total / limit) },
    });
  } catch (error) {
    handleError(res, error, 'Failed to retrieve classes');
  }
};

export const getClassById = async (req: AuthRequest, res: Response) => {
  const { id } = req.params;
  try {
    let where: any = { id };

    // Apply tenant filtering based on user role
    if (req.user && req.user.role !== "SUPER_ADMIN") {
      where = { ...where, ...getTenantFilter(req.user) };
    }

    const classRecord = await prisma.class.findFirst({
      where,
      select: {
        id: true,
        name: true,
        capacity: true,
        schoolId: true,
        gradeId: true,
        supervisorId: true,

      },
    });
    if (!classRecord) {
      logger.warn('Class not found or access denied', { userId: req.user?.id, userRole: req.user?.role, classId: id });
      return res.status(404).json({ message: 'Class not found' });
    }
    logger.info('Class retrieved', { userId: req.user?.id, userRole: req.user?.role, classId: id });
    res.status(200).json({ message: 'Class retrieved successfully', class: classRecord });
  } catch (error) {
    handleError(res, error, 'Failed to retrieve class');
  }
};

export const createClass = async (req: AuthRequest, res: Response) => {
  try {
    const data = createClassSchema.parse(req.body);

    // For non-SUPER_ADMIN users, use their assigned school and ignore the provided schoolId
    let schoolId: string;
    if (req.user && req.user.role !== "SUPER_ADMIN") {
      schoolId = req.user.schoolId!;
    } else {
      schoolId = data.schoolId;
    }

    // Verify school, grade, and supervisor
    const [school, grade] = await Promise.all([
      prisma.school.findUnique({ where: { id: schoolId } }),
      prisma.grade.findUnique({ where: { id: data.gradeId } }),
    ]);
    if (!school) throw new Error('School not found');
    if (!grade) throw new Error('Grade not found');

    // Additional check: ensure grade belongs to the same school
    if (grade.schoolId !== schoolId) {
      throw new Error('Grade does not belong to the specified school');
    }

    if (data.supervisorId) {
      const teacher = await prisma.teacher.findUnique({ where: { id: data.supervisorId } });
      if (!teacher) throw new Error('Teacher not found');
      // Additional check: ensure teacher belongs to the same school
      if (teacher.schoolId !== schoolId) {
        throw new Error('Teacher does not belong to the specified school');
      }
    }

    const classRecord = await prisma.class.create({
      data: {
        name: data.name,
        capacity: data.capacity,
        schoolId: schoolId,
        gradeId: data.gradeId,
        supervisorId: data.supervisorId,
      },
    });

    logger.info('Class created', { userId: req.user?.id, userRole: req.user?.role, classId: classRecord.id, schoolId });
    res.status(201).json({ message: 'Class created successfully', class: classRecord });
  } catch (error) {
    if (error instanceof z.ZodError) {
      logger.warn('Invalid input for class creation', { userId: req.user?.id, userRole: req.user?.role, errors: error.errors });
      return res.status(400).json({ message: 'Invalid input', errors: error.errors });
    }
    handleError(res, error, 'Failed to create class');
  }
};

export const updateClass = async (req: AuthRequest, res: Response) => {
  const { id } = req.params;
  try {
    const data = updateClassSchema.parse(req.body);

    let where: any = { id };

    // Apply tenant filtering based on user role
    if (req.user && req.user.role !== "SUPER_ADMIN") {
      where = { ...where, ...getTenantFilter(req.user) };
    }

    // Verify supervisor if provided
    if (data.supervisorId) {
      const teacher = await prisma.teacher.findUnique({ where: { id: data.supervisorId } });
      if (!teacher) throw new Error('Teacher not found');
      // For non-SUPER_ADMIN users, ensure teacher belongs to their school
      if (req.user && req.user.role !== "SUPER_ADMIN" && teacher.schoolId !== req.user.schoolId) {
        throw new Error('Teacher does not belong to your school');
      }
    }

    const classRecord = await prisma.class.update({
      where,
      data: {
        name: data.name,
        capacity: data.capacity,
        supervisorId: data.supervisorId,
      },
    });

    logger.info('Class updated', { userId: req.user?.id, userRole: req.user?.role, classId: id });
    res.status(200).json({ message: 'Class updated successfully', class: classRecord });
  } catch (error) {
    if (error instanceof z.ZodError) {
      logger.warn('Invalid input for class update', { userId: req.user?.id, userRole: req.user?.role, errors: error.errors });
      return res.status(400).json({ message: 'Invalid input', errors: error.errors });
    }
    handleError(res, error, 'Failed to update class');
  }
};

export const deleteClass = async (req: AuthRequest, res: Response) => {
  const { id } = req.params;
  try {
    let where: any = { id };

    // Apply tenant filtering based on user role
    if (req.user && req.user.role !== "SUPER_ADMIN") {
      where = { ...where, ...getTenantFilter(req.user) };
    }

    await prisma.class.delete({ where });
    logger.info('Class deleted', { userId: req.user?.id, userRole: req.user?.role, classId: id });
    res.status(200).json({ message: 'Class deleted successfully' });
  } catch (error) {
    handleError(res, error, 'Failed to delete class');
  }
};
