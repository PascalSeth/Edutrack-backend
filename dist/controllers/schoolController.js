"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getSchoolStats = exports.deleteSchool = exports.uploadAccreditationDocuments = exports.uploadSchoolLogo = exports.verifySchool = exports.updateSchool = exports.registerSchool = exports.getSchoolById = exports.getSchools = void 0;
const zod_1 = require("zod");
const setup_1 = require("../utils/setup");
const supabase_1 = require("../config/supabase");
const bcrypt_1 = __importDefault(require("bcrypt")); // Re-import bcrypt for password hashing
const emailService_1 = require("../utils/emailService");
// Validation Schemas
const registerSchoolSchema = zod_1.z
    .object({
    name: zod_1.z.string().min(1, "School name is required"),
    address: zod_1.z.string().min(1, "Address is required"),
    city: zod_1.z.string().min(1, "City is required"),
    state: zod_1.z.string().min(1, "State is required"),
    country: zod_1.z.string().min(1, "Country is required"),
    postalCode: zod_1.z.string().optional(),
    phone: zod_1.z.string().optional(),
    email: zod_1.z.string().email("Invalid email").optional(),
    website: zod_1.z.string().url("Invalid URL").optional(),
    schoolType: zod_1.z
        .enum(["PRIMARY", "SECONDARY", "MONTESSORI", "INTERNATIONAL", "TECHNICAL", "UNIVERSITY", "OTHER"])
        .optional(),
    missionStatement: zod_1.z.string().optional(),
    virtualTourUrl: zod_1.z.string().url("Invalid URL").optional(),
    // Admin user details - either adminUserId OR all of these must be provided
    adminUserId: zod_1.z.string().uuid("Invalid user ID").optional(),
    adminEmail: zod_1.z.string().email("Invalid admin email").optional(),
    adminUsername: zod_1.z.string().min(3, "Admin username must be at least 3 characters").optional(),
    adminPassword: zod_1.z.string().min(8, "Admin password must be at least 8 characters").optional(),
    adminName: zod_1.z.string().min(1, "Admin name is required").optional(),
    adminSurname: zod_1.z.string().min(1, "Admin surname is required").optional(),
})
    .refine((data) => {
    // Either adminUserId is provided, OR all new admin details except password are provided (password will be generated)
    const hasAdminId = data.adminUserId !== undefined && data.adminUserId !== "";
    const hasNewAdminDetails = data.adminEmail !== undefined &&
        data.adminEmail !== "" &&
        data.adminUsername !== undefined &&
        data.adminUsername !== "" &&
        data.adminName !== undefined &&
        data.adminName !== "" &&
        data.adminSurname !== undefined &&
        data.adminSurname !== "";
    return hasAdminId || hasNewAdminDetails;
}, {
    message: "Either 'adminUserId' must be provided, or all of 'adminEmail', 'adminUsername', 'adminName', and 'adminSurname' must be provided to create a new school admin.",
    path: ["adminUserId", "adminEmail", "adminUsername", "adminName", "adminSurname"],
});
const updateSchoolSchema = zod_1.z.object({
    // Define fields that can be updated here
    name: zod_1.z.string().min(1, "School name is required").optional(),
    address: zod_1.z.string().min(1, "Address is required").optional(),
    city: zod_1.z.string().min(1, "City is required").optional(),
    state: zod_1.z.string().min(1, "State is required").optional(),
    country: zod_1.z.string().min(1, "Country is required").optional(),
    postalCode: zod_1.z.string().optional(),
    phone: zod_1.z.string().optional(),
    email: zod_1.z.string().email("Invalid email").optional(),
    website: zod_1.z.string().url("Invalid URL").optional(),
    schoolType: zod_1.z
        .enum(["PRIMARY", "SECONDARY", "MONTESSORI", "INTERNATIONAL", "TECHNICAL", "UNIVERSITY", "OTHER"])
        .optional(),
    missionStatement: zod_1.z.string().optional(),
    virtualTourUrl: zod_1.z.string().url("Invalid URL").optional(),
});
const verifySchoolSchema = zod_1.z.object({
    status: zod_1.z.enum(["APPROVED", "REJECTED"]).describe("The verification status of the school"),
    comments: zod_1.z.string().optional().describe("Optional comments for the verification status"),
});
const getSchools = async (req, res) => {
    try {
        const { page, limit, skip } = (0, setup_1.getPagination)({
            page: Number.parseInt(req.query.page),
            limit: Number.parseInt(req.query.limit),
        });
        const status = req.query.status;
        const schoolType = req.query.schoolType;
        let where = {};
        // Apply role-based filtering
        if (req.user?.role === "SUPER_ADMIN") {
            // Super admin sees all schools
            where = {
                ...(status && { registrationStatus: status }),
                ...(schoolType && { schoolType: schoolType }),
            };
        }
        else if (req.user?.role === "PARENT") {
            // Parents see only schools where their children are enrolled
            const schoolIds = await (0, setup_1.getParentSchoolIds)(req.user.id);
            where = {
                id: { in: schoolIds },
                ...(status && { registrationStatus: status }),
                ...(schoolType && { schoolType: schoolType }),
            };
        }
        else {
            // School-based roles see only their school
            const filter = (0, setup_1.getTenantFilter)(req.user);
            where = {
                ...filter,
                ...(status && { registrationStatus: status }),
                ...(schoolType && { schoolType: schoolType }),
            };
        }
        const [schools, total] = await Promise.all([
            setup_1.prisma.school.findMany({
                where,
                skip,
                take: limit,
                select: {
                    id: true,
                    name: true,
                    address: true,
                    city: true,
                    state: true,
                    country: true,
                    logoUrl: true,
                    schoolType: true,
                    registrationStatus: true,
                    isVerified: true,
                    createdAt: true,
                    _count: {
                        select: {
                            students: true,
                            teachers: true,
                        },
                    },
                },
                orderBy: { createdAt: "desc" },
            }),
            setup_1.prisma.school.count({ where }),
        ]);
        setup_1.logger.info("Schools retrieved", {
            userId: req.user?.id,
            userRole: req.user?.role,
            page,
            limit,
            total,
        });
        res.status(200).json({
            message: "Schools retrieved successfully",
            schools,
            pagination: (0, setup_1.createPaginationResult)(page, limit, total),
        });
    }
    catch (error) {
        (0, setup_1.handleError)(res, error, "Failed to retrieve schools");
    }
};
exports.getSchools = getSchools;
const getSchoolById = async (req, res) => {
    const { id } = req.params;
    try {
        const filter = (0, setup_1.getTenantFilter)(req.user);
        // For non-super admins, ensure they can only access their own school
        const where = req.user?.role === "SUPER_ADMIN" ? { id } : { id, ...filter };
        const school = await setup_1.prisma.school.findUnique({
            where,
            include: {
                schoolAdmin: true,
                principals: {
                    include: {
                        user: {
                            select: { id: true, name: true, surname: true, email: true },
                        },
                    },
                },
                subscription: true,
                _count: {
                    select: {
                        students: true,
                        teachers: true,
                        classes: true,
                        grades: true,
                    },
                },
            },
        });
        if (!school) {
            setup_1.logger.warn("School not found or access denied", {
                userId: req.user?.id,
                schoolId: id,
                userRole: req.user?.role,
            });
            return res.status(404).json({ message: "School not found" });
        }
        setup_1.logger.info("School retrieved", { userId: req.user?.id, schoolId: id });
        res.status(200).json({ message: "School retrieved successfully", school });
    }
    catch (error) {
        (0, setup_1.handleError)(res, error, "Failed to retrieve school");
    }
};
exports.getSchoolById = getSchoolById;
const registerSchool = async (req, res) => {
    try {
        const data = registerSchoolSchema.parse(req.body);
        setup_1.logger.info("Register school request received", { body: data }); // Log incoming data
        // Check if school with same name already exists
        const existingSchool = await setup_1.prisma.school.findFirst({
            where: {
                name: data.name,
                city: data.city,
                state: data.state,
            },
        });
        if (existingSchool) {
            setup_1.logger.warn("School with same name already exists", { schoolName: data.name, city: data.city, state: data.state });
            return res.status(409).json({
                message: "A school with this name already exists in this location",
            });
        }
        let adminUserIdToLink;
        let generatedAdminCredentials;
        const school = await setup_1.prisma.$transaction(async (tx) => {
            // Create school
            const newSchool = await tx.school.create({
                data: {
                    name: data.name,
                    address: data.address,
                    city: data.city,
                    state: data.state,
                    country: data.country,
                    postalCode: data.postalCode,
                    phone: data.phone,
                    email: data.email,
                    website: data.website,
                    schoolType: data.schoolType,
                    missionStatement: data.missionStatement,
                    virtualTourUrl: data.virtualTourUrl,
                    registrationStatus: "PENDING",
                },
            });
            setup_1.logger.info("New school created within transaction", { schoolId: newSchool.id, schoolName: newSchool.name });
            if (data.adminUserId) {
                setup_1.logger.info("Linking existing admin user", { adminUserId: data.adminUserId });
                const user = await tx.user.findUnique({
                    where: { id: data.adminUserId },
                });
                if (!user) {
                    setup_1.logger.error("Provided admin user not found", { adminUserId: data.adminUserId });
                    throw new Error("Admin user not found. Please provide a valid existing user ID.");
                }
                // Update user role to SCHOOL_ADMIN if not already (and not SUPER_ADMIN)
                if (user.role !== "SCHOOL_ADMIN" && user.role !== "SUPER_ADMIN") {
                    await tx.user.update({
                        where: { id: data.adminUserId },
                        data: { role: "SCHOOL_ADMIN" },
                    });
                    setup_1.logger.info("Updated existing user role to SCHOOL_ADMIN", { userId: data.adminUserId });
                }
                adminUserIdToLink = data.adminUserId;
            }
            else {
                setup_1.logger.info("Creating new admin user for the school.");
                // This check is technically redundant due to Zod's refine, but good for clarity/fallback
                if (!data.adminEmail || !data.adminUsername || !data.adminName || !data.adminSurname) {
                    setup_1.logger.error("Missing details for new school admin user, despite schema validation.");
                    throw new Error("Missing details for new school admin user.");
                }
                // Generate a secure password for the new admin
                const generatedPassword = (0, emailService_1.generatePassword)();
                const passwordHash = await bcrypt_1.default.hash(generatedPassword, 12);
                setup_1.logger.info("Password generated and hashed successfully.");
                const newAdminUser = await tx.user.create({
                    data: {
                        email: data.adminEmail,
                        username: data.adminUsername,
                        passwordHash,
                        name: data.adminName,
                        surname: data.adminSurname,
                        role: "SCHOOL_ADMIN",
                        isActive: true,
                    },
                });
                adminUserIdToLink = newAdminUser.id;
                generatedAdminCredentials = {
                    email: data.adminEmail,
                    username: data.adminUsername,
                    password: generatedPassword,
                };
                setup_1.logger.info("New school admin user created and linked", {
                    adminUserId: newAdminUser.id,
                    email: data.adminEmail,
                    username: data.adminUsername,
                });
            }
            // Create school admin record using the determined adminUserId
            await tx.schoolAdmin.create({
                data: {
                    id: adminUserIdToLink,
                    schoolId: newSchool.id,
                },
            });
            setup_1.logger.info("SchoolAdmin record created", { schoolId: newSchool.id, adminUserId: adminUserIdToLink });
            return newSchool;
        });
        setup_1.logger.info("School registration transaction completed successfully", {
            userId: req.user?.id,
            schoolId: school.id,
            schoolName: school.name,
        });
        // Send welcome email to new admin if credentials were generated
        if (generatedAdminCredentials) {
            try {
                await (0, emailService_1.sendSchoolAdminWelcomeEmail)(generatedAdminCredentials.email, data.adminName, data.adminSurname, school.name, generatedAdminCredentials.password);
                setup_1.logger.info("Welcome email sent to new school admin", {
                    adminEmail: generatedAdminCredentials.email,
                    schoolName: school.name,
                });
            }
            catch (emailError) {
                setup_1.logger.error("Failed to send welcome email to school admin", {
                    adminEmail: generatedAdminCredentials.email,
                    error: emailError instanceof Error ? emailError.message : 'Unknown error',
                });
                // Don't fail the registration if email fails
            }
        }
        res.status(201).json({
            message: "School registered successfully. Awaiting verification.",
            school: {
                id: school.id,
                name: school.name,
                registrationStatus: school.registrationStatus,
            },
            ...(generatedAdminCredentials && { adminCredentials: generatedAdminCredentials }),
        });
    }
    catch (error) {
        if (error instanceof zod_1.z.ZodError) {
            setup_1.logger.warn("Invalid input for school registration", {
                userId: req.user?.id,
                errors: error.errors,
            });
            return res.status(400).json({ message: "Invalid input", errors: error.errors });
        }
        // Catch any other errors, including those from Prisma or bcrypt
        (0, setup_1.handleError)(res, error, "Failed to register school");
    }
};
exports.registerSchool = registerSchool;
const updateSchool = async (req, res) => {
    const { id } = req.params;
    try {
        const data = updateSchoolSchema.parse(req.body);
        const filter = (0, setup_1.getTenantFilter)(req.user);
        // Ensure user can only update their own school (unless super admin)
        const where = req.user?.role === "SUPER_ADMIN" ? { id } : { id, ...filter };
        const school = await setup_1.prisma.school.update({
            where,
            data: {
                ...data,
                updatedAt: new Date(),
            },
        });
        setup_1.logger.info("School updated", {
            userId: req.user?.id,
            schoolId: id,
            updatedFields: Object.keys(data),
        });
        res.status(200).json({
            message: "School updated successfully",
            school,
        });
    }
    catch (error) {
        if (error instanceof zod_1.z.ZodError) {
            setup_1.logger.warn("Invalid input for school update", {
                userId: req.user?.id,
                errors: error.errors,
            });
            return res.status(400).json({ message: "Invalid input", errors: error.errors });
        }
        (0, setup_1.handleError)(res, error, "Failed to update school");
    }
};
exports.updateSchool = updateSchool;
const verifySchool = async (req, res) => {
    const { id } = req.params;
    try {
        // Only super admins can verify schools
        if (req.user?.role !== "SUPER_ADMIN") {
            return res.status(403).json({
                message: "Only super administrators can verify schools",
            });
        }
        const data = verifySchoolSchema.parse(req.body);
        // Include schoolAdmin relation in the query
        const school = await setup_1.prisma.school.update({
            where: { id },
            data: {
                registrationStatus: data.status,
                isVerified: data.status === "APPROVED",
                verifiedAt: data.status === "APPROVED" ? new Date() : null,
                updatedAt: new Date(),
            },
            include: {
                schoolAdmin: true, // Include schoolAdmin to access it in the response
            },
        });
        // Create notification for school admin if one exists
        if (school.schoolAdmin) {
            const notificationTitle = data.status === "APPROVED" ? "School Verification Approved" : "School Verification Rejected";
            const notificationContent = data.status === "APPROVED"
                ? "Congratulations! Your school has been verified and is now active on EduTrack."
                : `Your school verification was rejected. ${data.comments || "Please contact support for more information."}`;
            await setup_1.prisma.notification.create({
                data: {
                    userId: school.schoolAdmin.id,
                    title: notificationTitle,
                    content: notificationContent,
                    type: "APPROVAL",
                },
            });
        }
        setup_1.logger.info("School verification updated", {
            userId: req.user?.id,
            schoolId: id,
            status: data.status,
            comments: data.comments,
        });
        res.status(200).json({
            message: `School ${data.status.toLowerCase()} successfully`,
            school: {
                id: school.id,
                name: school.name,
                registrationStatus: school.registrationStatus,
                isVerified: school.isVerified,
            },
        });
    }
    catch (error) {
        if (error instanceof zod_1.z.ZodError) {
            setup_1.logger.warn("Invalid input for school verification", {
                userId: req.user?.id,
                errors: error.errors,
            });
            return res.status(400).json({ message: "Invalid input", errors: error.errors });
        }
        (0, setup_1.handleError)(res, error, "Failed to verify school");
    }
};
exports.verifySchool = verifySchool;
const uploadSchoolLogo = async (req, res) => {
    const { id } = req.params;
    try {
        if (!req.file) {
            return res.status(400).json({ message: "No file uploaded" });
        }
        const filter = (0, setup_1.getTenantFilter)(req.user);
        const where = req.user?.role === "SUPER_ADMIN" ? { id } : { id, ...filter };
        // Verify school exists and user has access
        const school = await setup_1.prisma.school.findUnique({ where });
        if (!school) {
            return res.status(404).json({ message: "School not found" });
        }
        // Upload logo directly to Supabase
        const { data: logoData, error: uploadError } = await supabase_1.supabase.storage
            .from("school-documents")
            .upload(`/logos/${req.file.originalname}-${Date.now()}`, req.file.buffer, {
            cacheControl: "2592000",
            contentType: req.file.mimetype,
        });
        if (uploadError) {
            throw new Error(uploadError.message);
        }
        // Get public URL
        const { data: urlData } = supabase_1.supabase.storage.from("school-documents").getPublicUrl(logoData.path);
        // Update school with new logo URL
        const updatedSchool = await setup_1.prisma.school.update({
            where: { id },
            data: {
                logoUrl: urlData.publicUrl,
                updatedAt: new Date(),
            },
        });
        // Save file record to database
        await setup_1.prisma.fileStorage.create({
            data: {
                fileName: logoData.path.split("/").pop() || req.file.originalname,
                originalName: req.file.originalname,
                fileSize: req.file.size,
                mimeType: req.file.mimetype,
                fileUrl: urlData.publicUrl,
                bucketName: "school-documents",
                uploadedById: req.user.id,
                schoolId: school.id,
                fileCategory: "SCHOOL_LOGO",
            },
        });
        setup_1.logger.info("School logo uploaded", {
            userId: req.user?.id,
            schoolId: id,
            logoUrl: urlData.publicUrl,
        });
        res.status(200).json({
            message: "School logo uploaded successfully",
            logoUrl: urlData.publicUrl,
            school: updatedSchool,
        });
    }
    catch (error) {
        (0, setup_1.handleError)(res, error, "Failed to upload school logo");
    }
};
exports.uploadSchoolLogo = uploadSchoolLogo;
const uploadAccreditationDocuments = async (req, res) => {
    const { id } = req.params;
    try {
        if (!req.files || !Array.isArray(req.files) || req.files.length === 0) {
            return res.status(400).json({ message: "No files uploaded" });
        }
        const filter = (0, setup_1.getTenantFilter)(req.user);
        const where = req.user?.role === "SUPER_ADMIN" ? { id } : { id, ...filter };
        // Verify school exists and user has access
        const school = await setup_1.prisma.school.findUnique({ where });
        if (!school) {
            return res.status(404).json({ message: "School not found" });
        }
        // Upload all documents
        const uploadPromises = req.files.map(async (file, index) => {
            const { data: docData, error: uploadError } = await supabase_1.supabase.storage
                .from("school-documents")
                .upload(`/accreditation/${school.id}/document-${index + 1}-${Date.now()}-${file.originalname}`, file.buffer, {
                cacheControl: "2592000",
                contentType: file.mimetype,
            });
            if (uploadError) {
                throw new Error(uploadError.message);
            }
            // Get public URL
            const { data: urlData } = supabase_1.supabase.storage.from("school-documents").getPublicUrl(docData.path);
            // Save file record to database
            await setup_1.prisma.fileStorage.create({
                data: {
                    fileName: docData.path.split("/").pop() || file.originalname,
                    originalName: file.originalname,
                    fileSize: file.size,
                    mimeType: file.mimetype,
                    fileUrl: urlData.publicUrl,
                    bucketName: "school-documents",
                    uploadedById: req.user.id,
                    schoolId: school.id,
                    fileCategory: "ACCREDITATION",
                },
            });
            return urlData.publicUrl;
        });
        const documentUrls = await Promise.all(uploadPromises);
        // Update school with accreditation documents
        const updatedSchool = await setup_1.prisma.school.update({
            where: { id },
            data: {
                accreditationDocuments: [...school.accreditationDocuments, ...documentUrls],
                updatedAt: new Date(),
            },
        });
        setup_1.logger.info("Accreditation documents uploaded", {
            userId: req.user?.id,
            schoolId: id,
            documentCount: documentUrls.length,
        });
        res.status(200).json({
            message: "Accreditation documents uploaded successfully",
            documentUrls,
            school: updatedSchool,
        });
    }
    catch (error) {
        (0, setup_1.handleError)(res, error, "Failed to upload accreditation documents");
    }
};
exports.uploadAccreditationDocuments = uploadAccreditationDocuments;
const deleteSchool = async (req, res) => {
    const { id } = req.params;
    try {
        // Only super admins can delete schools
        if (req.user?.role !== "SUPER_ADMIN") {
            return res.status(403).json({
                message: "Only super administrators can delete schools",
            });
        }
        // Get school data before deletion for cleanup
        const school = await setup_1.prisma.school.findUnique({
            where: { id },
            select: {
                logoUrl: true,
                accreditationDocuments: true,
            },
        });
        if (!school) {
            return res.status(404).json({ message: "School not found" });
        }
        // Delete school (cascade will handle related records)
        await setup_1.prisma.school.delete({ where: { id } });
        // TODO: Clean up files from Supabase storage
        // This would involve deleting logo and accreditation documents
        setup_1.logger.info("School deleted", {
            userId: req.user?.id,
            schoolId: id,
        });
        res.status(200).json({ message: "School deleted successfully" });
    }
    catch (error) {
        (0, setup_1.handleError)(res, error, "Failed to delete school");
    }
};
exports.deleteSchool = deleteSchool;
const getSchoolStats = async (req, res) => {
    const { id } = req.params;
    try {
        const filter = (0, setup_1.getTenantFilter)(req.user);
        const where = req.user?.role === "SUPER_ADMIN" ? { id } : { id, ...filter };
        const school = await setup_1.prisma.school.findUnique({
            where,
            include: {
                _count: {
                    select: {
                        students: true,
                        teachers: true,
                        classes: true,
                        grades: true,
                        subjects: true,
                        events: true,
                        announcements: true,
                        payments: true,
                    },
                },
            },
        });
        if (!school) {
            return res.status(404).json({ message: "School not found" });
        }
        // Get parent count separately through students
        const parentCount = await setup_1.prisma.parent.count({
            where: {
                children: {
                    some: {
                        schoolId: id,
                    },
                },
            },
        });
        // Get additional stats
        const [totalRevenue, pendingPayments, recentActivity] = await Promise.all([
            setup_1.prisma.payment.aggregate({
                where: {
                    schoolId: id,
                    status: "COMPLETED",
                },
                _sum: { amount: true },
            }),
            setup_1.prisma.payment.count({
                where: {
                    schoolId: id,
                    status: "PENDING",
                },
            }),
            setup_1.prisma.notification.count({
                where: {
                    user: {
                        OR: [
                            { teacher: { schoolId: id } },
                            {
                                parent: {
                                    children: {
                                        some: {
                                            schoolId: id,
                                        },
                                    },
                                },
                            },
                            { principal: { schoolId: id } },
                            { schoolAdmin: { schoolId: id } },
                        ],
                    },
                    createdAt: {
                        gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000), // Last 7 days
                    },
                },
            }),
        ]);
        const stats = {
            school: {
                id: school.id,
                name: school.name,
                registrationStatus: school.registrationStatus,
                isVerified: school.isVerified,
            },
            counts: {
                ...school._count,
                parents: parentCount, // Add parent count separately
            },
            financial: {
                totalRevenue: totalRevenue._sum.amount || 0,
                pendingPayments,
            },
            activity: {
                recentNotifications: recentActivity,
            },
        };
        setup_1.logger.info("School stats retrieved", {
            userId: req.user?.id,
            schoolId: id,
        });
        res.status(200).json({
            message: "School statistics retrieved successfully",
            stats,
        });
    }
    catch (error) {
        (0, setup_1.handleError)(res, error, "Failed to retrieve school statistics");
    }
};
exports.getSchoolStats = getSchoolStats;
