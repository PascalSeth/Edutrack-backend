// src/controllers/studentController.ts
import { Response } from 'express';
import { z } from 'zod';
import { prisma, AuthRequest, handleError, logger } from '../utils/setup';


// Validation Schemas
const createStudentSchema = z.object({
  registrationNumber: z.string().min(1, 'Registration number is required'),
  name: z.string().min(1, 'Name is required'),
  surname: z.string().min(1, 'Surname is required'),
  address: z.string().optional(),
  imageUrl: z.string().url().optional(),
  bloodType: z.string().optional(),
  sex: z.enum(['MALE', 'FEMALE', 'OTHER']).optional(),
  birthday: z.string().datetime().optional(),
  schoolId: z.string().uuid('Invalid school ID'),
  parentId: z.string().uuid('Invalid parent ID'),
  classId: z.string().uuid('Invalid class ID').optional(),
  gradeId: z.string().uuid('Invalid grade ID').optional(),
});

const updateStudentSchema = z.object({
  registrationNumber: z.string().min(1).optional(),
  name: z.string().min(1).optional(),
  surname: z.string().min(1).optional(),
  address: z.string().optional(),
  imageUrl: z.string().url().optional(),
  bloodType: z.string().optional(),
  sex: z.enum(['MALE', 'FEMALE', 'OTHER']).optional(),
  birthday: z.string().datetime().optional(),
  classId: z.string().uuid().optional(),
  gradeId: z.string().uuid().optional(),
});

export const getStudents = async (req: AuthRequest, res: Response) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 10;
    const skip = (page - 1) * limit;

    const [students, total] = await Promise.all([
      prisma.student.findMany({
        skip,
        take: limit,
        select: {
          id: true,
          registrationNumber: true,
          name: true,
          surname: true,
          schoolId: true,
          parentId: true,
          classId: true,
          gradeId: true,
        },
      }),
      prisma.student.count(),
    ]);

    logger.info('Students retrieved', { userId: req.user?.id, page, limit });
    res.status(200).json({
      message: 'Students retrieved successfully',
      students,
      pagination: { page, limit, total, pages: Math.ceil(total / limit) },
    });
  } catch (error) {
    handleError(res, error, 'Failed to retrieve students');
  }
};

export const getStudentById = async (req: AuthRequest, res: Response) => {
  const { id } = req.params;
  try {
    const student = await prisma.student.findUnique({
      where: { id },
      select: {
        id: true,
        registrationNumber: true,
        name: true,
        surname: true,
        schoolId: true,
        parentId: true,
        classId: true,
        gradeId: true,
      },
    });
    if (!student) {
      logger.warn('Student not found', { userId: req.user?.id, studentId: id });
      return res.status(404).json({ message: 'Student not found' });
    }
    logger.info('Student retrieved', { userId: req.user?.id, studentId: id });
    res.status(200).json({ message: 'Student retrieved successfully', student });
  } catch (error) {
    handleError(res, error, 'Failed to retrieve student');
  }
};

export const createStudent = async (req: AuthRequest, res: Response) => {
  try {
    const data = createStudentSchema.parse(req.body);

    // Verify school and parent exist
    const [school, parent] = await Promise.all([
      prisma.school.findUnique({ where: { id: data.schoolId } }),
      prisma.parent.findUnique({ where: { id: data.parentId } }),
    ]);
    if (!school) throw new Error('School not found');
    if (!parent) throw new Error('Parent not found');

    // Verify class and grade if provided
    if (data.classId) {
      const classRecord = await prisma.class.findUnique({ where: { id: data.classId } });
      if (!classRecord) throw new Error('Class not found');
    }
    if (data.gradeId) {
      const grade = await prisma.grade.findUnique({ where: { id: data.gradeId } });
      if (!grade) throw new Error('Grade not found');
    }

    const student = await prisma.student.create({
      data: {
        registrationNumber: data.registrationNumber,
        name: data.name,
        surname: data.surname,
        address: data.address,
        imageUrl: data.imageUrl,
        bloodType: data.bloodType,
        sex: data.sex,
        birthday: data.birthday ? new Date(data.birthday) : undefined,
        schoolId: data.schoolId,
        parentId: data.parentId,
        classId: data.classId,
        gradeId: data.gradeId,
      },
    });

    logger.info('Student created', { userId: req.user?.id, studentId: student.id });
    res.status(201).json({ message: 'Student created successfully', student });
  } catch (error) {
    if (error instanceof z.ZodError) {
      logger.warn('Invalid input for student creation', { userId: req.user?.id, errors: error.errors });
      return res.status(400).json({ message: 'Invalid input', errors: error.errors });
    }
    handleError(res, error, 'Failed to create student');
  }
};

export const updateStudent = async (req: AuthRequest, res: Response) => {
  const { id } = req.params;
  try {
    const data = updateStudentSchema.parse(req.body);

    // Verify class and grade if provided
    if (data.classId) {
      const classRecord = await prisma.class.findUnique({ where: { id: data.classId } });
      if (!classRecord) throw new Error('Class not found');
    }
    if (data.gradeId) {
      const grade = await prisma.grade.findUnique({ where: { id: data.gradeId } });
      if (!grade) throw new Error('Grade not found');
    }

    const student = await prisma.student.update({
      where: { id },
      data: {
        registrationNumber: data.registrationNumber,
        name: data.name,
        surname: data.surname,
        address: data.address,
        imageUrl: data.imageUrl,
        bloodType: data.bloodType,
        sex: data.sex,
        birthday: data.birthday ? new Date(data.birthday) : undefined,
        classId: data.classId,
        gradeId: data.gradeId,
      },
    });

    logger.info('Student updated', { userId: req.user?.id, studentId: id });
    res.status(200).json({ message: 'Student updated successfully', student });
  } catch (error) {
    if (error instanceof z.ZodError) {
      logger.warn('Invalid input for student update', { userId: req.user?.id, errors: error.errors });
      return res.status(400).json({ message: 'Invalid input', errors: error.errors });
    }
    handleError(res, error, 'Failed to update student');
  }
};

export const deleteStudent = async (req: AuthRequest, res: Response) => {
  const { id } = req.params;
  try {
    await prisma.student.delete({ where: { id } });
    logger.info('Student deleted', { userId: req.user?.id, studentId: id });
    res.status(200).json({ message: 'Student deleted successfully' });
  } catch (error) {
    handleError(res, error, 'Failed to delete student');
  }
};