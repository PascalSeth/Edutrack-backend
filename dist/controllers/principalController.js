"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.verifyPrincipal = exports.deletePrincipal = exports.updatePrincipal = exports.createPrincipal = exports.getPrincipalById = exports.getPrincipals = void 0;
const zod_1 = require("zod");
const setup_1 = require("../utils/setup");
const emailService_1 = require("../utils/emailService");
// Validation Schemas
const createPrincipalSchema = zod_1.z.object({
    schoolId: zod_1.z.string().uuid("Invalid school ID"),
    // Required fields for creating new user
    email: zod_1.z.string().email("Invalid email address"),
    password: zod_1.z.string().min(6, "Password must be at least 6 characters long").optional(),
    name: zod_1.z.string().min(1, "Name is required"),
    surname: zod_1.z.string().min(1, "Surname is required"),
    username: zod_1.z.string().min(3, "Username must be at least 3 characters long"),
    // Optional principal-specific fields
    profileImageUrl: zod_1.z.string().url().optional(),
    qualifications: zod_1.z.string().optional(),
    bio: zod_1.z.string().optional(),
});
const updatePrincipalSchema = zod_1.z.object({
    profileImageUrl: zod_1.z.string().url().optional(),
    qualifications: zod_1.z.string().optional(),
    bio: zod_1.z.string().optional(),
});
const getPrincipals = async (req, res) => {
    try {
        const page = Number.parseInt(req.query.page) || 1;
        const limit = Number.parseInt(req.query.limit) || 10;
        const skip = (page - 1) * limit;
        let where = {};
        // Apply tenant filtering based on user role
        if (req.user?.role === "SUPER_ADMIN") {
            // Super admin sees all principals, but can filter by schoolId if provided
            const schoolId = req.query.schoolId;
            if (schoolId) {
                where.schoolId = schoolId;
            }
        }
        else if (req.user?.role === "PRINCIPAL") {
            // Principals can only see their own record
            where = { id: req.user.id };
        }
        else if (req.user?.role === "SCHOOL_ADMIN") {
            // School admins see principals in their school
            where = (0, setup_1.getTenantFilter)(req.user);
        }
        const [principals, total] = await Promise.all([
            setup_1.prisma.principal.findMany({
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
                    approval: {
                        select: {
                            status: true,
                        },
                    },
                },
                orderBy: { user: { name: "asc" } },
            }),
            setup_1.prisma.principal.count({ where }),
        ]);
        setup_1.logger.info("Principals retrieved", {
            userId: req.user?.id,
            userRole: req.user?.role,
            page,
            limit,
            total,
        });
        res.status(200).json({
            message: "Principals retrieved successfully",
            principals,
            pagination: { page, limit, total, pages: Math.ceil(total / limit) },
        });
    }
    catch (error) {
        (0, setup_1.handleError)(res, error, "Failed to retrieve principals");
    }
};
exports.getPrincipals = getPrincipals;
const getPrincipalById = async (req, res) => {
    const { id } = req.params;
    try {
        const principal = await setup_1.prisma.principal.findUnique({
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
                approval: {
                    select: {
                        status: true,
                    },
                },
            },
        });
        if (!principal) {
            setup_1.logger.warn("Principal not found", { userId: req.user?.id, principalId: id });
            return res.status(404).json({ message: "Principal not found" });
        }
        setup_1.logger.info("Principal retrieved", { userId: req.user?.id, principalId: id });
        res.status(200).json({ message: "Principal retrieved successfully", principal });
    }
    catch (error) {
        (0, setup_1.handleError)(res, error, "Failed to retrieve principal");
    }
};
exports.getPrincipalById = getPrincipalById;
const createPrincipal = async (req, res) => {
    try {
        const data = createPrincipalSchema.parse(req.body);
        const { email, password, name, surname, username, schoolId, profileImageUrl, ...principalDetails } = data;
        // Verify school exists
        const school = await setup_1.prisma.school.findUnique({ where: { id: schoolId } });
        if (!school) {
            throw new Error("School not found");
        }
        // Generate password if not provided
        const generatedPassword = password || (0, emailService_1.generatePassword)();
        const plainPassword = generatedPassword; // Store for email
        // Create principal and user in a transaction
        const principal = await setup_1.prisma.$transaction(async (tx) => {
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
            // Create new user with PRINCIPAL role
            const hashedPassword = await (0, setup_1.hashPassword)(generatedPassword);
            const newUser = await tx.user.create({
                data: {
                    email,
                    passwordHash: hashedPassword,
                    name,
                    surname,
                    username,
                    role: "PRINCIPAL",
                    profileImageUrl: profileImageUrl || null,
                },
            });
            // Create principal record
            const newPrincipal = await tx.principal.create({
                data: {
                    id: newUser.id,
                    schoolId: schoolId,
                    qualifications: principalDetails.qualifications,
                    bio: principalDetails.bio,
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
            return newPrincipal;
        });
        // Send welcome email
        try {
            await (0, emailService_1.sendPrincipalWelcomeEmail)(email, name, surname, school.name, plainPassword);
            setup_1.logger.info("Welcome email sent to new principal", {
                principalEmail: email,
                schoolName: school.name,
            });
        }
        catch (emailError) {
            setup_1.logger.error("Failed to send welcome email to principal", {
                principalEmail: email,
                error: emailError instanceof Error ? emailError.message : 'Unknown error',
            });
            // Don't fail the registration if email fails
        }
        setup_1.logger.info("Principal created", { userId: req.user?.id, principalId: principal.id });
        res.status(201).json({
            message: "Principal created successfully",
            principal,
            ...(password ? {} : { generatedCredentials: { email, password: plainPassword } })
        });
    }
    catch (error) {
        if (error instanceof zod_1.z.ZodError) {
            setup_1.logger.warn("Invalid input for principal creation", { userId: req.user?.id, errors: error.errors });
            return res.status(400).json({ message: "Invalid input", errors: error.errors });
        }
        (0, setup_1.handleError)(res, error, "Failed to create principal");
    }
};
exports.createPrincipal = createPrincipal;
const updatePrincipal = async (req, res) => {
    const { id } = req.params;
    try {
        const data = updatePrincipalSchema.parse(req.body);
        // Update principal and user profileImageUrl in a transaction
        const principal = await setup_1.prisma.$transaction(async (tx) => {
            const updatedPrincipal = await tx.principal.update({
                where: { id },
                data: {
                    qualifications: data.qualifications,
                    bio: data.bio,
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
            return updatedPrincipal;
        });
        setup_1.logger.info("Principal updated", { userId: req.user?.id, principalId: id });
        res.status(200).json({ message: "Principal updated successfully", principal });
    }
    catch (error) {
        if (error instanceof zod_1.z.ZodError) {
            setup_1.logger.warn("Invalid input for principal update", { userId: req.user?.id, errors: error.errors });
            return res.status(400).json({ message: "Invalid input", errors: error.errors });
        }
        (0, setup_1.handleError)(res, error, "Failed to update principal");
    }
};
exports.updatePrincipal = updatePrincipal;
const deletePrincipal = async (req, res) => {
    const { id } = req.params;
    try {
        // Delete principal record (this will also handle cascading deletes based on schema)
        await setup_1.prisma.principal.delete({ where: { id } });
        setup_1.logger.info("Principal deleted", { userId: req.user?.id, principalId: id });
        res.status(200).json({ message: "Principal deleted successfully" });
    }
    catch (error) {
        (0, setup_1.handleError)(res, error, "Failed to delete principal");
    }
};
exports.deletePrincipal = deletePrincipal;
const verifyPrincipalSchema = zod_1.z.object({
    status: zod_1.z.enum(["APPROVED", "REJECTED"]).describe("The verification status of the principal"),
    comments: zod_1.z.string().optional().describe("Optional comments for the verification status"),
});
const verifyPrincipal = async (req, res) => {
    const { id } = req.params;
    try {
        // Only school admins and super admins can verify principals
        if (!["SCHOOL_ADMIN", "SUPER_ADMIN"].includes(req.user?.role || "")) {
            return res.status(403).json({
                message: "Only school administrators can verify principals",
            });
        }
        const data = verifyPrincipalSchema.parse(req.body);
        // For non-super admins, ensure they can only verify principals in their school
        let where = { id };
        if (req.user?.role !== "SUPER_ADMIN") {
            where = { ...where, schoolId: req.user?.schoolId };
        }
        const principal = await setup_1.prisma.principal.findUnique({
            where,
            include: { user: true, approval: true },
        });
        if (!principal) {
            return res.status(404).json({ message: "Principal not found" });
        }
        // Update principal approval status
        if (principal.approval) {
            await setup_1.prisma.approval.update({
                where: { principalId: principal.id },
                data: {
                    status: data.status,
                    approvedAt: data.status === "APPROVED" ? new Date() : null,
                    rejectedAt: data.status === "REJECTED" ? new Date() : null,
                    comments: data.comments,
                },
            });
        }
        // Create notification for principal
        const notificationTitle = data.status === "APPROVED" ? "Principal Verification Approved" : "Principal Verification Rejected";
        const notificationContent = data.status === "APPROVED"
            ? "Congratulations! Your principal account has been verified and is now active."
            : `Your principal verification was rejected. ${data.comments || "Please contact your school administration for more information."}`;
        await setup_1.prisma.notification.create({
            data: {
                userId: principal.id,
                title: notificationTitle,
                content: notificationContent,
                type: "APPROVAL",
            },
        });
        setup_1.logger.info("Principal verification updated", {
            userId: req.user?.id,
            principalId: id,
            status: data.status,
            comments: data.comments,
        });
        res.status(200).json({
            message: `Principal ${data.status.toLowerCase()} successfully`,
            principal: {
                id: principal.id,
                user: {
                    name: principal.user.name,
                    surname: principal.user.surname,
                    email: principal.user.email,
                },
                approvalStatus: data.status,
            },
        });
    }
    catch (error) {
        if (error instanceof zod_1.z.ZodError) {
            setup_1.logger.warn("Invalid input for principal verification", {
                userId: req.user?.id,
                errors: error.errors,
            });
            return res.status(400).json({ message: "Invalid input", errors: error.errors });
        }
        (0, setup_1.handleError)(res, error, "Failed to verify principal");
    }
};
exports.verifyPrincipal = verifyPrincipal;
