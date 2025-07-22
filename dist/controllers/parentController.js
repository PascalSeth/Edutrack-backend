"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getParentsBySchool = exports.getParentChildrenAcrossSchools = exports.deleteParent = exports.updateParent = exports.createParent = exports.getParentById = exports.getParents = void 0;
const zod_1 = require("zod");
const bcryptjs_1 = __importDefault(require("bcryptjs"));
const setup_1 = require("../utils/setup");
// Validation Schemas
const createParentSchema = zod_1.z
    .object({
    userId: zod_1.z.string().uuid("Invalid user ID").optional(),
    userDetails: zod_1.z
        .object({
        email: zod_1.z.string().email("Invalid email address"),
        name: zod_1.z.string().min(2, "Name must be at least 2 characters"),
        surname: zod_1.z.string().min(2, "Surname must be at least 2 characters"),
        phone: zod_1.z.string().optional(),
        address: zod_1.z.string().optional(),
        password: zod_1.z.string().min(6, "Password must be at least 6 characters"),
    })
        .optional(),
})
    .refine((data) => data.userId !== undefined || data.userDetails !== undefined, {
    message: "Either userId or userDetails must be provided",
    path: ["userId"],
})
    .refine((data) => !(data.userId !== undefined && data.userDetails !== undefined), {
    message: "Cannot provide both userId and userDetails",
    path: ["userId"],
});
const updateParentSchema = zod_1.z.object({
    // Parent model has minimal direct fields to update
    verificationStatus: zod_1.z.enum(["PENDING", "VERIFIED", "REJECTED"]).optional(),
});
const getTenantFilter = (user) => {
    if (user?.role === "PRINCIPAL" || user?.role === "SCHOOL_ADMIN") {
        return {
            schoolId: user.schoolId,
        };
    }
    return {};
};
const getTeacherStudentFilter = (teacherId, schoolId) => {
    return {
        OR: [
            {
                class: { supervisorId: teacherId },
                schoolId,
            },
            {
                class: {
                    lessons: {
                        some: { teacherId },
                    },
                },
                schoolId,
            },
        ],
    };
};
const getTeacherParentFilter = (teacherId, schoolId) => {
    return {
        children: {
            some: {
                OR: [
                    {
                        class: { supervisorId: teacherId },
                        schoolId,
                    },
                    {
                        class: {
                            lessons: {
                                some: { teacherId },
                            },
                        },
                        schoolId,
                    },
                ],
            },
        },
    };
};
const getParents = async (req, res) => {
    try {
        const page = Number.parseInt(req.query.page) || 1;
        const limit = Number.parseInt(req.query.limit) || 10;
        const skip = (page - 1) * limit;
        let where = {};
        // Apply tenant filtering based on user role
        if (req.user?.role === "SUPER_ADMIN") {
            // Super admin sees all parents
            where = {};
        }
        else if (req.user?.role === "PARENT") {
            // Parents can only see their own record
            where = { id: req.user.id };
        }
        else if (req.user?.role === "PRINCIPAL" || req.user?.role === "SCHOOL_ADMIN") {
            // Show parents who have children in this school
            where = {
                children: {
                    some: {
                        schoolId: req.user.schoolId,
                    },
                },
            };
        }
        else if (req.user?.role === "TEACHER") {
            // Show parents of students in teacher's classes
            where = getTeacherParentFilter(req.user.id, req.user?.schoolId);
        }
        const [parents, total] = await Promise.all([
            setup_1.prisma.parent.findMany({
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
                            phone: true,
                            profileImageUrl: true,
                        },
                    },
                    children: {
                        // For non-super admins, filter children by accessible schools
                        where: req.user?.role === "SUPER_ADMIN"
                            ? {}
                            : req.user?.role === "PARENT"
                                ? {}
                                : req.user?.role === "TEACHER"
                                    ? getTeacherStudentFilter(req.user.id, req.user?.schoolId)
                                    : getTenantFilter(req.user),
                        include: {
                            school: { select: { id: true, name: true } },
                            class: { select: { name: true } },
                            grade: { select: { name: true } },
                        },
                    },
                    _count: {
                        select: {
                            children: true,
                            payments: true,
                            feedbacks: true,
                        },
                    },
                },
                orderBy: { user: { name: "asc" } },
            }),
            setup_1.prisma.parent.count({ where }),
        ]);
        setup_1.logger.info("Parents retrieved", {
            userId: req.user?.id,
            userRole: req.user?.role,
            page,
            limit,
            total,
        });
        res.status(200).json({
            message: "Parents retrieved successfully",
            parents,
            pagination: { page, limit, total, pages: Math.ceil(total / limit) },
        });
    }
    catch (error) {
        (0, setup_1.handleError)(res, error, "Failed to retrieve parents");
    }
};
exports.getParents = getParents;
const getParentById = async (req, res) => {
    const { id } = req.params;
    try {
        let where = { id };
        // Apply access control based on user role
        if (req.user?.role === "PARENT" && req.user.id !== id) {
            return res.status(403).json({ message: "Access denied" });
        }
        if (req.user?.role === "PRINCIPAL" || req.user?.role === "SCHOOL_ADMIN") {
            where = {
                id,
                children: {
                    some: {
                        schoolId: req.user.schoolId,
                    },
                },
            };
        }
        else if (req.user?.role === "TEACHER") {
            where = {
                id,
                children: {
                    some: {
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
                    },
                },
            };
        }
        const parent = await setup_1.prisma.parent.findFirst({
            where,
            include: {
                user: {
                    select: {
                        id: true,
                        email: true,
                        name: true,
                        surname: true,
                        phone: true,
                        address: true,
                        profileImageUrl: true,
                        createdAt: true,
                    },
                },
                children: {
                    include: {
                        school: {
                            select: {
                                id: true,
                                name: true,
                                city: true,
                                logoUrl: true,
                            },
                        },
                        class: {
                            select: {
                                id: true,
                                name: true,
                                grade: { select: { name: true, level: true } },
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
                },
                payments: {
                    include: {
                        school: { select: { name: true } },
                        feeStructure: { select: { name: true, amount: true } },
                    },
                    orderBy: { createdAt: "desc" },
                    take: 5,
                },
                feedbacks: {
                    orderBy: { createdAt: "desc" },
                    take: 5,
                },
                _count: {
                    select: {
                        children: true,
                        payments: true,
                        feedbacks: true,
                    },
                },
            },
        });
        if (!parent) {
            setup_1.logger.warn("Parent not found or access denied", {
                userId: req.user?.id,
                parentId: id,
                userRole: req.user?.role,
            });
            return res.status(404).json({ message: "Parent not found" });
        }
        setup_1.logger.info("Parent retrieved", { userId: req.user?.id, parentId: id });
        res.status(200).json({ message: "Parent retrieved successfully", parent });
    }
    catch (error) {
        (0, setup_1.handleError)(res, error, "Failed to retrieve parent");
    }
};
exports.getParentById = getParentById;
const createParent = async (req, res) => {
    try {
        const data = createParentSchema.parse(req.body);
        // Only super admin, principal, or school admin can create parent records
        if (!["SUPER_ADMIN", "PRINCIPAL", "SCHOOL_ADMIN"].includes(req.user?.role || "")) {
            return res.status(403).json({ message: "Access denied" });
        }
        let userId;
        if (data.userId) {
            // Creating parent record for existing user
            const user = await setup_1.prisma.user.findUnique({ where: { id: data.userId } });
            if (!user) {
                return res.status(404).json({ message: "User not found" });
            }
            if (user.role !== "PARENT") {
                return res.status(400).json({ message: "User must have PARENT role" });
            }
            userId = data.userId;
        }
        else if (data.userDetails) {
            // Creating both user and parent records
            const { email, name, surname, phone, address, password } = data.userDetails;
            // Check if user with email already exists
            const existingUser = await setup_1.prisma.user.findUnique({ where: { email } });
            if (existingUser) {
                return res.status(409).json({ message: "User with this email already exists" });
            }
            // Hash password
            const hashedPassword = await bcryptjs_1.default.hash(password, 12);
            // Generate username from email
            const username = email.split("@")[0];
            // Create user with PARENT role
            const user = await setup_1.prisma.user.create({
                data: {
                    email,
                    username,
                    name,
                    surname,
                    phone,
                    address,
                    passwordHash: hashedPassword,
                    role: "PARENT",
                },
            });
            userId = user.id;
        }
        else {
            return res.status(400).json({ message: "Either userId or userDetails must be provided" });
        }
        // Check if parent record already exists
        const existingParent = await setup_1.prisma.parent.findUnique({ where: { id: userId } });
        if (existingParent) {
            return res.status(409).json({ message: "Parent record already exists for this user" });
        }
        const parent = await setup_1.prisma.parent.create({
            data: {
                id: userId,
                verificationStatus: "PENDING",
            },
            include: {
                user: {
                    select: {
                        id: true,
                        email: true,
                        name: true,
                        surname: true,
                        phone: true,
                    },
                },
            },
        });
        setup_1.logger.info("Parent created", { userId: req.user?.id, parentId: parent.id });
        res.status(201).json({ message: "Parent created successfully", parent });
    }
    catch (error) {
        if (error instanceof zod_1.z.ZodError) {
            setup_1.logger.warn("Invalid input for parent creation", { userId: req.user?.id, errors: error.errors });
            return res.status(400).json({ message: "Invalid input", errors: error.errors });
        }
        (0, setup_1.handleError)(res, error, "Failed to create parent");
    }
};
exports.createParent = createParent;
const updateParent = async (req, res) => {
    const { id } = req.params;
    try {
        const data = updateParentSchema.parse(req.body);
        // Only super admin, principal, or school admin can update parent verification status
        if (data.verificationStatus && !["SUPER_ADMIN", "PRINCIPAL", "SCHOOL_ADMIN"].includes(req.user?.role || "")) {
            return res.status(403).json({ message: "Access denied" });
        }
        // Parents can only update their own record (though there's not much to update)
        if (req.user?.role === "PARENT" && req.user.id !== id) {
            return res.status(403).json({ message: "Access denied" });
        }
        let where = { id };
        // Apply tenant filtering for non-super admins
        if (req.user?.role === "PRINCIPAL" || req.user?.role === "SCHOOL_ADMIN") {
            where = {
                id,
                children: {
                    some: {
                        schoolId: req.user.schoolId,
                    },
                },
            };
        }
        const parent = await setup_1.prisma.parent.update({
            where,
            data: {
                ...(data.verificationStatus && {
                    verificationStatus: data.verificationStatus,
                    ...(data.verificationStatus === "VERIFIED" && { verifiedAt: new Date() }),
                }),
            },
            include: {
                user: {
                    select: {
                        email: true,
                        name: true,
                        surname: true,
                    },
                },
            },
        });
        setup_1.logger.info("Parent updated", { userId: req.user?.id, parentId: id });
        res.status(200).json({ message: "Parent updated successfully", parent });
    }
    catch (error) {
        if (error instanceof zod_1.z.ZodError) {
            setup_1.logger.warn("Invalid input for parent update", { userId: req.user?.id, errors: error.errors });
            return res.status(400).json({ message: "Invalid input", errors: error.errors });
        }
        (0, setup_1.handleError)(res, error, "Failed to update parent");
    }
};
exports.updateParent = updateParent;
const deleteParent = async (req, res) => {
    const { id } = req.params;
    try {
        // Only super admin can delete parent records
        if (req.user?.role !== "SUPER_ADMIN") {
            return res.status(403).json({ message: "Only super admin can delete parent records" });
        }
        // Check if parent has children - prevent deletion if they do
        const parent = await setup_1.prisma.parent.findUnique({
            where: { id },
            include: {
                _count: { select: { children: true } },
            },
        });
        if (!parent) {
            return res.status(404).json({ message: "Parent not found" });
        }
        if (parent._count.children > 0) {
            return res.status(400).json({
                message: "Cannot delete parent with associated children. Remove children first.",
            });
        }
        await setup_1.prisma.parent.delete({ where: { id } });
        setup_1.logger.info("Parent deleted", { userId: req.user?.id, parentId: id });
        res.status(200).json({ message: "Parent deleted successfully" });
    }
    catch (error) {
        (0, setup_1.handleError)(res, error, "Failed to delete parent");
    }
};
exports.deleteParent = deleteParent;
// New endpoint to get parent's children across all schools
const getParentChildrenAcrossSchools = async (req, res) => {
    const { id } = req.params;
    try {
        // Only the parent themselves or authorized school staff can access this
        if (req.user?.role === "PARENT" && req.user.id !== id) {
            return res.status(403).json({ message: "Access denied" });
        }
        let where = { id };
        // For school staff, ensure they can only see parents with children in their school
        if (req.user?.role === "PRINCIPAL" || req.user?.role === "SCHOOL_ADMIN") {
            where = {
                id,
                children: {
                    some: {
                        schoolId: req.user.schoolId,
                    },
                },
            };
        }
        const parent = await setup_1.prisma.parent.findFirst({
            where,
            include: {
                user: {
                    select: {
                        id: true,
                        email: true,
                        name: true,
                        surname: true,
                        phone: true,
                        profileImageUrl: true,
                    },
                },
                children: {
                    include: {
                        school: {
                            select: {
                                id: true,
                                name: true,
                                city: true,
                                logoUrl: true,
                            },
                        },
                        class: {
                            select: {
                                id: true,
                                name: true,
                                grade: { select: { name: true, level: true } },
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
                },
            },
        });
        if (!parent) {
            return res.status(404).json({ message: "Parent not found or access denied" });
        }
        // Group children by school
        const childrenBySchool = parent.children.reduce((acc, child) => {
            const schoolId = child.school.id;
            if (!acc[schoolId]) {
                acc[schoolId] = {
                    school: child.school,
                    children: [],
                };
            }
            acc[schoolId].children.push(child);
            return acc;
        }, {});
        setup_1.logger.info("Parent children across schools retrieved", {
            userId: req.user?.id,
            parentId: id,
            childrenCount: parent.children.length,
            schoolsCount: Object.keys(childrenBySchool).length,
        });
        res.status(200).json({
            message: "Parent children retrieved successfully",
            parent: {
                id: parent.id,
                user: parent.user,
                verificationStatus: parent.verificationStatus,
            },
            children: parent.children,
            childrenBySchool: Object.values(childrenBySchool),
            summary: {
                totalChildren: parent.children.length,
                schoolsCount: Object.keys(childrenBySchool).length,
            },
        });
    }
    catch (error) {
        (0, setup_1.handleError)(res, error, "Failed to retrieve parent children");
    }
};
exports.getParentChildrenAcrossSchools = getParentChildrenAcrossSchools;
// New endpoint to get parents by school (for school administrators)
const getParentsBySchool = async (req, res) => {
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
        const [parents, total] = await Promise.all([
            setup_1.prisma.parent.findMany({
                where: {
                    children: {
                        some: { schoolId },
                    },
                },
                skip,
                take: limit,
                include: {
                    user: {
                        select: {
                            name: true,
                            surname: true,
                            email: true,
                            phone: true,
                        },
                    },
                    children: {
                        where: { schoolId },
                        include: {
                            class: { select: { name: true } },
                            grade: { select: { name: true } },
                        },
                    },
                    _count: {
                        select: {
                            children: true,
                            payments: true,
                        },
                    },
                },
                orderBy: { user: { name: "asc" } },
            }),
            setup_1.prisma.parent.count({
                where: {
                    children: {
                        some: { schoolId },
                    },
                },
            }),
        ]);
        setup_1.logger.info("Parents by school retrieved", {
            userId: req.user?.id,
            schoolId,
            page,
            limit,
            total,
        });
        res.status(200).json({
            message: "Parents retrieved successfully",
            parents,
            pagination: { page, limit, total, pages: Math.ceil(total / limit) },
        });
    }
    catch (error) {
        (0, setup_1.handleError)(res, error, "Failed to retrieve parents by school");
    }
};
exports.getParentsBySchool = getParentsBySchool;
