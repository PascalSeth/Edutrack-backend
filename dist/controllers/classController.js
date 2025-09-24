"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.deleteClass = exports.updateClass = exports.createClass = exports.getClassById = exports.getClasses = void 0;
const zod_1 = require("zod");
const setup_1 = require("../utils/setup");
// Validation Schemas
const createClassSchema = zod_1.z.object({
    name: zod_1.z.string().min(1, 'Name is required'),
    capacity: zod_1.z.number().int().min(1, 'Capacity must be a positive integer'),
    schoolId: zod_1.z.string().uuid('Invalid school ID'),
    gradeId: zod_1.z.string().uuid('Invalid grade ID'),
    supervisorId: zod_1.z.string().uuid('Invalid teacher ID').optional(),
});
const updateClassSchema = zod_1.z.object({
    name: zod_1.z.string().min(1).optional(),
    capacity: zod_1.z.number().int().min(1).optional(),
    supervisorId: zod_1.z.string().uuid().optional(),
});
const getClasses = async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 10;
        const skip = (page - 1) * limit;
        let where = {};
        // Apply tenant filtering based on user role
        if (req.user && req.user.role !== "SUPER_ADMIN") {
            where = (0, setup_1.getTenantFilter)(req.user);
        }
        const [classes, total] = await Promise.all([
            setup_1.prisma.class.findMany({
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
            setup_1.prisma.class.count({ where }),
        ]);
        setup_1.logger.info('Classes retrieved', { userId: req.user?.id, userRole: req.user?.role, page, limit });
        res.status(200).json({
            message: 'Classes retrieved successfully',
            classes,
            pagination: { page, limit, total, pages: Math.ceil(total / limit) },
        });
    }
    catch (error) {
        (0, setup_1.handleError)(res, error, 'Failed to retrieve classes');
    }
};
exports.getClasses = getClasses;
const getClassById = async (req, res) => {
    const { id } = req.params;
    try {
        let where = { id };
        // Apply tenant filtering based on user role
        if (req.user && req.user.role !== "SUPER_ADMIN") {
            where = { ...where, ...(0, setup_1.getTenantFilter)(req.user) };
        }
        const classRecord = await setup_1.prisma.class.findFirst({
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
            setup_1.logger.warn('Class not found or access denied', { userId: req.user?.id, userRole: req.user?.role, classId: id });
            return res.status(404).json({ message: 'Class not found' });
        }
        setup_1.logger.info('Class retrieved', { userId: req.user?.id, userRole: req.user?.role, classId: id });
        res.status(200).json({ message: 'Class retrieved successfully', class: classRecord });
    }
    catch (error) {
        (0, setup_1.handleError)(res, error, 'Failed to retrieve class');
    }
};
exports.getClassById = getClassById;
const createClass = async (req, res) => {
    try {
        const data = createClassSchema.parse(req.body);
        // For non-SUPER_ADMIN users, use their assigned school and ignore the provided schoolId
        let schoolId;
        if (req.user && req.user.role !== "SUPER_ADMIN") {
            schoolId = req.user.schoolId;
        }
        else {
            schoolId = data.schoolId;
        }
        // Verify school, grade, and supervisor
        const [school, grade] = await Promise.all([
            setup_1.prisma.school.findUnique({ where: { id: schoolId } }),
            setup_1.prisma.grade.findUnique({ where: { id: data.gradeId } }),
        ]);
        if (!school)
            throw new Error('School not found');
        if (!grade)
            throw new Error('Grade not found');
        // Additional check: ensure grade belongs to the same school
        if (grade.schoolId !== schoolId) {
            throw new Error('Grade does not belong to the specified school');
        }
        if (data.supervisorId) {
            const teacher = await setup_1.prisma.teacher.findUnique({ where: { id: data.supervisorId } });
            if (!teacher)
                throw new Error('Teacher not found');
            // Additional check: ensure teacher belongs to the same school
            if (teacher.schoolId !== schoolId) {
                throw new Error('Teacher does not belong to the specified school');
            }
        }
        const classRecord = await setup_1.prisma.class.create({
            data: {
                name: data.name,
                capacity: data.capacity,
                schoolId: schoolId,
                gradeId: data.gradeId,
                supervisorId: data.supervisorId,
            },
        });
        setup_1.logger.info('Class created', { userId: req.user?.id, userRole: req.user?.role, classId: classRecord.id, schoolId });
        res.status(201).json({ message: 'Class created successfully', class: classRecord });
    }
    catch (error) {
        if (error instanceof zod_1.z.ZodError) {
            setup_1.logger.warn('Invalid input for class creation', { userId: req.user?.id, userRole: req.user?.role, errors: error.errors });
            return res.status(400).json({ message: 'Invalid input', errors: error.errors });
        }
        (0, setup_1.handleError)(res, error, 'Failed to create class');
    }
};
exports.createClass = createClass;
const updateClass = async (req, res) => {
    const { id } = req.params;
    try {
        const data = updateClassSchema.parse(req.body);
        let where = { id };
        // Apply tenant filtering based on user role
        if (req.user && req.user.role !== "SUPER_ADMIN") {
            where = { ...where, ...(0, setup_1.getTenantFilter)(req.user) };
        }
        // Verify supervisor if provided
        if (data.supervisorId) {
            const teacher = await setup_1.prisma.teacher.findUnique({ where: { id: data.supervisorId } });
            if (!teacher)
                throw new Error('Teacher not found');
            // For non-SUPER_ADMIN users, ensure teacher belongs to their school
            if (req.user && req.user.role !== "SUPER_ADMIN" && teacher.schoolId !== req.user.schoolId) {
                throw new Error('Teacher does not belong to your school');
            }
        }
        const classRecord = await setup_1.prisma.class.update({
            where,
            data: {
                name: data.name,
                capacity: data.capacity,
                supervisorId: data.supervisorId,
            },
        });
        setup_1.logger.info('Class updated', { userId: req.user?.id, userRole: req.user?.role, classId: id });
        res.status(200).json({ message: 'Class updated successfully', class: classRecord });
    }
    catch (error) {
        if (error instanceof zod_1.z.ZodError) {
            setup_1.logger.warn('Invalid input for class update', { userId: req.user?.id, userRole: req.user?.role, errors: error.errors });
            return res.status(400).json({ message: 'Invalid input', errors: error.errors });
        }
        (0, setup_1.handleError)(res, error, 'Failed to update class');
    }
};
exports.updateClass = updateClass;
const deleteClass = async (req, res) => {
    const { id } = req.params;
    try {
        let where = { id };
        // Apply tenant filtering based on user role
        if (req.user && req.user.role !== "SUPER_ADMIN") {
            where = { ...where, ...(0, setup_1.getTenantFilter)(req.user) };
        }
        await setup_1.prisma.class.delete({ where });
        setup_1.logger.info('Class deleted', { userId: req.user?.id, userRole: req.user?.role, classId: id });
        res.status(200).json({ message: 'Class deleted successfully' });
    }
    catch (error) {
        (0, setup_1.handleError)(res, error, 'Failed to delete class');
    }
};
exports.deleteClass = deleteClass;
