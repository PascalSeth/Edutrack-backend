"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.resetPassword = exports.requestPasswordReset = exports.logout = exports.refreshToken = exports.login = exports.register = void 0;
const zod_1 = require("zod");
const bcrypt_1 = __importDefault(require("bcrypt"));
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const setup_1 = require("../utils/setup");
// Enhanced validation schemas
const registerSchema = zod_1.z
    .object({
    email: zod_1.z.string().email("Invalid email").min(1, "Email is required"),
    username: zod_1.z.string().min(3, "Username must be at least 3 characters"),
    password: zod_1.z.string().min(8, "Password must be at least 8 characters"),
    name: zod_1.z.string().min(1, "Name is required"),
    surname: zod_1.z.string().min(1, "Surname is required"),
    role: zod_1.z.enum(["SUPER_ADMIN", "SCHOOL_ADMIN", "PRINCIPAL", "TEACHER", "PARENT"], { message: "Invalid role" }),
    phone: zod_1.z.string().optional(),
    address: zod_1.z.string().optional(),
    // Make schoolId optional but validate it based on role
    schoolId: zod_1.z.string().uuid("Invalid school ID").optional(),
    qualifications: zod_1.z.string().optional(),
    bio: zod_1.z.string().optional(),
    childDetails: zod_1.z
        .array(zod_1.z.object({
        name: zod_1.z.string(),
        surname: zod_1.z.string(),
        studentId: zod_1.z.string().optional(),
        class: zod_1.z.string().optional(),
    }))
        .optional(),
})
    .refine((data) => {
    // SUPER_ADMIN and PARENT don't need schoolId, all others do
    if (data.role === "SUPER_ADMIN" || data.role === "PARENT") {
        return true; // No schoolId validation needed
    }
    return data.schoolId !== undefined; // All other roles require schoolId
}, {
    message: "School ID is required for SCHOOL_ADMIN, PRINCIPAL, and TEACHER roles",
    path: ["schoolId"],
});
const loginSchema = zod_1.z.object({
    email: zod_1.z.string().email("Invalid email").min(1, "Email is required"),
    password: zod_1.z.string().min(1, "Password is required"),
});
const refreshTokenSchema = zod_1.z.object({
    refreshToken: zod_1.z.string().min(1, "Refresh token is required"),
});
const requestPasswordResetSchema = zod_1.z.object({
    email: zod_1.z.string().email("Invalid email").min(1, "Email is required"),
});
const resetPasswordSchema = zod_1.z.object({
    token: zod_1.z.string().min(1, "Reset token is required"),
    newPassword: zod_1.z.string().min(8, "Password must be at least 8 characters"),
});
const generateTokens = (user) => {
    const accessToken = jsonwebtoken_1.default.sign({
        id: user.id,
        role: user.role,
        ...(user.schoolId ? { schoolId: user.schoolId } : {}),
        ...(user.tenantId ? { tenantId: user.tenantId } : {}),
    }, process.env.JWT_SECRET, { expiresIn: "15m" });
    const refreshToken = jsonwebtoken_1.default.sign({
        id: user.id,
        role: user.role,
        ...(user.schoolId ? { schoolId: user.schoolId } : {}),
        ...(user.tenantId ? { tenantId: user.tenantId } : {}),
    }, process.env.JWT_REFRESH_SECRET, { expiresIn: "7d" });
    return { accessToken, refreshToken };
};
const register = async (req, res) => {
    try {
        const data = registerSchema.parse(req.body);
        // Check if user already exists
        const existingUser = await setup_1.prisma.user.findFirst({
            where: {
                OR: [{ email: data.email }, { username: data.username }],
            },
        });
        if (existingUser) {
            setup_1.logger.warn("Registration failed: Email or username already exists", {
                email: data.email,
                username: data.username,
            });
            return res.status(409).json({ message: "Email or username already exists" });
        }
        // Validate school exists if schoolId provided (not needed for SUPER_ADMIN and PARENT)
        let school = null;
        if (data.schoolId) {
            school = await setup_1.prisma.school.findUnique({
                where: { id: data.schoolId },
            });
            if (!school) {
                return res.status(400).json({ message: "School not found" });
            }
            if (!school.isVerified) {
                return res.status(400).json({ message: "School is not verified" });
            }
        }
        const passwordHash = await bcrypt_1.default.hash(data.password, 12);
        const user = await setup_1.prisma.$transaction(async (tx) => {
            // Create user
            const newUser = await tx.user.create({
                data: {
                    email: data.email,
                    username: data.username,
                    passwordHash,
                    name: data.name,
                    surname: data.surname,
                    role: data.role,
                    phone: data.phone,
                    address: data.address,
                },
            });
            // Create role-specific records
            switch (data.role) {
                case "SUPER_ADMIN":
                    // SUPER_ADMIN doesn't need any additional role-specific records
                    // and doesn't need to be tied to a specific school
                    break;
                case "SCHOOL_ADMIN":
                    if (!data.schoolId)
                        throw new Error("schoolId is required for School Admin");
                    await tx.schoolAdmin.create({
                        data: {
                            id: newUser.id,
                            schoolId: data.schoolId,
                        },
                    });
                    break;
                case "PRINCIPAL":
                    if (!data.schoolId)
                        throw new Error("schoolId is required for Principal");
                    const principalRecord = await tx.principal.create({
                        data: {
                            id: newUser.id,
                            schoolId: data.schoolId,
                            qualifications: data.qualifications,
                            bio: data.bio,
                        },
                    });
                    await tx.approval.create({
                        data: {
                            principalId: principalRecord.id,
                            status: "PENDING",
                        },
                    });
                    break;
                case "TEACHER":
                    if (!data.schoolId)
                        throw new Error("schoolId is required for Teacher");
                    const teacherRecord = await tx.teacher.create({
                        data: {
                            id: newUser.id,
                            schoolId: data.schoolId,
                            qualifications: data.qualifications,
                            bio: data.bio,
                            approvalStatus: "PENDING",
                        },
                    });
                    await tx.approval.create({
                        data: {
                            teacherId: teacherRecord.id,
                            status: "PENDING",
                        },
                    });
                    break;
                case "PARENT":
                    // Parents don't need schoolId - they can have children in multiple schools
                    await tx.parent.create({
                        data: {
                            id: newUser.id,
                            verificationStatus: "PENDING",
                        },
                    });
                    break;
            }
            return newUser;
        });
        // Generate tokens with school context (SUPER_ADMIN and PARENT won't have school context initially)
        let tokenPayload = { id: user.id, role: user.role };
        if (school) {
            tokenPayload = {
                ...tokenPayload,
                schoolId: school.id,
                tenantId: school.tenantId,
            };
        }
        const { accessToken, refreshToken } = generateTokens(tokenPayload);
        // Store refresh token
        await setup_1.prisma.deviceToken.create({
            data: {
                token: refreshToken,
                deviceType: "WEB",
                userId: user.id,
            },
        });
        // Send welcome notification
        const welcomeMessage = data.role === "SUPER_ADMIN"
            ? "Welcome to EduTrack! Your Super Admin account has been created successfully."
            : data.role === "PARENT"
                ? "Welcome to EduTrack! Your parent account has been created successfully. You can now add your children from different schools."
                : `Welcome ${user.name}! Your account has been created successfully. ${["PRINCIPAL", "TEACHER"].includes(user.role)
                    ? "Your account is pending approval from the school administration."
                    : ""}`;
        await (0, setup_1.createNotification)(user.id, "Welcome to EduTrack!", welcomeMessage, "GENERAL");
        setup_1.logger.info("User registered", {
            userId: user.id,
            role: user.role,
            schoolId: data.schoolId,
            isSuperAdmin: user.role === "SUPER_ADMIN",
            isParent: user.role === "PARENT",
        });
        res.status(201).json({
            message: "User registered successfully",
            user: {
                id: user.id,
                email: user.email,
                role: user.role,
                needsApproval: ["PRINCIPAL", "TEACHER"].includes(user.role),
                isSuperAdmin: user.role === "SUPER_ADMIN",
                isParent: user.role === "PARENT",
            },
            accessToken,
            refreshToken,
        });
    }
    catch (error) {
        if (error instanceof zod_1.z.ZodError) {
            setup_1.logger.warn("Invalid input for registration", { errors: error.errors });
            return res.status(400).json({ message: "Invalid input", errors: error.errors });
        }
        (0, setup_1.handleError)(res, error, "Failed to register user");
    }
};
exports.register = register;
const login = async (req, res) => {
    try {
        const data = loginSchema.parse(req.body);
        const user = await setup_1.prisma.user.findUnique({
            where: { email: data.email },
            include: {
                schoolAdmin: { include: { school: true } },
                principal: { include: { school: true, approval: true } },
                teacher: { include: { school: true, approval: true } },
                parent: true, // Parent doesn't have a single school relationship
            },
        });
        if (!user) {
            setup_1.logger.warn("Login failed: User not found", { email: data.email });
            return res.status(401).json({ message: "Invalid credentials" });
        }
        if (!user.isActive) {
            setup_1.logger.warn("Login failed: User account is inactive", { email: data.email });
            return res.status(401).json({ message: "Account is inactive" });
        }
        const isValidPassword = await bcrypt_1.default.compare(data.password, user.passwordHash);
        if (!isValidPassword) {
            setup_1.logger.warn("Login failed: Invalid password", { email: data.email });
            return res.status(401).json({ message: "Invalid credentials" });
        }
        // Check approval status for roles that require it
        let approvalStatus = null;
        let school = null;
        // SUPER_ADMIN and PARENT don't have single school associations
        if (user.role === "SUPER_ADMIN") {
            school = null;
            approvalStatus = "APPROVED"; // SUPER_ADMIN is automatically approved
        }
        else if (user.role === "PARENT") {
            school = null;
            approvalStatus = user.parent?.verificationStatus || "PENDING";
        }
        else if (user.principal) {
            school = user.principal.school;
            approvalStatus = user.principal.approval?.status || "PENDING";
        }
        else if (user.teacher) {
            school = user.teacher.school;
            approvalStatus = user.teacher.approval?.status || "PENDING";
        }
        else if (user.schoolAdmin) {
            school = user.schoolAdmin.school;
            approvalStatus = "APPROVED"; // School admins are automatically approved
        }
        // Check if school is verified (except for super admin and parent)
        if (school && !school.isVerified && !["SUPER_ADMIN", "PARENT"].includes(user.role)) {
            return res.status(403).json({
                message: "School is not verified. Please contact support.",
            });
        }
        // Generate tokens with school context (SUPER_ADMIN and PARENT won't have school context)
        let tokenPayload = { id: user.id, role: user.role };
        if (school) {
            tokenPayload = {
                ...tokenPayload,
                schoolId: school.id,
                tenantId: school.tenantId,
            };
        }
        const { accessToken, refreshToken } = generateTokens(tokenPayload);
        // Store refresh token
        await setup_1.prisma.deviceToken.create({
            data: {
                token: refreshToken,
                deviceType: "WEB",
                userId: user.id,
            },
        });
        // Update last login
        await setup_1.prisma.user.update({
            where: { id: user.id },
            data: { lastLogin: new Date() },
        });
        // For parents, get summary of their children across schools
        let childrenSummary = null;
        if (user.role === "PARENT") {
            const children = await setup_1.prisma.student.findMany({
                where: { parentId: user.id },
                include: {
                    school: { select: { id: true, name: true } },
                },
            });
            const schoolsMap = new Map();
            children.forEach((child) => {
                if (!schoolsMap.has(child.school.id)) {
                    schoolsMap.set(child.school.id, {
                        school: child.school,
                        childrenCount: 0,
                    });
                }
                schoolsMap.get(child.school.id).childrenCount++;
            });
            childrenSummary = {
                totalChildren: children.length,
                schoolsCount: schoolsMap.size,
                schools: Array.from(schoolsMap.values()),
            };
        }
        setup_1.logger.info("User logged in", {
            userId: user.id,
            role: user.role,
            schoolId: school?.id,
            isSuperAdmin: user.role === "SUPER_ADMIN",
            isParent: user.role === "PARENT",
        });
        res.status(200).json({
            message: "Login successful",
            user: {
                id: user.id,
                email: user.email,
                name: user.name,
                surname: user.surname,
                role: user.role,
                schoolId: school?.id,
                schoolName: school?.name,
                approvalStatus,
                profileImageUrl: user.profileImageUrl,
                isSuperAdmin: user.role === "SUPER_ADMIN",
                isParent: user.role === "PARENT",
                ...(childrenSummary && { childrenSummary }),
            },
            accessToken,
            refreshToken,
        });
    }
    catch (error) {
        if (error instanceof zod_1.z.ZodError) {
            setup_1.logger.warn("Invalid input for login", { errors: error.errors });
            return res.status(400).json({ message: "Invalid input", errors: error.errors });
        }
        (0, setup_1.handleError)(res, error, "Failed to login");
    }
};
exports.login = login;
const refreshToken = async (req, res) => {
    try {
        const data = refreshTokenSchema.parse(req.body);
        let decoded;
        try {
            decoded = jsonwebtoken_1.default.verify(data.refreshToken, process.env.JWT_REFRESH_SECRET);
        }
        catch (error) {
            setup_1.logger.warn("Invalid refresh token", { refreshToken: data.refreshToken });
            return res.status(401).json({ message: "Invalid refresh token" });
        }
        // Verify token exists in database
        const storedToken = await setup_1.prisma.deviceToken.findUnique({
            where: { token: data.refreshToken },
        });
        if (!storedToken || !storedToken.isActive) {
            setup_1.logger.warn("Refresh token not found or inactive", { refreshToken: data.refreshToken });
            return res.status(401).json({ message: "Invalid refresh token" });
        }
        // Verify user still exists and is active
        const user = await setup_1.prisma.user.findUnique({
            where: { id: decoded.id },
            include: {
                schoolAdmin: { include: { school: true } },
                principal: { include: { school: true } },
                teacher: { include: { school: true } },
                parent: true, // Parent doesn't have a single school
            },
        });
        if (!user || !user.isActive) {
            setup_1.logger.warn("User not found or inactive for refresh token", { userId: decoded.id });
            return res.status(401).json({ message: "User not found" });
        }
        // Update school context if needed (SUPER_ADMIN and PARENT won't have school context)
        let school = null;
        if (!["SUPER_ADMIN", "PARENT"].includes(user.role)) {
            if (user.schoolAdmin)
                school = user.schoolAdmin.school;
            else if (user.principal)
                school = user.principal.school;
            else if (user.teacher)
                school = user.teacher.school;
        }
        let tokenPayload = { id: user.id, role: user.role };
        if (school) {
            tokenPayload = {
                ...tokenPayload,
                schoolId: school.id,
                tenantId: school.tenantId,
            };
        }
        const accessToken = jsonwebtoken_1.default.sign(tokenPayload, process.env.JWT_SECRET, {
            expiresIn: "15m",
        });
        // Update token last used
        await setup_1.prisma.deviceToken.update({
            where: { token: data.refreshToken },
            data: { lastUsed: new Date() },
        });
        setup_1.logger.info("Access token refreshed", {
            userId: user.id,
            isSuperAdmin: user.role === "SUPER_ADMIN",
            isParent: user.role === "PARENT",
        });
        res.status(200).json({
            message: "Token refreshed successfully",
            accessToken,
        });
    }
    catch (error) {
        if (error instanceof zod_1.z.ZodError) {
            setup_1.logger.warn("Invalid input for token refresh", { errors: error.errors });
            return res.status(400).json({ message: "Invalid input", errors: error.errors });
        }
        (0, setup_1.handleError)(res, error, "Failed to refresh token");
    }
};
exports.refreshToken = refreshToken;
const logout = async (req, res) => {
    try {
        const refreshToken = req.body.refreshToken;
        if (!refreshToken) {
            setup_1.logger.warn("No refresh token provided for logout", { userId: req.user?.id });
            return res.status(400).json({ message: "Refresh token required" });
        }
        // Deactivate the refresh token
        await setup_1.prisma.deviceToken.updateMany({
            where: {
                token: refreshToken,
                userId: req.user?.id,
            },
            data: { isActive: false },
        });
        setup_1.logger.info("User logged out", { userId: req.user?.id });
        res.status(200).json({ message: "Logout successful" });
    }
    catch (error) {
        (0, setup_1.handleError)(res, error, "Failed to logout");
    }
};
exports.logout = logout;
const requestPasswordReset = async (req, res) => {
    try {
        const data = requestPasswordResetSchema.parse(req.body);
        const user = await setup_1.prisma.user.findUnique({ where: { email: data.email } });
        if (!user) {
            setup_1.logger.warn("Password reset requested for non-existent email", { email: data.email });
            return res.status(200).json({
                message: "If the email exists, a reset link will be sent",
            });
        }
        const resetToken = jsonwebtoken_1.default.sign({ id: user.id, email: user.email }, process.env.JWT_RESET_SECRET, { expiresIn: "1h" });
        setup_1.logger.info("Password reset token generated", {
            userId: user.id,
            email: user.email,
        });
        res.status(200).json({
            message: "Password reset token generated",
            resetToken, // Remove in production
        });
    }
    catch (error) {
        if (error instanceof zod_1.z.ZodError) {
            setup_1.logger.warn("Invalid input for password reset request", { errors: error.errors });
            return res.status(400).json({ message: "Invalid input", errors: error.errors });
        }
        (0, setup_1.handleError)(res, error, "Failed to request password reset");
    }
};
exports.requestPasswordReset = requestPasswordReset;
const resetPassword = async (req, res) => {
    try {
        const data = resetPasswordSchema.parse(req.body);
        let decoded;
        try {
            decoded = jsonwebtoken_1.default.verify(data.token, process.env.JWT_RESET_SECRET);
        }
        catch (error) {
            setup_1.logger.warn("Invalid reset token", { token: data.token });
            return res.status(401).json({ message: "Invalid or expired reset token" });
        }
        const user = await setup_1.prisma.user.findUnique({
            where: {
                id: decoded.id,
                email: decoded.email,
            },
        });
        if (!user) {
            setup_1.logger.warn("User not found for password reset", { userId: decoded.id });
            return res.status(404).json({ message: "User not found" });
        }
        const passwordHash = await bcrypt_1.default.hash(data.newPassword, 12);
        await setup_1.prisma.$transaction(async (tx) => {
            await tx.user.update({
                where: { id: user.id },
                data: { passwordHash },
            });
            await tx.deviceToken.updateMany({
                where: { userId: user.id },
                data: { isActive: false },
            });
        });
        await (0, setup_1.createNotification)(user.id, "Password Reset Successful", "Your password has been reset successfully. If you did not request this change, please contact support immediately.", "GENERAL");
        setup_1.logger.info("Password reset successful", { userId: user.id });
        res.status(200).json({ message: "Password reset successfully" });
    }
    catch (error) {
        if (error instanceof zod_1.z.ZodError) {
            setup_1.logger.warn("Invalid input for password reset", { errors: error.errors });
            return res.status(400).json({ message: "Invalid input", errors: error.errors });
        }
        (0, setup_1.handleError)(res, error, "Failed to reset password");
    }
};
exports.resetPassword = resetPassword;
