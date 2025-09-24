"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.removeTeacherFromSubject = exports.assignTeacherToSubject = exports.deleteSubject = exports.updateSubject = exports.createSubject = exports.getSubjectById = exports.getSubjects = void 0;
const zod_1 = require("zod");
const setup_1 = require("../utils/setup");
// Validation Schemas
const createSubjectSchema = zod_1.z.object({
    name: zod_1.z.string().min(1, "Name is required"),
    code: zod_1.z.string().optional(),
    description: zod_1.z.string().optional(),
    schoolId: zod_1.z.string().uuid("Invalid school ID"),
});
const updateSubjectSchema = zod_1.z.object({
    name: zod_1.z.string().min(1).optional(),
    code: zod_1.z.string().optional(),
    description: zod_1.z.string().optional(),
});
const getSubjects = async (req, res) => {
    try {
        const page = Number.parseInt(req.query.page) || 1;
        const limit = Number.parseInt(req.query.limit) || 10;
        const skip = (page - 1) * limit;
        const filter = (0, setup_1.getTenantFilter)(req.user);
        const [subjects, total] = await Promise.all([
            setup_1.prisma.subject.findMany({
                where: filter,
                skip,
                take: limit,
                include: {
                    teachers: {
                        include: {
                            user: { select: { name: true, surname: true } },
                        },
                    },
                    _count: {
                        select: {
                            lessons: true,
                            assignments: true,
                            examQuestions: true,
                        },
                    },
                },
                orderBy: { name: "asc" },
            }),
            setup_1.prisma.subject.count({ where: filter }),
        ]);
        setup_1.logger.info("Subjects retrieved", { userId: req.user?.id, page, limit, total });
        res.status(200).json({
            message: "Subjects retrieved successfully",
            subjects,
            pagination: { page, limit, total, pages: Math.ceil(total / limit) },
        });
    }
    catch (error) {
        (0, setup_1.handleError)(res, error, "Failed to retrieve subjects");
    }
};
exports.getSubjects = getSubjects;
const getSubjectById = async (req, res) => {
    const { id } = req.params;
    try {
        const filter = (0, setup_1.getTenantFilter)(req.user);
        const subject = await setup_1.prisma.subject.findFirst({
            where: { id, ...filter },
            include: {
                teachers: {
                    include: {
                        user: { select: { name: true, surname: true, email: true } },
                    },
                },
                lessons: {
                    include: {
                        class: { select: { name: true } },
                        teacher: {
                            include: {
                                user: { select: { name: true, surname: true } },
                            },
                        },
                    },
                },
                assignments: {
                    select: {
                        id: true,
                        title: true,
                        dueDate: true,
                        class: { select: { name: true } },
                    },
                    orderBy: { dueDate: "desc" },
                    take: 5,
                },
                _count: {
                    select: {
                        lessons: true,
                        assignments: true,
                        examQuestions: true,
                    },
                },
            },
        });
        if (!subject) {
            setup_1.logger.warn("Subject not found", { userId: req.user?.id, subjectId: id });
            return res.status(404).json({ message: "Subject not found" });
        }
        setup_1.logger.info("Subject retrieved", { userId: req.user?.id, subjectId: id });
        res.status(200).json({
            message: "Subject retrieved successfully",
            subject,
        });
    }
    catch (error) {
        (0, setup_1.handleError)(res, error, "Failed to retrieve subject");
    }
};
exports.getSubjectById = getSubjectById;
const createSubject = async (req, res) => {
    try {
        const data = createSubjectSchema.parse(req.body);
        // Only principals and school admins can create subjects
        if (!["PRINCIPAL", "SCHOOL_ADMIN", "SUPER_ADMIN"].includes(req.user?.role || "")) {
            return res.status(403).json({ message: "Access denied" });
        }
        // For non-SUPER_ADMIN users, use their assigned school and ignore the provided schoolId
        let schoolId;
        if (req.user && req.user.role !== "SUPER_ADMIN") {
            schoolId = req.user.schoolId;
        }
        else {
            schoolId = data.schoolId;
        }
        // Verify school exists
        const school = await setup_1.prisma.school.findUnique({ where: { id: schoolId } });
        if (!school) {
            return res.status(404).json({ message: "School not found" });
        }
        // Check if subject with same name already exists in school
        const existingSubject = await setup_1.prisma.subject.findFirst({
            where: {
                name: data.name,
                schoolId: schoolId,
            },
        });
        if (existingSubject) {
            return res.status(409).json({ message: "Subject with this name already exists in the school" });
        }
        const subject = await setup_1.prisma.subject.create({
            data: {
                name: data.name,
                code: data.code,
                description: data.description,
                schoolId: schoolId,
            },
        });
        setup_1.logger.info("Subject created", {
            userId: req.user?.id,
            userRole: req.user?.role,
            subjectId: subject.id,
            schoolId: schoolId,
        });
        res.status(201).json({
            message: "Subject created successfully",
            subject,
        });
    }
    catch (error) {
        if (error instanceof zod_1.z.ZodError) {
            return res.status(400).json({ message: "Invalid input", errors: error.errors });
        }
        (0, setup_1.handleError)(res, error, "Failed to create subject");
    }
};
exports.createSubject = createSubject;
const updateSubject = async (req, res) => {
    const { id } = req.params;
    try {
        const data = updateSubjectSchema.parse(req.body);
        // Only principals and school admins can update subjects
        if (!["PRINCIPAL", "SCHOOL_ADMIN", "SUPER_ADMIN"].includes(req.user?.role || "")) {
            return res.status(403).json({ message: "Access denied" });
        }
        const filter = (0, setup_1.getTenantFilter)(req.user);
        const existingSubject = await setup_1.prisma.subject.findFirst({
            where: { id, ...filter },
        });
        if (!existingSubject) {
            return res.status(404).json({ message: "Subject not found or access denied" });
        }
        // Check for name conflicts if name is being updated
        if (data.name && data.name !== existingSubject.name) {
            const conflictingSubject = await setup_1.prisma.subject.findFirst({
                where: {
                    name: data.name,
                    schoolId: existingSubject.schoolId,
                    id: { not: id },
                },
            });
            if (conflictingSubject) {
                return res.status(409).json({ message: "Subject with this name already exists in the school" });
            }
        }
        const subject = await setup_1.prisma.subject.update({
            where: { id },
            data: {
                ...(data.name && { name: data.name }),
                ...(data.code !== undefined && { code: data.code }),
                ...(data.description !== undefined && { description: data.description }),
            },
        });
        setup_1.logger.info("Subject updated", { userId: req.user?.id, subjectId: id });
        res.status(200).json({
            message: "Subject updated successfully",
            subject,
        });
    }
    catch (error) {
        if (error instanceof zod_1.z.ZodError) {
            return res.status(400).json({ message: "Invalid input", errors: error.errors });
        }
        (0, setup_1.handleError)(res, error, "Failed to update subject");
    }
};
exports.updateSubject = updateSubject;
const deleteSubject = async (req, res) => {
    const { id } = req.params;
    try {
        // Only principals and school admins can delete subjects
        if (!["PRINCIPAL", "SCHOOL_ADMIN", "SUPER_ADMIN"].includes(req.user?.role || "")) {
            return res.status(403).json({ message: "Access denied" });
        }
        const filter = (0, setup_1.getTenantFilter)(req.user);
        const subject = await setup_1.prisma.subject.findFirst({
            where: { id, ...filter },
            include: {
                _count: {
                    select: {
                        lessons: true,
                        assignments: true,
                        examQuestions: true,
                    },
                },
            },
        });
        if (!subject) {
            return res.status(404).json({ message: "Subject not found or access denied" });
        }
        // Check if subject has associated data
        const hasAssociatedData = subject._count.lessons > 0 || subject._count.assignments > 0 || subject._count.examQuestions > 0;
        if (hasAssociatedData) {
            return res.status(400).json({
                message: "Cannot delete subject with associated lessons, assignments, or exam questions",
            });
        }
        await setup_1.prisma.subject.delete({ where: { id } });
        setup_1.logger.info("Subject deleted", { userId: req.user?.id, subjectId: id });
        res.status(200).json({ message: "Subject deleted successfully" });
    }
    catch (error) {
        (0, setup_1.handleError)(res, error, "Failed to delete subject");
    }
};
exports.deleteSubject = deleteSubject;
const assignTeacherToSubject = async (req, res) => {
    const { id } = req.params;
    const { teacherId } = req.body;
    try {
        // Only principals and school admins can assign teachers
        if (!["PRINCIPAL", "SCHOOL_ADMIN", "SUPER_ADMIN"].includes(req.user?.role || "")) {
            return res.status(403).json({ message: "Access denied" });
        }
        if (!teacherId) {
            return res.status(400).json({ message: "Teacher ID is required" });
        }
        const filter = (0, setup_1.getTenantFilter)(req.user);
        // Verify subject and teacher exist and belong to same school
        const [subject, teacher] = await Promise.all([
            setup_1.prisma.subject.findFirst({
                where: { id, ...filter },
            }),
            setup_1.prisma.teacher.findFirst({
                where: {
                    id: teacherId,
                    ...filter,
                },
            }),
        ]);
        if (!subject) {
            return res.status(404).json({ message: "Subject not found or access denied" });
        }
        if (!teacher) {
            return res.status(404).json({ message: "Teacher not found or access denied" });
        }
        // Check if teacher is already assigned to this subject
        const existingAssignment = await setup_1.prisma.subject.findFirst({
            where: {
                id,
                teachers: {
                    some: { id: teacherId },
                },
            },
        });
        if (existingAssignment) {
            return res.status(409).json({ message: "Teacher is already assigned to this subject" });
        }
        // Assign teacher to subject
        await setup_1.prisma.subject.update({
            where: { id },
            data: {
                teachers: {
                    connect: { id: teacherId },
                },
            },
        });
        setup_1.logger.info("Teacher assigned to subject", {
            userId: req.user?.id,
            subjectId: id,
            teacherId: teacherId,
        });
        res.status(200).json({
            message: "Teacher assigned to subject successfully",
        });
    }
    catch (error) {
        (0, setup_1.handleError)(res, error, "Failed to assign teacher to subject");
    }
};
exports.assignTeacherToSubject = assignTeacherToSubject;
const removeTeacherFromSubject = async (req, res) => {
    const { id } = req.params;
    const { teacherId } = req.body;
    try {
        // Only principals and school admins can remove teachers
        if (!["PRINCIPAL", "SCHOOL_ADMIN", "SUPER_ADMIN"].includes(req.user?.role || "")) {
            return res.status(403).json({ message: "Access denied" });
        }
        if (!teacherId) {
            return res.status(400).json({ message: "Teacher ID is required" });
        }
        const filter = (0, setup_1.getTenantFilter)(req.user);
        const subject = await setup_1.prisma.subject.findFirst({
            where: { id, ...filter },
        });
        if (!subject) {
            return res.status(404).json({ message: "Subject not found or access denied" });
        }
        // Remove teacher from subject
        await setup_1.prisma.subject.update({
            where: { id },
            data: {
                teachers: {
                    disconnect: { id: teacherId },
                },
            },
        });
        setup_1.logger.info("Teacher removed from subject", {
            userId: req.user?.id,
            subjectId: id,
            teacherId: teacherId,
        });
        res.status(200).json({
            message: "Teacher removed from subject successfully",
        });
    }
    catch (error) {
        (0, setup_1.handleError)(res, error, "Failed to remove teacher from subject");
    }
};
exports.removeTeacherFromSubject = removeTeacherFromSubject;
