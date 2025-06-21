"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.deleteTeacher = exports.updateTeacher = exports.createTeacher = exports.getTeacherById = exports.getTeachers = void 0;
const zod_1 = require("zod");
const setup_1 = require("../utils/setup");
// Validation Schemas
const createTeacherSchema = zod_1.z.object({
    userId: zod_1.z.string().uuid("Invalid user ID"),
    schoolId: zod_1.z.string().uuid("Invalid school ID"),
    bloodType: zod_1.z.string().optional(),
    sex: zod_1.z.enum(["MALE", "FEMALE", "OTHER"]).optional(),
    profileImageUrl: zod_1.z.string().url().optional(), // Changed from imageUrl to profileImageUrl
    birthday: zod_1.z.string().datetime().optional(),
    bio: zod_1.z.string().optional(),
    qualifications: zod_1.z.string().optional(),
});
const updateTeacherSchema = zod_1.z.object({
    bloodType: zod_1.z.string().optional(),
    sex: zod_1.z.enum(["MALE", "FEMALE", "OTHER"]).optional(),
    profileImageUrl: zod_1.z.string().url().optional(), // Changed from imageUrl to profileImageUrl
    birthday: zod_1.z.string().datetime().optional(),
    bio: zod_1.z.string().optional(),
    qualifications: zod_1.z.string().optional(),
});
const getTeachers = async (req, res) => {
    try {
        const page = Number.parseInt(req.query.page) || 1;
        const limit = Number.parseInt(req.query.limit) || 10;
        const skip = (page - 1) * limit;
        const [teachers, total] = await Promise.all([
            setup_1.prisma.teacher.findMany({
                skip,
                take: limit,
                select: {
                    id: true,
                    user: { select: { email: true, name: true, surname: true, profileImageUrl: true } }, // Include profileImageUrl
                },
            }),
            setup_1.prisma.teacher.count(),
        ]);
        setup_1.logger.info("Teachers retrieved", { userId: req.user?.id, page, limit });
        res.status(200).json({
            message: "Teachers retrieved successfully",
            teachers,
            pagination: { page, limit, total, pages: Math.ceil(total / limit) },
        });
    }
    catch (error) {
        (0, setup_1.handleError)(res, error, "Failed to retrieve teachers");
    }
};
exports.getTeachers = getTeachers;
const getTeacherById = async (req, res) => {
    const { id } = req.params;
    try {
        const teacher = await setup_1.prisma.teacher.findUnique({
            where: { id },
            select: {
                id: true,
                user: { select: { email: true, name: true, surname: true, profileImageUrl: true } }, // Include profileImageUrl
                schoolId: true,
                qualifications: true,
            },
        });
        if (!teacher) {
            setup_1.logger.warn("Teacher not found", { userId: req.user?.id, teacherId: id });
            return res.status(404).json({ message: "Teacher not found" });
        }
        setup_1.logger.info("Teacher retrieved", { userId: req.user?.id, teacherId: id });
        res.status(200).json({ message: "Teacher retrieved successfully", teacher });
    }
    catch (error) {
        (0, setup_1.handleError)(res, error, "Failed to retrieve teacher");
    }
};
exports.getTeacherById = getTeacherById;
const createTeacher = async (req, res) => {
    try {
        const data = createTeacherSchema.parse(req.body);
        // Verify user and school
        const [user, school] = await Promise.all([
            setup_1.prisma.user.findUnique({ where: { id: data.userId } }),
            setup_1.prisma.school.findUnique({ where: { id: data.schoolId } }),
        ]);
        if (!user)
            throw new Error("User not found");
        if (user.role !== "TEACHER")
            throw new Error("User must have TEACHER role");
        if (!school)
            throw new Error("School not found");
        // Check if teacher record already exists
        const existingTeacher = await setup_1.prisma.teacher.findUnique({ where: { id: data.userId } });
        if (existingTeacher)
            throw new Error("Teacher record already exists for this user");
        // Create teacher and update user profileImageUrl in a transaction
        const teacher = await setup_1.prisma.$transaction(async (tx) => {
            const newTeacher = await tx.teacher.create({
                data: {
                    id: data.userId,
                    schoolId: data.schoolId,
                    bloodType: data.bloodType,
                    sex: data.sex,
                    birthday: data.birthday ? new Date(data.birthday) : undefined,
                    bio: data.bio,
                    qualifications: data.qualifications,
                },
            });
            // Update user's profileImageUrl if provided
            if (data.profileImageUrl) {
                await tx.user.update({
                    where: { id: data.userId },
                    data: { profileImageUrl: data.profileImageUrl },
                });
            }
            return newTeacher;
        });
        setup_1.logger.info("Teacher created", { userId: req.user?.id, teacherId: teacher.id });
        res.status(201).json({ message: "Teacher created successfully", teacher });
    }
    catch (error) {
        if (error instanceof zod_1.z.ZodError) {
            setup_1.logger.warn("Invalid input for teacher creation", { userId: req.user?.id, errors: error.errors });
            return res.status(400).json({ message: "Invalid input", errors: error.errors });
        }
        (0, setup_1.handleError)(res, error, "Failed to create teacher");
    }
};
exports.createTeacher = createTeacher;
const updateTeacher = async (req, res) => {
    const { id } = req.params;
    try {
        const data = updateTeacherSchema.parse(req.body);
        // Update teacher and user profileImageUrl in a transaction
        const teacher = await setup_1.prisma.$transaction(async (tx) => {
            const updatedTeacher = await tx.teacher.update({
                where: { id },
                data: {
                    bloodType: data.bloodType,
                    sex: data.sex,
                    birthday: data.birthday ? new Date(data.birthday) : undefined,
                    bio: data.bio,
                    qualifications: data.qualifications,
                },
            });
            // Update user's profileImageUrl if provided
            if (data.profileImageUrl) {
                await tx.user.update({
                    where: { id },
                    data: { profileImageUrl: data.profileImageUrl },
                });
            }
            return updatedTeacher;
        });
        setup_1.logger.info("Teacher updated", { userId: req.user?.id, teacherId: id });
        res.status(200).json({ message: "Teacher updated successfully", teacher });
    }
    catch (error) {
        if (error instanceof zod_1.z.ZodError) {
            setup_1.logger.warn("Invalid input for teacher update", { userId: req.user?.id, errors: error.errors });
            return res.status(400).json({ message: "Invalid input", errors: error.errors });
        }
        (0, setup_1.handleError)(res, error, "Failed to update teacher");
    }
};
exports.updateTeacher = updateTeacher;
const deleteTeacher = async (req, res) => {
    const { id } = req.params;
    try {
        await setup_1.prisma.teacher.delete({ where: { id } });
        setup_1.logger.info("Teacher deleted", { userId: req.user?.id, teacherId: id });
        res.status(200).json({ message: "Teacher deleted successfully" });
    }
    catch (error) {
        (0, setup_1.handleError)(res, error, "Failed to delete teacher");
    }
};
exports.deleteTeacher = deleteTeacher;
