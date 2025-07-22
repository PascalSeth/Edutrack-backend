"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.deleteTeacher = exports.updateTeacher = exports.createTeacher = exports.getTeacherById = exports.getTeachers = void 0;
const zod_1 = require("zod");
const setup_1 = require("../utils/setup");
// Validation Schemas
const createTeacherSchema = zod_1.z.object({
    schoolId: zod_1.z.string().uuid("Invalid school ID"),
    // Required fields for creating new user
    email: zod_1.z.string().email("Invalid email address"),
    password: zod_1.z.string().min(6, "Password must be at least 6 characters long"),
    name: zod_1.z.string().min(1, "Name is required"),
    surname: zod_1.z.string().min(1, "Surname is required"),
    username: zod_1.z.string().min(3, "Username must be at least 3 characters long"),
    // Optional teacher-specific fields
    bloodType: zod_1.z.string().optional(),
    sex: zod_1.z.enum(["MALE", "FEMALE", "OTHER"]).optional(),
    profileImageUrl: zod_1.z.string().url().optional(),
    birthday: zod_1.z.string().datetime().optional(),
    bio: zod_1.z.string().optional(),
    qualifications: zod_1.z.string().optional(),
});
const updateTeacherSchema = zod_1.z.object({
    bloodType: zod_1.z.string().optional(),
    sex: zod_1.z.enum(["MALE", "FEMALE", "OTHER"]).optional(),
    profileImageUrl: zod_1.z.string().url().optional(),
    birthday: zod_1.z.string().datetime().optional(),
    bio: zod_1.z.string().optional(),
    qualifications: zod_1.z.string().optional(),
});
const getTeachers = async (req, res) => {
    try {
        const page = Number.parseInt(req.query.page) || 1;
        const limit = Number.parseInt(req.query.limit) || 10;
        const skip = (page - 1) * limit;
        let where = {};
        // Apply tenant filtering based on user role
        if (req.user?.role === "SUPER_ADMIN") {
            // Super admin sees all teachers
            where = {};
        }
        else if (req.user?.role === "TEACHER") {
            // Teachers can only see their own record
            where = { id: req.user.id };
        }
        else if (req.user?.role === "PRINCIPAL" || req.user?.role === "SCHOOL_ADMIN") {
            // School admins and principals see teachers in their school
            where = (0, setup_1.getTenantFilter)(req.user);
        }
        else if (req.user?.role === "PARENT") {
            // Parents see teachers who teach their children
            const schoolIds = await (0, setup_1.getParentSchoolIds)(req.user.id);
            where = {
                schoolId: { in: schoolIds },
                OR: [
                    {
                        supervisedClasses: {
                            some: {
                                students: {
                                    some: { parentId: req.user.id },
                                },
                            },
                        },
                    },
                    {
                        lessons: {
                            some: {
                                class: {
                                    students: {
                                        some: { parentId: req.user.id },
                                    },
                                },
                            },
                        },
                    },
                ],
            };
        }
        const [teachers, total] = await Promise.all([
            setup_1.prisma.teacher.findMany({
                where,
                skip,
                take: limit,
                include: {
                    user: {
                        select: {
                            id: true,
                            email: true,
                            name: true,
                            surname: true,
                            username: true,
                            profileImageUrl: true,
                        },
                    },
                    school: {
                        select: {
                            id: true,
                            name: true,
                        },
                    },
                    subjects: {
                        select: {
                            id: true,
                            name: true,
                        },
                    },
                    supervisedClasses: {
                        select: {
                            id: true,
                            name: true,
                        },
                    },
                    approval: {
                        select: {
                            status: true,
                        },
                    },
                    _count: {
                        select: {
                            subjects: true,
                            supervisedClasses: true,
                            lessons: true,
                        },
                    },
                },
                orderBy: { user: { name: "asc" } },
            }),
            setup_1.prisma.teacher.count({ where }),
        ]);
        setup_1.logger.info("Teachers retrieved", {
            userId: req.user?.id,
            userRole: req.user?.role,
            page,
            limit,
            total,
        });
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
            include: {
                user: {
                    select: {
                        id: true,
                        email: true,
                        name: true,
                        surname: true,
                        username: true,
                        profileImageUrl: true,
                    },
                },
                school: {
                    select: {
                        id: true,
                        name: true,
                    },
                },
                subjects: {
                    select: {
                        id: true,
                        name: true,
                    },
                },
                supervisedClasses: {
                    select: {
                        id: true,
                        name: true,
                    },
                },
                approval: {
                    select: {
                        status: true,
                    },
                },
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
        const { email, password, name, surname, username, schoolId, profileImageUrl, ...teacherDetails } = data;
        // Verify school exists
        const school = await setup_1.prisma.school.findUnique({ where: { id: schoolId } });
        if (!school) {
            throw new Error("School not found");
        }
        // Create teacher and user in a transaction
        const teacher = await setup_1.prisma.$transaction(async (tx) => {
            // Check if user with this email already exists
            const existingUserByEmail = await tx.user.findUnique({ where: { email } });
            if (existingUserByEmail) {
                throw new Error("User with this email already exists");
            }
            // Check if user with this username already exists
            const existingUserByUsername = await tx.user.findUnique({ where: { username } });
            if (existingUserByUsername) {
                throw new Error("User with this username already exists");
            }
            // Create new user with TEACHER role
            const hashedPassword = await (0, setup_1.hashPassword)(password);
            const newUser = await tx.user.create({
                data: {
                    email,
                    passwordHash: hashedPassword,
                    name,
                    surname,
                    username,
                    role: "TEACHER",
                    profileImageUrl: profileImageUrl || null,
                },
            });
            // Create teacher record
            const newTeacher = await tx.teacher.create({
                data: {
                    id: newUser.id,
                    schoolId: schoolId,
                    bloodType: teacherDetails.bloodType,
                    sex: teacherDetails.sex,
                    birthday: teacherDetails.birthday ? new Date(teacherDetails.birthday) : undefined,
                    bio: teacherDetails.bio,
                    qualifications: teacherDetails.qualifications,
                },
                include: {
                    user: {
                        select: {
                            id: true,
                            email: true,
                            name: true,
                            surname: true,
                            username: true,
                            profileImageUrl: true,
                        },
                    },
                    school: {
                        select: {
                            id: true,
                            name: true,
                        },
                    },
                },
            });
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
                include: {
                    user: {
                        select: {
                            id: true,
                            email: true,
                            name: true,
                            surname: true,
                            username: true,
                            profileImageUrl: true,
                        },
                    },
                    school: {
                        select: {
                            id: true,
                            name: true,
                        },
                    },
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
        // Delete teacher record (this will also handle cascading deletes based on schema)
        await setup_1.prisma.teacher.delete({ where: { id } });
        setup_1.logger.info("Teacher deleted", { userId: req.user?.id, teacherId: id });
        res.status(200).json({ message: "Teacher deleted successfully" });
    }
    catch (error) {
        (0, setup_1.handleError)(res, error, "Failed to delete teacher");
    }
};
exports.deleteTeacher = deleteTeacher;
