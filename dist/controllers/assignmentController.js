"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getStudentAssignments = exports.submitAssignment = exports.uploadAssignmentFiles = exports.deleteAssignment = exports.updateAssignment = exports.createAssignment = exports.getAssignmentById = exports.getAssignments = void 0;
const zod_1 = require("zod");
const setup_1 = require("../utils/setup");
const supabase_1 = require("../config/supabase");
// Validation Schemas
const createAssignmentSchema = zod_1.z.object({
    title: zod_1.z.string().min(1, "Title is required"),
    description: zod_1.z.string().optional(),
    instructions: zod_1.z.string().optional(),
    startDate: zod_1.z.string().datetime("Invalid start date"),
    dueDate: zod_1.z.string().datetime("Invalid due date"),
    maxScore: zod_1.z.number().int().min(0).optional(),
    subjectId: zod_1.z.string().uuid("Invalid subject ID"),
    classId: zod_1.z.string().uuid("Invalid class ID").optional(),
    assignmentType: zod_1.z.enum(["INDIVIDUAL", "GROUP", "CLASS_WIDE"]).default("INDIVIDUAL"),
});
const updateAssignmentSchema = createAssignmentSchema.partial();
const submitAssignmentSchema = zod_1.z.object({
    comments: zod_1.z.string().optional(),
});
const getAssignments = async (req, res) => {
    try {
        const page = Number.parseInt(req.query.page) || 1;
        const limit = Number.parseInt(req.query.limit) || 10;
        const skip = (page - 1) * limit;
        // Filter by class if specified
        const classId = req.query.classId;
        const subjectId = req.query.subjectId;
        const status = req.query.status;
        let where = {};
        // Apply tenant filtering based on user role
        if (req.user?.role === "SUPER_ADMIN") {
            // Super admin sees all assignments
            where = {};
        }
        else if (req.user?.role === "TEACHER") {
            // Teachers see only their assignments
            where = {
                teacherId: req.user.id,
                ...(0, setup_1.getTenantFilter)(req.user),
            };
        }
        else if (req.user?.role === "PRINCIPAL" || req.user?.role === "SCHOOL_ADMIN") {
            // School staff see assignments in their school
            where = (0, setup_1.getTenantFilter)(req.user);
        }
        else if (req.user?.role === "PARENT") {
            // Parents see assignments for their children's classes
            const schoolIds = await (0, setup_1.getParentSchoolIds)(req.user.id);
            where = {
                schoolId: { in: schoolIds },
                OR: [
                    {
                        class: {
                            students: {
                                some: { parentId: req.user.id },
                            },
                        },
                    },
                    {
                        assignmentType: "CLASS_WIDE",
                        schoolId: { in: schoolIds },
                    },
                ],
            };
        }
        // Apply additional filters
        if (classId)
            where.classId = classId;
        if (subjectId)
            where.subjectId = subjectId;
        if (status === "upcoming")
            where.startDate = { gt: new Date() };
        if (status === "active") {
            where.startDate = { lte: new Date() };
            where.dueDate = { gte: new Date() };
        }
        if (status === "overdue")
            where.dueDate = { lt: new Date() };
        const [assignments, total] = await Promise.all([
            setup_1.prisma.assignment.findMany({
                where,
                skip,
                take: limit,
                include: {
                    subject: { select: { name: true, code: true } },
                    class: { select: { name: true } },
                    school: { select: { name: true } },
                    teacher: {
                        include: {
                            user: { select: { name: true, surname: true } },
                        },
                    },
                    _count: { select: { submissions: true } },
                },
                orderBy: { dueDate: "asc" },
            }),
            setup_1.prisma.assignment.count({ where }),
        ]);
        setup_1.logger.info("Assignments retrieved", {
            userId: req.user?.id,
            userRole: req.user?.role,
            page,
            limit,
            total,
            filters: { classId, subjectId, status },
        });
        res.status(200).json({
            message: "Assignments retrieved successfully",
            assignments,
            pagination: { page, limit, total, pages: Math.ceil(total / limit) },
        });
    }
    catch (error) {
        (0, setup_1.handleError)(res, error, "Failed to retrieve assignments");
    }
};
exports.getAssignments = getAssignments;
const getAssignmentById = async (req, res) => {
    const { id } = req.params;
    try {
        const filter = (0, setup_1.getTenantFilter)(req.user);
        const assignment = await setup_1.prisma.assignment.findFirst({
            where: { id, ...filter },
            include: {
                subject: { select: { name: true, code: true } },
                class: {
                    select: {
                        name: true,
                        students: req.user?.role === "PARENT"
                            ? {
                                where: { parentId: req.user.id },
                                select: { id: true, name: true, surname: true },
                            }
                            : { select: { id: true, name: true, surname: true } },
                    },
                },
                teacher: {
                    include: {
                        user: { select: { name: true, surname: true, email: true } },
                    },
                },
                submissions: {
                    include: {
                        student: { select: { name: true, surname: true } },
                    },
                },
                approval: true,
            },
        });
        if (!assignment) {
            setup_1.logger.warn("Assignment not found", { userId: req.user?.id, assignmentId: id });
            return res.status(404).json({ message: "Assignment not found" });
        }
        setup_1.logger.info("Assignment retrieved", { userId: req.user?.id, assignmentId: id });
        res.status(200).json({
            message: "Assignment retrieved successfully",
            assignment,
        });
    }
    catch (error) {
        (0, setup_1.handleError)(res, error, "Failed to retrieve assignment");
    }
};
exports.getAssignmentById = getAssignmentById;
const createAssignment = async (req, res) => {
    try {
        const data = createAssignmentSchema.parse(req.body);
        // Verify teacher has access to subject and class
        const [subject, classRecord] = await Promise.all([
            setup_1.prisma.subject.findFirst({
                where: {
                    id: data.subjectId,
                    ...(0, setup_1.getTenantFilter)(req.user),
                    ...(req.user?.role === "TEACHER" && {
                        teachers: { some: { id: req.user.id } },
                    }),
                },
            }),
            data.classId
                ? setup_1.prisma.class.findFirst({
                    where: {
                        id: data.classId,
                        ...(0, setup_1.getTenantFilter)(req.user),
                    },
                })
                : null,
        ]);
        if (!subject) {
            return res.status(404).json({ message: "Subject not found or access denied" });
        }
        if (data.classId && !classRecord) {
            return res.status(404).json({ message: "Class not found" });
        }
        const assignment = await setup_1.prisma.assignment.create({
            data: {
                title: data.title,
                description: data.description,
                instructions: data.instructions,
                startDate: new Date(data.startDate),
                dueDate: new Date(data.dueDate),
                maxScore: data.maxScore,
                subjectId: data.subjectId,
                classId: data.classId,
                teacherId: req.user.id,
                schoolId: req.user.schoolId,
                assignmentType: data.assignmentType,
            },
            include: {
                subject: { select: { name: true } },
                class: { select: { name: true } },
            },
        });
        // Create notifications for parents if class is specified
        if (data.classId) {
            const students = await setup_1.prisma.student.findMany({
                where: { classId: data.classId },
                include: { parent: { include: { user: true } } },
            });
            const notificationPromises = students.map((student) => (0, setup_1.createNotification)(student.parent.user.id, "New Assignment Posted", `A new assignment "${data.title}" has been posted for ${student.name} in ${subject.name}. Due date: ${new Date(data.dueDate).toLocaleDateString()}`, "ASSIGNMENT", { assignmentId: assignment.id, studentId: student.id }));
            await Promise.all(notificationPromises);
        }
        setup_1.logger.info("Assignment created", {
            userId: req.user?.id,
            assignmentId: assignment.id,
            classId: data.classId,
            studentsNotified: data.classId ? "yes" : "no",
        });
        res.status(201).json({
            message: "Assignment created successfully",
            assignment,
        });
    }
    catch (error) {
        if (error instanceof zod_1.z.ZodError) {
            setup_1.logger.warn("Invalid input for assignment creation", {
                userId: req.user?.id,
                errors: error.errors,
            });
            return res.status(400).json({ message: "Invalid input", errors: error.errors });
        }
        (0, setup_1.handleError)(res, error, "Failed to create assignment");
    }
};
exports.createAssignment = createAssignment;
const updateAssignment = async (req, res) => {
    const { id } = req.params;
    try {
        const data = updateAssignmentSchema.parse(req.body);
        const filter = (0, setup_1.getTenantFilter)(req.user);
        // Verify assignment exists and user has permission
        const existingAssignment = await setup_1.prisma.assignment.findFirst({
            where: {
                id,
                ...filter,
                ...(req.user?.role === "TEACHER" && { teacherId: req.user.id }),
            },
        });
        if (!existingAssignment) {
            return res.status(404).json({ message: "Assignment not found or access denied" });
        }
        const assignment = await setup_1.prisma.assignment.update({
            where: { id },
            data: {
                ...(data.title && { title: data.title }),
                ...(data.description && { description: data.description }),
                ...(data.instructions && { instructions: data.instructions }),
                ...(data.startDate && { startDate: new Date(data.startDate) }),
                ...(data.dueDate && { dueDate: new Date(data.dueDate) }),
                ...(data.maxScore !== undefined && { maxScore: data.maxScore }),
                ...(data.assignmentType && { assignmentType: data.assignmentType }),
                updatedAt: new Date(),
            },
            include: {
                subject: { select: { name: true } },
                class: { select: { name: true } },
            },
        });
        setup_1.logger.info("Assignment updated", { userId: req.user?.id, assignmentId: id });
        res.status(200).json({
            message: "Assignment updated successfully",
            assignment,
        });
    }
    catch (error) {
        if (error instanceof zod_1.z.ZodError) {
            return res.status(400).json({ message: "Invalid input", errors: error.errors });
        }
        (0, setup_1.handleError)(res, error, "Failed to update assignment");
    }
};
exports.updateAssignment = updateAssignment;
const deleteAssignment = async (req, res) => {
    const { id } = req.params;
    try {
        const filter = (0, setup_1.getTenantFilter)(req.user);
        // Verify assignment exists and user has permission
        const assignment = await setup_1.prisma.assignment.findFirst({
            where: {
                id,
                ...filter,
                ...(req.user?.role === "TEACHER" && { teacherId: req.user.id }),
            },
        });
        if (!assignment) {
            return res.status(404).json({ message: "Assignment not found or access denied" });
        }
        await setup_1.prisma.assignment.delete({ where: { id } });
        setup_1.logger.info("Assignment deleted", { userId: req.user?.id, assignmentId: id });
        res.status(200).json({ message: "Assignment deleted successfully" });
    }
    catch (error) {
        (0, setup_1.handleError)(res, error, "Failed to delete assignment");
    }
};
exports.deleteAssignment = deleteAssignment;
const uploadAssignmentFiles = async (req, res) => {
    const { id } = req.params;
    try {
        if (!req.files || !Array.isArray(req.files) || req.files.length === 0) {
            return res.status(400).json({ message: "No files uploaded" });
        }
        const filter = (0, setup_1.getTenantFilter)(req.user);
        const assignment = await setup_1.prisma.assignment.findFirst({
            where: {
                id,
                ...filter,
                ...(req.user?.role === "TEACHER" && { teacherId: req.user.id }),
            },
        });
        if (!assignment) {
            return res.status(404).json({ message: "Assignment not found or access denied" });
        }
        // Upload files directly to Supabase
        const uploadPromises = req.files.map(async (file, index) => {
            const fileName = `assignment-${assignment.title.replace(/\s+/g, "-")}-${index + 1}-${Date.now()}-${file.originalname}`;
            const { data: fileData, error: uploadError } = await supabase_1.supabase.storage
                .from("assignments")
                .upload(`/${req.user.schoolId}/${fileName}`, file.buffer, {
                cacheControl: "2592000",
                contentType: file.mimetype,
            });
            if (uploadError) {
                throw new Error(uploadError.message);
            }
            // Get public URL
            const { data: urlData } = supabase_1.supabase.storage.from("assignments").getPublicUrl(fileData.path);
            // Save file record to database
            await setup_1.prisma.fileStorage.create({
                data: {
                    fileName: fileName,
                    originalName: file.originalname,
                    fileSize: file.size,
                    mimeType: file.mimetype,
                    fileUrl: urlData.publicUrl,
                    bucketName: "assignments",
                    uploadedById: req.user.id,
                    schoolId: req.user.schoolId,
                    fileCategory: "ASSIGNMENT",
                },
            });
            return urlData.publicUrl;
        });
        const documentUrls = await Promise.all(uploadPromises);
        // Update assignment with document URLs
        const updatedAssignment = await setup_1.prisma.assignment.update({
            where: { id },
            data: {
                documentUrls: [...assignment.documentUrls, ...documentUrls],
                updatedAt: new Date(),
            },
        });
        setup_1.logger.info("Assignment files uploaded", {
            userId: req.user?.id,
            assignmentId: id,
            fileCount: documentUrls.length,
        });
        res.status(200).json({
            message: "Assignment files uploaded successfully",
            documentUrls,
            assignment: updatedAssignment,
        });
    }
    catch (error) {
        (0, setup_1.handleError)(res, error, "Failed to upload assignment files");
    }
};
exports.uploadAssignmentFiles = uploadAssignmentFiles;
const submitAssignment = async (req, res) => {
    const { id } = req.params;
    try {
        const data = submitAssignmentSchema.parse(req.body);
        // Only parents can submit assignments for their children
        if (req.user?.role !== "PARENT") {
            return res.status(403).json({ message: "Only parents can submit assignments" });
        }
        const studentId = req.query.studentId;
        if (!studentId) {
            return res.status(400).json({ message: "Student ID is required" });
        }
        // Verify parent has access to student and assignment
        const [student, assignment] = await Promise.all([
            setup_1.prisma.student.findFirst({
                where: {
                    id: studentId,
                    parentId: req.user.id,
                },
            }),
            setup_1.prisma.assignment.findFirst({
                where: {
                    id,
                    ...(0, setup_1.getTenantFilter)(req.user),
                },
            }),
        ]);
        if (!student) {
            return res.status(404).json({ message: "Student not found or access denied" });
        }
        if (!assignment) {
            return res.status(404).json({ message: "Assignment not found" });
        }
        // Check if assignment is still open
        if (new Date() > assignment.dueDate) {
            return res.status(400).json({ message: "Assignment submission deadline has passed" });
        }
        // Handle file uploads if any
        let submissionUrls = [];
        if (req.files && Array.isArray(req.files) && req.files.length > 0) {
            const uploadPromises = req.files.map(async (file, index) => {
                const fileName = `submission-${student.name}-${assignment.title}-${index + 1}-${Date.now()}-${file.originalname}`;
                const { data: fileData, error: uploadError } = await supabase_1.supabase.storage
                    .from("assignments")
                    .upload(`/${student.schoolId}/submissions/${fileName}`, file.buffer, {
                    cacheControl: "2592000",
                    contentType: file.mimetype,
                });
                if (uploadError) {
                    throw new Error(uploadError.message);
                }
                // Get public URL
                const { data: urlData } = supabase_1.supabase.storage.from("assignments").getPublicUrl(fileData.path);
                // Save file record to database
                await setup_1.prisma.fileStorage.create({
                    data: {
                        fileName: fileName,
                        originalName: file.originalname,
                        fileSize: file.size,
                        mimeType: file.mimetype,
                        fileUrl: urlData.publicUrl,
                        bucketName: "assignments",
                        uploadedById: req.user.id,
                        schoolId: student.schoolId,
                        fileCategory: "ASSIGNMENT",
                    },
                });
                return urlData.publicUrl;
            });
            submissionUrls = await Promise.all(uploadPromises);
        }
        // Create or update submission
        const submission = await setup_1.prisma.assignmentSubmission.upsert({
            where: {
                assignmentId_studentId: {
                    assignmentId: id,
                    studentId: studentId,
                },
            },
            update: {
                submissionUrls,
                comments: data.comments,
                submittedAt: new Date(),
            },
            create: {
                assignmentId: id,
                studentId: studentId,
                submissionUrls,
                comments: data.comments,
            },
        });
        // Notify teacher
        await (0, setup_1.createNotification)(assignment.teacherId, "Assignment Submitted", `${student.name} ${student.surname} has submitted the assignment "${assignment.title}"`, "ASSIGNMENT", { assignmentId: id, studentId: studentId, submissionId: submission.id });
        setup_1.logger.info("Assignment submitted", {
            userId: req.user?.id,
            assignmentId: id,
            studentId: studentId,
            fileCount: submissionUrls.length,
        });
        res.status(200).json({
            message: "Assignment submitted successfully",
            submission,
        });
    }
    catch (error) {
        if (error instanceof zod_1.z.ZodError) {
            return res.status(400).json({ message: "Invalid input", errors: error.errors });
        }
        (0, setup_1.handleError)(res, error, "Failed to submit assignment");
    }
};
exports.submitAssignment = submitAssignment;
const getStudentAssignments = async (req, res) => {
    try {
        const studentId = req.params.studentId;
        const status = req.query.status;
        // Verify access to student
        let student;
        if (req.user?.role === "PARENT") {
            student = await setup_1.prisma.student.findFirst({
                where: { id: studentId, parentId: req.user.id },
            });
        }
        else {
            student = await setup_1.prisma.student.findFirst({
                where: {
                    id: studentId,
                    ...(0, setup_1.getTenantFilter)(req.user),
                },
            });
        }
        if (!student) {
            return res.status(404).json({ message: "Student not found or access denied" });
        }
        const now = new Date();
        const where = {
            OR: [{ classId: student.classId }, { assignmentType: "CLASS_WIDE", schoolId: student.schoolId }],
        };
        // Filter by status
        if (status === "pending") {
            where.dueDate = { gte: now };
            where.NOT = {
                submissions: {
                    some: { studentId: studentId },
                },
            };
        }
        else if (status === "submitted") {
            where.submissions = {
                some: { studentId: studentId },
            };
        }
        else if (status === "overdue") {
            where.dueDate = { lt: now };
            where.NOT = {
                submissions: {
                    some: { studentId: studentId },
                },
            };
        }
        const assignments = await setup_1.prisma.assignment.findMany({
            where,
            include: {
                subject: { select: { name: true, code: true } },
                teacher: {
                    include: {
                        user: { select: { name: true, surname: true } },
                    },
                },
                submissions: {
                    where: { studentId: studentId },
                    select: {
                        id: true,
                        submittedAt: true,
                        comments: true,
                        submissionUrls: true,
                    },
                },
                results: {
                    where: { studentId: studentId },
                    select: {
                        score: true,
                        maxScore: true,
                        percentage: true,
                        grade: true,
                        feedback: true,
                    },
                },
            },
            orderBy: { dueDate: "asc" },
        });
        setup_1.logger.info("Student assignments retrieved", {
            userId: req.user?.id,
            studentId: studentId,
            status: status,
            count: assignments.length,
        });
        res.status(200).json({
            message: "Student assignments retrieved successfully",
            assignments,
            student: {
                id: student.id,
                name: student.name,
                surname: student.surname,
            },
        });
    }
    catch (error) {
        (0, setup_1.handleError)(res, error, "Failed to retrieve student assignments");
    }
};
exports.getStudentAssignments = getStudentAssignments;
