"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.validateStudentAccess = exports.validateSchoolAccess = exports.calculateTransactionFee = exports.createNotification = exports.createPaginationResult = exports.getPagination = exports.handleError = exports.getTeacherTenantFilter = exports.getParentTenantFilter = exports.getTenantFilter = exports.authMiddleware = exports.logger = exports.prisma = void 0;
const client_1 = require("@prisma/client");
const winston_1 = __importDefault(require("winston"));
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
// Prisma Client with multi-tenant support
exports.prisma = new client_1.PrismaClient();
// Logger
exports.logger = winston_1.default.createLogger({
    level: "info",
    format: winston_1.default.format.combine(winston_1.default.format.timestamp(), winston_1.default.format.json()),
    transports: [
        new winston_1.default.transports.File({ filename: "error.log", level: "error" }),
        new winston_1.default.transports.File({ filename: "combined.log" }),
    ],
});
if (process.env.NODE_ENV !== "production") {
    exports.logger.add(new winston_1.default.transports.Console({ format: winston_1.default.format.simple() }));
}
const authMiddleware = (requiredRoles) => async (req, res, next) => {
    const token = req.headers.authorization?.split(" ")[1];
    if (!token) {
        exports.logger.warn("No token provided", { path: req.path });
        return res.status(401).json({ message: "No token provided" });
    }
    try {
        const decoded = jsonwebtoken_1.default.verify(token, process.env.JWT_SECRET);
        if (requiredRoles.length && !requiredRoles.includes(decoded.role)) {
            exports.logger.warn("Insufficient permissions", {
                userId: decoded.id,
                role: decoded.role,
                path: req.path,
            });
            return res.status(403).json({ message: "Insufficient permissions" });
        }
        // Get user's school context for multi-tenancy (except for SUPER_ADMIN and PARENT)
        if (decoded.role !== "SUPER_ADMIN") {
            const user = await exports.prisma.user.findUnique({
                where: { id: decoded.id },
                include: {
                    schoolAdmin: { include: { school: true } },
                    principal: { include: { school: true } },
                    teacher: { include: { school: true } },
                    parent: true, // Parent doesn't have a single school
                },
            });
            if (user) {
                let school;
                if (user.schoolAdmin)
                    school = user.schoolAdmin.school;
                else if (user.principal)
                    school = user.principal.school;
                else if (user.teacher)
                    school = user.teacher.school;
                // Parents don't have a single school context
                if (school) {
                    decoded.schoolId = school.id;
                    decoded.tenantId = school.tenantId;
                }
            }
        }
        req.user = decoded;
        next();
    }
    catch (error) {
        exports.logger.error("Invalid token", { error, path: req.path });
        return res.status(401).json({ message: "Invalid token" });
    }
};
exports.authMiddleware = authMiddleware;
// Enhanced multi-tenant data filter
const getTenantFilter = (user) => {
    if (!user || user.role === "SUPER_ADMIN") {
        return {}; // Super admin can access all data
    }
    // Parents don't have a single school filter since they can have children in multiple schools
    if (user.role === "PARENT") {
        return {}; // Parent filtering is handled at the query level
    }
    if (user.schoolId) {
        return { schoolId: user.schoolId };
    }
    return {};
};
exports.getTenantFilter = getTenantFilter;
// Enhanced tenant filter for parent-specific queries
const getParentTenantFilter = (parentId) => {
    return {
        students: {
            some: { parentId: parentId },
        },
    };
};
exports.getParentTenantFilter = getParentTenantFilter;
// Enhanced tenant filter for teacher-specific queries
const getTeacherTenantFilter = (teacherId, schoolId) => {
    const baseFilter = {
        OR: [
            { supervisorId: teacherId },
            {
                lessons: {
                    some: { teacherId: teacherId },
                },
            },
        ],
    };
    if (schoolId) {
        baseFilter.schoolId = schoolId;
    }
    return baseFilter;
};
exports.getTeacherTenantFilter = getTeacherTenantFilter;
// Error Handler
const handleError = (res, error, defaultMessage) => {
    exports.logger.error(defaultMessage, { error });
    if (error instanceof client_1.Prisma.PrismaClientKnownRequestError) {
        if (error.code === "P2025") {
            return res.status(404).json({ message: "Resource not found" });
        }
        if (error.code === "P2002") {
            return res.status(409).json({ message: "Unique constraint violation" });
        }
        if (error.code === "P2003") {
            return res.status(400).json({ message: "Foreign key constraint violation" });
        }
    }
    if (error instanceof Error) {
        return res.status(400).json({ message: error.message });
    }
    return res.status(500).json({ message: defaultMessage });
};
exports.handleError = handleError;
const getPagination = (options) => {
    const page = Math.max(1, options.page || 1);
    const limit = Math.min(100, Math.max(1, options.limit || 10));
    const skip = (page - 1) * limit;
    return { page, limit, skip };
};
exports.getPagination = getPagination;
const createPaginationResult = (page, limit, total) => ({
    page,
    limit,
    total,
    pages: Math.ceil(total / limit),
});
exports.createPaginationResult = createPaginationResult;
// Notification helper
const createNotification = async (userId, title, content, type, data) => {
    try {
        await exports.prisma.notification.create({
            data: {
                userId,
                title,
                content,
                type: type,
                data,
            },
        });
    }
    catch (error) {
        exports.logger.error("Failed to create notification", { error, userId, title });
    }
};
exports.createNotification = createNotification;
// Revenue calculation helper
const calculateTransactionFee = (amount, feePercentage = 0.025) => {
    return Math.round(amount * feePercentage * 100) / 100; // Round to 2 decimal places
};
exports.calculateTransactionFee = calculateTransactionFee;
// Multi-tenant validation helpers
const validateSchoolAccess = async (userId, schoolId, userRole) => {
    if (userRole === "SUPER_ADMIN")
        return true;
    const user = await exports.prisma.user.findUnique({
        where: { id: userId },
        include: {
            schoolAdmin: true,
            principal: true,
            teacher: true,
            parent: {
                include: {
                    children: { select: { schoolId: true } },
                },
            },
        },
    });
    if (!user)
        return false;
    switch (userRole) {
        case "SCHOOL_ADMIN":
            return user.schoolAdmin?.schoolId === schoolId;
        case "PRINCIPAL":
            return user.principal?.schoolId === schoolId;
        case "TEACHER":
            return user.teacher?.schoolId === schoolId;
        case "PARENT":
            return user.parent?.children.some((child) => child.schoolId === schoolId) || false;
        default:
            return false;
    }
};
exports.validateSchoolAccess = validateSchoolAccess;
const validateStudentAccess = async (userId, studentId, userRole) => {
    if (userRole === "SUPER_ADMIN")
        return true;
    const student = await exports.prisma.student.findUnique({
        where: { id: studentId },
        include: {
            school: true,
            class: {
                include: {
                    supervisor: true,
                    lessons: {
                        include: { teacher: true },
                    },
                },
            },
        },
    });
    if (!student)
        return false;
    switch (userRole) {
        case "PARENT":
            return student.parentId === userId;
        case "TEACHER":
            // Teacher can access if they supervise the class or teach lessons in the class
            return (student.class?.supervisorId === userId ||
                student.class?.lessons.some((lesson) => lesson.teacherId === userId) ||
                false);
        case "PRINCIPAL":
        case "SCHOOL_ADMIN":
            return await (0, exports.validateSchoolAccess)(userId, student.schoolId, userRole);
        default:
            return false;
    }
};
exports.validateStudentAccess = validateStudentAccess;
