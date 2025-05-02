import { Response } from 'express';
import { z } from 'zod';
import { prisma, AuthRequest, handleError, logger } from '../utils/setup';

// Validation Schemas
const createSchoolSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  address: z.string().min(1, 'Address is required'),
  city: z.string().min(1, 'City is required'),
  state: z.string().min(1, 'State is required'),
  country: z.string().min(1, 'Country is required'),
  postalCode: z.string().optional(),
  phone: z.string().optional(),
  email: z.string().email('Invalid email').optional(),
  website: z.string().url('Invalid URL').optional(),
  logoUrl: z.string().url('Invalid URL').optional(),
  adminUserId: z.string().uuid('Invalid user ID').optional(),
});

const updateSchoolSchema = z.object({
  name: z.string().min(1).optional(),
  address: z.string().min(1).optional(),
  city: z.string().min(1).optional(),
  state: z.string().min(1).optional(),
  country: z.string().min(1).optional(),
  postalCode: z.string().optional(),
  phone: z.string().optional(),
  email: z.string().email().optional(),
  website: z.string().url().optional(),
  logoUrl: z.string().url().optional(),
});

export const getSchools = async (req: AuthRequest, res: Response) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 10;
    const skip = (page - 1) * limit;

    // Restrict non-SUPER_ADMIN users to their associated schools
    let where = {};
    if (req.user?.role !== 'SUPER_ADMIN') {
      const userId = req.user?.id;
      if (req.user?.role === 'PRINCIPAL') {
        const principal = await prisma.principal.findUnique({ where: { id: userId } });
        where = { id: principal?.schoolId };
      } else if (req.user?.role === 'TEACHER') {
        const teacher = await prisma.teacher.findUnique({ where: { id: userId } });
        where = { id: teacher?.schoolId };
      } else if (req.user?.role === 'PARENT') {
        const parent = await prisma.parent.findUnique({ where: { id: userId } });
        where = { id: parent?.schoolId };
      }
    }

    const [schools, total] = await Promise.all([
      prisma.school.findMany({
        where,
        skip,
        take: limit,
        select: {
          id: true,
          name: true,
          address: true,
          city: true,
          state: true,
          country: true,
          createdAt: true,
        },
      }),
      prisma.school.count({ where }),
    ]);

    logger.info('Schools retrieved', { userId: req.user?.id, page, limit });
    res.status(200).json({
      message: 'Schools retrieved successfully',
      schools,
      pagination: { page, limit, total, pages: Math.ceil(total / limit) },
    });
  } catch (error) {
    handleError(res, error, 'Failed to retrieve schools');
  }
};

export const getSchoolById = async (req: AuthRequest, res: Response) => {
  const { id } = req.params;
  try {
    // Restrict non-SUPER_ADMIN users to their associated school
    let school;
    if (req.user?.role !== 'SUPER_ADMIN') {
      const userId = req.user?.id;
      let schoolId: string | undefined;
      if (req.user?.role === 'PRINCIPAL') {
        const principal = await prisma.principal.findUnique({ where: { id: userId } });
        schoolId = principal?.schoolId;
      } else if (req.user?.role === 'TEACHER') {
        const teacher = await prisma.teacher.findUnique({ where: { id: userId } });
        schoolId = teacher?.schoolId;
      } else if (req.user?.role === 'PARENT') {
        const parent = await prisma.parent.findUnique({ where: { id: userId } });
        schoolId = parent?.schoolId;
      }
      if (schoolId !== id) {
        logger.warn('Unauthorized school access', { userId, schoolId: id });
        return res.status(403).json({ message: 'Unauthorized to access this school' });
      }
    }

    school = await prisma.school.findUnique({
      where: { id },
      select: {
        id: true,
        name: true,
        address: true,
        city: true,
        state: true,
        country: true,
        createdAt: true,
      },
    });

    if (!school) {
      logger.warn('School not found', { userId: req.user?.id, schoolId: id });
      return res.status(404).json({ message: 'School not found' });
    }

    logger.info('School retrieved', { userId: req.user?.id, schoolId: id });
    res.status(200).json({ message: 'School retrieved successfully', school });
  } catch (error) {
    handleError(res, error, 'Failed to retrieve school');
  }
};

