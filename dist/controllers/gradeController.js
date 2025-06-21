"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.deleteGrade = exports.updateGrade = exports.createGrade = exports.getGradeById = exports.getGrades = void 0;
const zod_1 = require("zod");
const setup_1 = require("../utils/setup");
// Validation Schemas
const createGradeSchema = zod_1.z.object({
    name: zod_1.z.string().min(1, 'Name is required'),
    level: zod_1.z.number().int().min(1, 'Level must be a positive integer'),
    schoolId: zod_1.z.string().uuid('Invalid school ID'),
});
const updateGradeSchema = zod_1.z.object({
    name: zod_1.z.string().min(1).optional(),
    level: zod_1.z.number().int().min(1).optional(),
});
const getGrades = async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 10;
        const skip = (page - 1) * limit;
        const [grades, total] = await Promise.all([
            setup_1.prisma.grade.findMany({
                skip,
                take: limit,
                select: {
                    id: true,
                    name: true,
                    level: true,
                    schoolId: true,
                },
            }),
            setup_1.prisma.grade.count(),
        ]);
        setup_1.logger.info('Grades retrieved', { userId: req.user?.id, page, limit });
        res.status(200).json({
            message: 'Grades retrieved successfully',
            grades,
            pagination: { page, limit, total, pages: Math.ceil(total / limit) },
        });
    }
    catch (error) {
        (0, setup_1.handleError)(res, error, 'Failed to retrieve grades');
    }
};
exports.getGrades = getGrades;
const getGradeById = async (req, res) => {
    const { id } = req.params;
    try {
        const grade = await setup_1.prisma.grade.findUnique({
            where: { id },
            select: {
                id: true,
                name: true,
                level: true,
                schoolId: true,
            },
        });
        if (!grade) {
            setup_1.logger.warn('Grade not found', { userId: req.user?.id, gradeId: id });
            return res.status(404).json({ message: 'Grade not found' });
        }
        setup_1.logger.info('Grade retrieved', { userId: req.user?.id, gradeId: id });
        res.status(200).json({ message: 'Grade retrieved successfully', grade });
    }
    catch (error) {
        (0, setup_1.handleError)(res, error, 'Failed to retrieve grade');
    }
};
exports.getGradeById = getGradeById;
const createGrade = async (req, res) => {
    try {
        const data = createGradeSchema.parse(req.body);
        // Verify school
        const school = await setup_1.prisma.school.findUnique({ where: { id: data.schoolId } });
        if (!school)
            throw new Error('School not found');
        const grade = await setup_1.prisma.grade.create({
            data: {
                name: data.name,
                level: data.level,
                schoolId: data.schoolId,
            },
        });
        setup_1.logger.info('Grade created', { userId: req.user?.id, gradeId: grade.id });
        res.status(201).json({ message: 'Grade created successfully', grade });
    }
    catch (error) {
        if (error instanceof zod_1.z.ZodError) {
            setup_1.logger.warn('Invalid input for grade creation', { userId: req.user?.id, errors: error.errors });
            return res.status(400).json({ message: 'Invalid input', errors: error.errors });
        }
        (0, setup_1.handleError)(res, error, 'Failed to create grade');
    }
};
exports.createGrade = createGrade;
const updateGrade = async (req, res) => {
    const { id } = req.params;
    try {
        const data = updateGradeSchema.parse(req.body);
        const grade = await setup_1.prisma.grade.update({
            where: { id },
            data: {
                name: data.name,
                level: data.level,
            },
        });
        setup_1.logger.info('Grade updated', { userId: req.user?.id, gradeId: id });
        res.status(200).json({ message: 'Grade updated successfully', grade });
    }
    catch (error) {
        if (error instanceof zod_1.z.ZodError) {
            setup_1.logger.warn('Invalid input for grade update', { userId: req.user?.id, errors: error.errors });
            return res.status(400).json({ message: 'Invalid input', errors: error.errors });
        }
        (0, setup_1.handleError)(res, error, 'Failed to update grade');
    }
};
exports.updateGrade = updateGrade;
const deleteGrade = async (req, res) => {
    const { id } = req.params;
    try {
        await setup_1.prisma.grade.delete({ where: { id } });
        setup_1.logger.info('Grade deleted', { userId: req.user?.id, gradeId: id });
        res.status(200).json({ message: 'Grade deleted successfully' });
    }
    catch (error) {
        (0, setup_1.handleError)(res, error, 'Failed to delete grade');
    }
};
exports.deleteGrade = deleteGrade;
