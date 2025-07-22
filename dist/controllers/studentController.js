"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getStudentsBySchool = exports.deleteStudent = exports.updateStudent = exports.createStudent = exports.getStudentById = exports.getStudents = void 0;
const zod_1 = require("zod");
const setup_1 = require("../utils/setup");
const bcrypt_1 = __importDefault(require("bcrypt"));
// Validation Schemas
const createStudentSchema = zod_1.z
    .object({
    // Student details
    registrationNumber: zod_1.z.string().min(1, "Registration number is required"),
    name: zod_1.z.string().min(1, "Name is required"),
    surname: zod_1.z.string().min(1, "Surname is required"),
    address: zod_1.z.string().optional(),
    imageUrl: zod_1.z.string().url().optional(),
    bloodType: zod_1.z.string().optional(),
    sex: zod_1.z.enum(["MALE", "FEMALE", "OTHER"]).optional(),
    birthday: zod_1.z.string().datetime().optional(),
    schoolId: zod_1.z.string().uuid("Invalid school ID"),
    classId: zod_1.z.string().uuid("Invalid class ID").optional(),
    gradeId: zod_1.z.string().uuid("Invalid grade ID").optional(),
    // Parent details (optional - if not provided, parentId must be provided)
    parentDetails: zod_1.z
        .object({
        email: zod_1.z.string().email("Invalid email"),
        username: zod_1.z.string().min(3, "Username must be at least 3 characters"),
        password: zod_1.z.string().min(8, "Password must be at least 8 characters"),
        name: zod_1.z.string().min(1, "Parent name is required"),
        surname: zod_1.z.string().min(1, "Parent surname is required"),
        phone: zod_1.z.string().optional(),
        address: zod_1.z.string().optional(),
    })
        .optional(),
    // Alternative: existing parent ID
    parentId: zod_1.z.string().uuid("Invalid parent ID").optional(),
})
    .refine((data) => {
    // Either parentDetails or parentId must be provided, but not both
    const hasParentDetails = data.parentDetails !== undefined;
    const hasParentId = data.parentId !== undefined;
    return (hasParentDetails && !hasParentId) || (!hasParentDetails && hasParentId);
}, {
    message: "Either parent details or existing parent ID must be provided, but not both",
    path: ["parentDetails"],
});
const updateStudentSchema = zod_1.z.object({
    registrationNumber: zod_1.z.string().min(1).optional(),
    name: zod_1.z.string().min(1).optional(),
    surname: zod_1.z.string().min(1).optional(),
    address: zod_1.z.string().optional(),
    imageUrl: zod_1.z.string().url().optional(),
    bloodType: zod_1.z.string().optional(),
    sex: zod_1.z.enum(["MALE", "FEMALE", "OTHER"]).optional(),
    birthday: zod_1.z.string().datetime().optional(),
    classId: zod_1.z.string().uuid().optional(),
    gradeId: zod_1.z.string().uuid().optional(),
    verificationStatus: zod_1.z.enum(["PENDING", "VERIFIED", "REJECTED"]).optional(),
});
const getStudents = async (req, res) => {
    try {
        const page = Number.parseInt(req.query.page) || 1;
        const limit = Number.parseInt(req.query.limit) || 10;
        const skip = (page - 1) * limit;
        let where = {};
        // Apply tenant filtering based on user role
        if (req.user?.role === "SUPER_ADMIN") {
            // Super admin sees all students
            where = {};
        }
        else if (req.user?.role === "PARENT") {
            // Parents see only their own children
            where = { parentId: req.user.id };
        }
        else if (req.user?.role === "TEACHER") {
            // Teachers see students in their classes or lessons
            where = getTeacherStudentFilter(req.user.id, req.user?.schoolId);
        }
        else if (req.user?.role === "PRINCIPAL" || req.user?.role === "SCHOOL_ADMIN") {
            // School admins and principals see students in their school
            where = (0, setup_1.getTenantFilter)(req.user);
        }
        const [students, total] = await Promise.all([
            setup_1.prisma.student.findMany({
                where,
                skip,
                take: limit,
                include: {
                    school: {
                        select: {
                            id: true,
                            name: true,
                            city: true,
                        },
                    },
                    parent: {
                        include: {
                            user: {
                                select: {
                                    name: true,
                                    surname: true,
                                    email: true,
                                    phone: true,
                                },
                            },
                        },
                    },
                    class: {
                        select: {
                            id: true,
                            name: true,
                            grade: { select: { name: true, level: true } },
                        },
                    },
                    grade: {
                        select: {
                            name: true,
                            level: true,
                        },
                    },
                    _count: {
                        select: {
                            attendances: true,
                            results: true,
                            assignmentSubmissions: true,
                        },
                    },
                },
                orderBy: [{ school: { name: "asc" } }, { name: "asc" }],
            }),
            setup_1.prisma.student.count({ where }),
        ]);
        setup_1.logger.info("Students retrieved", {
            userId: req.user?.id,
            userRole: req.user?.role,
            page,
            limit,
            total,
        });
        res.status(200).json({
            message: "Students retrieved successfully",
            students,
            pagination: { page, limit, total, pages: Math.ceil(total / limit) },
        });
    }
    catch (error) {
        (0, setup_1.handleError)(res, error, "Failed to retrieve students");
    }
};
exports.getStudents = getStudents;
const getStudentById = async (req, res) => {
    const { id } = req.params;
    try {
        let where = { id };
        // Apply access control based on user role
        if (req.user?.role === "PARENT") {
            where = { id, parentId: req.user.id };
        }
        else if (req.user?.role === "TEACHER") {
            where = {
                id,
                OR: [
                    {
                        class: { supervisorId: req.user.id },
                    },
                    {
                        class: {
                            lessons: {
                                some: { teacherId: req.user.id },
                            },
                        },
                    },
                ],
            };
        }
        else if (req.user?.role === "PRINCIPAL" || req.user?.role === "SCHOOL_ADMIN") {
            where = { id, ...(0, setup_1.getTenantFilter)(req.user) };
        }
        const student = await setup_1.prisma.student.findFirst({
            where,
            include: {
                school: {
                    select: {
                        id: true,
                        name: true,
                        address: true,
                        city: true,
                        logoUrl: true,
                    },
                },
                parent: {
                    include: {
                        user: {
                            select: {
                                id: true,
                                name: true,
                                surname: true,
                                email: true,
                                phone: true,
                                address: true,
                            },
                        },
                    },
                },
                class: {
                    include: {
                        grade: { select: { name: true, level: true } },
                        supervisor: {
                            include: {
                                user: { select: { name: true, surname: true } },
                            },
                        },
                        _count: { select: { students: true } },
                    },
                },
                grade: {
                    select: {
                        name: true,
                        level: true,
                    },
                },
                attendances: {
                    orderBy: { date: "desc" },
                    take: 10,
                    include: {
                        lesson: {
                            include: {
                                subject: { select: { name: true } },
                            },
                        },
                    },
                },
                results: {
                    orderBy: { uploadedAt: "desc" },
                    take: 10,
                    include: {
                        assignment: {
                            select: {
                                title: true,
                                subject: { select: { name: true } },
                            },
                        },
                        exam: {
                            select: {
                                title: true,
                                examQuestions: {
                                    select: {
                                        subject: { select: { name: true } },
                                    },
                                },
                            },
                        },
                    },
                },
                assignmentSubmissions: {
                    orderBy: { submittedAt: "desc" },
                    take: 5,
                    include: {
                        assignment: {
                            select: {
                                title: true,
                                dueDate: true,
                                subject: { select: { name: true } },
                            },
                        },
                    },
                },
                _count: {
                    select: {
                        attendances: true,
                        results: true,
                        assignmentSubmissions: true,
                    },
                },
            },
        });
        if (!student) {
            setup_1.logger.warn("Student not found or access denied", {
                userId: req.user?.id,
                studentId: id,
                userRole: req.user?.role,
            });
            return res.status(404).json({ message: "Student not found" });
        }
        setup_1.logger.info("Student retrieved", { userId: req.user?.id, studentId: id });
        res.status(200).json({ message: "Student retrieved successfully", student });
    }
    catch (error) {
        (0, setup_1.handleError)(res, error, "Failed to retrieve student");
    }
};
exports.getStudentById = getStudentById;
const createStudent = async (req, res) => {
    try {
        const data = createStudentSchema.parse(req.body);
        // Only super admin, principal, or school admin can create students
        if (!["SUPER_ADMIN", "PRINCIPAL", "SCHOOL_ADMIN"].includes(req.user?.role || "")) {
            return res.status(403).json({ message: "Access denied" });
        }
        // Verify school exists and user has access
        const school = await setup_1.prisma.school.findFirst({
            where: {
                id: data.schoolId,
                ...(req.user?.role !== "SUPER_ADMIN" ? { id: req.user?.schoolId } : {}),
            },
        });
        if (!school) {
            return res.status(404).json({ message: "School not found or access denied" });
        }
        // Verify class and grade if provided
        if (data.classId) {
            const classRecord = await setup_1.prisma.class.findFirst({
                where: {
                    id: data.classId,
                    schoolId: data.schoolId,
                },
                include: {
                    _count: { select: { students: true } },
                },
            });
            if (!classRecord) {
                return res.status(404).json({ message: "Class not found in the specified school" });
            }
            if (classRecord._count.students >= classRecord.capacity) {
                return res.status(400).json({ message: "Class is at full capacity" });
            }
        }
        if (data.gradeId) {
            const grade = await setup_1.prisma.grade.findFirst({
                where: {
                    id: data.gradeId,
                    schoolId: data.schoolId,
                },
            });
            if (!grade) {
                return res.status(404).json({ message: "Grade not found in the specified school" });
            }
        }
        // Check for duplicate registration number within the school
        const existingStudent = await setup_1.prisma.student.findFirst({
            where: {
                registrationNumber: data.registrationNumber,
                schoolId: data.schoolId,
            },
        });
        if (existingStudent) {
            return res.status(409).json({
                message: "A student with this registration number already exists in this school",
            });
        }
        let parentId;
        // Handle parent creation or validation
        if (data.parentDetails) {
            // Create new parent user and parent record
            const { parentDetails } = data;
            // Check if user already exists
            const existingUser = await setup_1.prisma.user.findFirst({
                where: {
                    OR: [{ email: parentDetails.email }, { username: parentDetails.username }],
                },
            });
            if (existingUser) {
                return res.status(409).json({
                    message: "A user with this email or username already exists",
                });
            }
            // Hash password
            const passwordHash = await bcrypt_1.default.hash(parentDetails.password, 12);
            // Create parent user and parent record in transaction
            const parentResult = await setup_1.prisma.$transaction(async (tx) => {
                // Create user
                const newUser = await tx.user.create({
                    data: {
                        email: parentDetails.email,
                        username: parentDetails.username,
                        passwordHash,
                        name: parentDetails.name,
                        surname: parentDetails.surname,
                        role: "PARENT",
                        phone: parentDetails.phone,
                        address: parentDetails.address,
                    },
                });
                // Create parent record
                const newParent = await tx.parent.create({
                    data: {
                        id: newUser.id,
                        verificationStatus: "PENDING",
                    },
                });
                return { user: newUser, parent: newParent };
            });
            parentId = parentResult.parent.id;
            // Send welcome notification to new parent
            await setup_1.prisma.notification.create({
                data: {
                    userId: parentId,
                    title: "Welcome to EduTrack!",
                    content: `Your parent account has been created. A student record for ${data.name} ${data.surname} has been created at ${school.name}.`,
                    type: "GENERAL",
                },
            });
            setup_1.logger.info("Parent user created during student creation", {
                userId: req.user?.id,
                parentId: parentId,
                parentEmail: parentDetails.email,
            });
        }
        else if (data.parentId) {
            // Verify existing parent
            const parent = await setup_1.prisma.parent.findUnique({
                where: { id: data.parentId },
                include: { user: true },
            });
            if (!parent) {
                return res.status(404).json({ message: "Parent not found" });
            }
            parentId = data.parentId;
        }
        else {
            // This should not happen due to schema validation, but just in case
            return res.status(400).json({ message: "Parent details or parent ID is required" });
        }
        // Create student record
        const student = await setup_1.prisma.student.create({
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
                parentId: parentId,
                classId: data.classId,
                gradeId: data.gradeId,
                verificationStatus: "PENDING",
            },
            include: {
                school: { select: { name: true } },
                parent: {
                    include: {
                        user: { select: { name: true, surname: true, email: true } },
                    },
                },
                class: { select: { name: true } },
                grade: { select: { name: true } },
            },
        });
        // Notify parent about the new student record (if using existing parent)
        if (data.parentId) {
            await setup_1.prisma.notification.create({
                data: {
                    userId: parentId,
                    title: "Student Record Created",
                    content: `A student record for ${data.name} ${data.surname} has been created at ${school.name}. Verification is pending.`,
                    type: "GENERAL",
                },
            });
        }
        setup_1.logger.info("Student created", {
            userId: req.user?.id,
            studentId: student.id,
            schoolId: data.schoolId,
            parentId: parentId,
            newParentCreated: !!data.parentDetails,
        });
        res.status(201).json({
            message: "Student created successfully",
            student,
            parentCreated: !!data.parentDetails,
        });
    }
    catch (error) {
        if (error instanceof zod_1.z.ZodError) {
            setup_1.logger.warn("Invalid input for student creation", { userId: req.user?.id, errors: error.errors });
            return res.status(400).json({ message: "Invalid input", errors: error.errors });
        }
        (0, setup_1.handleError)(res, error, "Failed to create student");
    }
};
exports.createStudent = createStudent;
const updateStudent = async (req, res) => {
    const { id } = req.params;
    try {
        const data = updateStudentSchema.parse(req.body);
        let where = { id };
        // Apply access control based on user role
        if (req.user?.role === "PARENT") {
            where = { id, parentId: req.user.id };
            // Parents can't update verification status
            if (data.verificationStatus) {
                return res.status(403).json({ message: "Parents cannot update verification status" });
            }
        }
        else if (req.user?.role === "PRINCIPAL" || req.user?.role === "SCHOOL_ADMIN") {
            where = { id, ...(0, setup_1.getTenantFilter)(req.user) };
        }
        else if (req.user?.role === "TEACHER") {
            // Teachers can only update students in their classes and can't change verification status
            where = {
                id,
                OR: [
                    {
                        class: { supervisorId: req.user.id },
                    },
                    {
                        class: {
                            lessons: {
                                some: { teacherId: req.user.id },
                            },
                        },
                    },
                ],
            };
            if (data.verificationStatus) {
                return res.status(403).json({ message: "Teachers cannot update verification status" });
            }
        }
        // Get existing student to validate updates
        const existingStudent = await setup_1.prisma.student.findFirst({ where });
        if (!existingStudent) {
            return res.status(404).json({ message: "Student not found or access denied" });
        }
        // Verify class and grade if being updated
        if (data.classId) {
            const classRecord = await setup_1.prisma.class.findFirst({
                where: {
                    id: data.classId,
                    schoolId: existingStudent.schoolId,
                },
                include: {
                    _count: { select: { students: true } },
                },
            });
            if (!classRecord) {
                return res.status(404).json({ message: "Class not found in the student's school" });
            }
            // Check capacity only if moving to a different class
            if (data.classId !== existingStudent.classId && classRecord._count.students >= classRecord.capacity) {
                return res.status(400).json({ message: "Class is at full capacity" });
            }
        }
        if (data.gradeId) {
            const grade = await setup_1.prisma.grade.findFirst({
                where: {
                    id: data.gradeId,
                    schoolId: existingStudent.schoolId,
                },
            });
            if (!grade) {
                return res.status(404).json({ message: "Grade not found in the student's school" });
            }
        }
        // Check for duplicate registration number if being updated
        if (data.registrationNumber && data.registrationNumber !== existingStudent.registrationNumber) {
            const duplicateStudent = await setup_1.prisma.student.findFirst({
                where: {
                    registrationNumber: data.registrationNumber,
                    schoolId: existingStudent.schoolId,
                    id: { not: id },
                },
            });
            if (duplicateStudent) {
                return res.status(409).json({
                    message: "A student with this registration number already exists in this school",
                });
            }
        }
        const student = await setup_1.prisma.student.update({
            where: { id },
            data: {
                ...(data.registrationNumber && { registrationNumber: data.registrationNumber }),
                ...(data.name && { name: data.name }),
                ...(data.surname && { surname: data.surname }),
                ...(data.address !== undefined && { address: data.address }),
                ...(data.imageUrl !== undefined && { imageUrl: data.imageUrl }),
                ...(data.bloodType !== undefined && { bloodType: data.bloodType }),
                ...(data.sex && { sex: data.sex }),
                ...(data.birthday && { birthday: new Date(data.birthday) }),
                ...(data.classId !== undefined && { classId: data.classId }),
                ...(data.gradeId !== undefined && { gradeId: data.gradeId }),
                ...(data.verificationStatus && {
                    verificationStatus: data.verificationStatus,
                    ...(data.verificationStatus === "VERIFIED" && { verifiedAt: new Date() }),
                }),
            },
            include: {
                school: { select: { name: true } },
                parent: {
                    include: {
                        user: { select: { name: true, surname: true } },
                    },
                },
                class: { select: { name: true } },
                grade: { select: { name: true } },
            },
        });
        // Notify parent if verification status changed
        if (data.verificationStatus && data.verificationStatus !== existingStudent.verificationStatus) {
            const statusMessage = data.verificationStatus === "VERIFIED"
                ? "verified and approved"
                : data.verificationStatus === "REJECTED"
                    ? "rejected"
                    : "pending review";
            await setup_1.prisma.notification.create({
                data: {
                    userId: existingStudent.parentId,
                    title: "Student Verification Update",
                    content: `The verification status for ${student.name} ${student.surname} has been ${statusMessage}.`,
                    type: "APPROVAL",
                },
            });
        }
        setup_1.logger.info("Student updated", { userId: req.user?.id, studentId: id });
        res.status(200).json({ message: "Student updated successfully", student });
    }
    catch (error) {
        if (error instanceof zod_1.z.ZodError) {
            setup_1.logger.warn("Invalid input for student update", { userId: req.user?.id, errors: error.errors });
            return res.status(400).json({ message: "Invalid input", errors: error.errors });
        }
        (0, setup_1.handleError)(res, error, "Failed to update student");
    }
};
exports.updateStudent = updateStudent;
const deleteStudent = async (req, res) => {
    const { id } = req.params;
    try {
        // Only super admin, principal, or school admin can delete students
        if (!["SUPER_ADMIN", "PRINCIPAL", "SCHOOL_ADMIN"].includes(req.user?.role || "")) {
            return res.status(403).json({ message: "Access denied" });
        }
        let where = { id };
        // Apply tenant filtering for non-super admins
        if (req.user?.role !== "SUPER_ADMIN") {
            where = { id, ...(0, setup_1.getTenantFilter)(req.user) };
        }
        // Check if student has associated records
        const student = await setup_1.prisma.student.findFirst({
            where,
            include: {
                _count: {
                    select: {
                        attendances: true,
                        results: true,
                        assignmentSubmissions: true,
                    },
                },
            },
        });
        if (!student) {
            return res.status(404).json({ message: "Student not found or access denied" });
        }
        const hasAssociatedData = student._count.attendances > 0 || student._count.results > 0 || student._count.assignmentSubmissions > 0;
        if (hasAssociatedData) {
            return res.status(400).json({
                message: "Cannot delete student with associated attendance, results, or assignment submissions",
                associatedData: {
                    attendances: student._count.attendances,
                    results: student._count.results,
                    assignmentSubmissions: student._count.assignmentSubmissions,
                },
            });
        }
        await setup_1.prisma.student.delete({ where: { id } });
        setup_1.logger.info("Student deleted", { userId: req.user?.id, studentId: id });
        res.status(200).json({ message: "Student deleted successfully" });
    }
    catch (error) {
        (0, setup_1.handleError)(res, error, "Failed to delete student");
    }
};
exports.deleteStudent = deleteStudent;
// New endpoint to get students by school (for multi-tenant support)
const getStudentsBySchool = async (req, res) => {
    try {
        if (!["PRINCIPAL", "SCHOOL_ADMIN", "SUPER_ADMIN"].includes(req.user?.role || "")) {
            return res.status(403).json({ message: "Access denied" });
        }
        const page = Number.parseInt(req.query.page) || 1;
        const limit = Number.parseInt(req.query.limit) || 10;
        const skip = (page - 1) * limit;
        const schoolId = req.user?.role === "SUPER_ADMIN" ? req.query.schoolId : req.user?.schoolId;
        if (!schoolId) {
            return res.status(400).json({ message: "School ID is required" });
        }
        const classId = req.query.classId;
        const gradeId = req.query.gradeId;
        const verificationStatus = req.query.verificationStatus;
        const where = { schoolId };
        if (classId)
            where.classId = classId;
        if (gradeId)
            where.gradeId = gradeId;
        if (verificationStatus)
            where.verificationStatus = verificationStatus;
        const [students, total] = await Promise.all([
            setup_1.prisma.student.findMany({
                where,
                skip,
                take: limit,
                include: {
                    parent: {
                        include: {
                            user: {
                                select: {
                                    name: true,
                                    surname: true,
                                    email: true,
                                    phone: true,
                                },
                            },
                        },
                    },
                    class: {
                        select: {
                            name: true,
                            grade: { select: { name: true } },
                        },
                    },
                    _count: {
                        select: {
                            attendances: true,
                            results: true,
                            assignmentSubmissions: true,
                        },
                    },
                },
                orderBy: [{ class: { name: "asc" } }, { name: "asc" }],
            }),
            setup_1.prisma.student.count({ where }),
        ]);
        setup_1.logger.info("Students by school retrieved", {
            userId: req.user?.id,
            schoolId,
            page,
            limit,
            total,
        });
        res.status(200).json({
            message: "Students retrieved successfully",
            students,
            pagination: { page, limit, total, pages: Math.ceil(total / limit) },
        });
    }
    catch (error) {
        (0, setup_1.handleError)(res, error, "Failed to retrieve students by school");
    }
};
exports.getStudentsBySchool = getStudentsBySchool;
async function getTeacherStudentFilter(teacherId, schoolId) {
    return {
        schoolId,
        OR: [
            {
                class: { supervisorId: teacherId },
            },
            {
                class: {
                    lessons: {
                        some: { teacherId: teacherId },
                    },
                },
            },
        ],
    };
}