export const createSchool = async (req: AuthRequest, res: Response) => {
  try {
    const data = createSchoolSchema.parse(req.body);

    // Restrict to SUPER_ADMIN
    if (req.user?.role !== 'SUPER_ADMIN') {
      logger.warn('Unauthorized attempt to create school', { userId: req.user?.id });
      return res.status(403).json({ message: 'Only SUPER_ADMIN can create schools' });
    }

    const school = await prisma.$transaction(async (tx) => {
      const newSchool = await tx.school.create({
        data: {
          name: data.name,
          address: data.address,
          city: data.city,
          state: data.state,
          country: data.country,
          postalCode: data.postalCode,
          phone: data.phone,
          email: data.email,
          website: data.website,
          logoUrl: data.logoUrl,
        },
      });

      if (data.adminUserId) {
        const user = await tx.user.findUnique({ where: { id: data.adminUserId } });
        if (!user) throw new Error('User not found');
        if (user.role !== 'SUPER_ADMIN') throw new Error('User must be a SUPER_ADMIN');

        const existingAdmin = await tx.admin.findUnique({ where: { id: data.adminUserId } });
        if (existingAdmin) throw new Error('User is already an admin');

        await tx.admin.create({
          data: {
            id: data.adminUserId,
            schools: { connect: { id: newSchool.id } },
          },
        });

        await tx.school.update({
          where: { id: newSchool.id },
          data: { adminId: data.adminUserId },
        });
      }

      return newSchool;
    }, { timeout: 5000 });

    logger.info('School created', { userId: req.user?.id, schoolId: school.id });
    res.status(201).json({ message: 'School created successfully', school });
  } catch (error) {
    if (error instanceof z.ZodError) {
      logger.warn('Invalid input for school creation', { userId: req.user?.id, errors: error.errors });
      return res.status(400).json({ message: 'Invalid input', errors: error.errors });
    }
    handleError(res, error, 'Failed to create school');
  }
};

export const updateSchool = async (req: AuthRequest, res: Response) => {
  const { id } = req.params;
  try {
    const data = updateSchoolSchema.parse(req.body);

    // Restrict to SUPER_ADMIN
    if (req.user?.role !== 'SUPER_ADMIN') {
      logger.warn('Unauthorized attempt to update school', { userId: req.user?.id, schoolId: id });
      return res.status(403).json({ message: 'Only SUPER_ADMIN can update schools' });
    }

    const school = await prisma.school.update({
      where: { id },
      data: {
        name: data.name,
        address: data.address,
        city: data.city,
        state: data.state,
        country: data.country,
        postalCode: data.postalCode,
        phone: data.phone,
        email: data.email,
        website: data.website,
        logoUrl: data.logoUrl,
        updatedAt: new Date(),
      },
    });

    logger.info('School updated', { userId: req.user?.id, schoolId: id });
    res.status(200).json({ message: 'School updated successfully', school });
  } catch (error) {
    if (error instanceof z.ZodError) {
      logger.warn('Invalid input for school update', { userId: req.user?.id, errors: error.errors });
      return res.status(400).json({ message: 'Invalid input', errors: error.errors });
    }
    handleError(res, error, 'Failed to update school');
  }
};

export const deleteSchool = async (req: AuthRequest, res: Response) => {
  const { id } = req.params;
  try {
    // Restrict to SUPER_ADMIN
    if (req.user?.role !== 'SUPER_ADMIN') {
      logger.warn('Unauthorized attempt to delete school', { userId: req.user?.id, schoolId: id });
      return res.status(403).json({ message: 'Only SUPER_ADMIN can delete schools' });
    }

    await prisma.school.delete({ where: { id } });
    logger.info('School deleted', { userId: req.user?.id, schoolId: id });
    res.status(200).json({ message: 'School deleted successfully' });
  } catch (error) {
    handleError(res, error, 'Failed to delete school');
  }
};