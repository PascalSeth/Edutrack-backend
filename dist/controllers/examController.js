"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getExamSessions = exports.deleteExamSession = exports.updateExamSession = exports.createExamSession = exports.deleteExam = exports.updateExam = exports.createExam = exports.getExamById = exports.getExams = void 0;
const zod_1 = require("zod");
const setup_1 = require("../utils/setup");
// Validation Schemas
const createExamSchema = zod_1.z.object({
    title: zod_1.z.string().min(1, "Title is required"),
    description: zod_1.z.string().optional(),
    examType: zod_1.z.enum([
        "WRITTEN",
        "PRACTICAL",
        "ORAL",
        "PROJECT",
        "CONTINUOUS_ASSESSMENT",
        "FINAL_EXAM",
        "MID_TERM",
        "QUIZ",
    ]),
    totalMarks: zod_1.z.number().int().min(1, "Total marks must be positive"),
    passingMarks: zod_1.z.number().int().min(0, "Passing marks must be non-negative"),
    duration: zod_1.z.number().int().min(1, "Duration must be positive (in minutes)"),
    instructions: zod_1.z.string().optional(),
    startDate: zod_1.z.string().datetime("Invalid start date"),
    endDate: zod_1.z.string().datetime("Invalid end date"),
    schoolId: zod_1.z.string().uuid("Invalid school ID"),
    subjectId: zod_1.z.string().uuid("Invalid subject ID"),
    gradeId: zod_1.z.string().uuid("Invalid grade ID").optional(),
    classId: zod_1.z.string().uuid("Invalid class ID").optional(),
    termId: zod_1.z.string().uuid("Invalid term ID").optional(),
});
const updateExamSchema = zod_1.z.object({
    title: zod_1.z.string().min(1).optional(),
    description: zod_1.z.string().optional(),
    examType: zod_1.z
        .enum(["WRITTEN", "PRACTICAL", "ORAL", "PROJECT", "CONTINUOUS_ASSESSMENT", "FINAL_EXAM", "MID_TERM", "QUIZ"])
        .optional(),
    totalMarks: zod_1.z.number().int().min(1).optional(),
    passingMarks: zod_1.z.number().int().min(0).optional(),
    duration: zod_1.z.number().int().min(1).optional(),
    instructions: zod_1.z.string().optional(),
    startDate: zod_1.z.string().datetime().optional(),
    endDate: zod_1.z.string().datetime().optional(),
    status: zod_1.z.enum(["DRAFT", "PUBLISHED", "ONGOING", "COMPLETED", "CANCELLED"]).optional(),
});
const createExamSessionSchema = zod_1.z.object({
    examId: zod_1.z.string().uuid("Invalid exam ID"),
    sessionDate: zod_1.z.string().datetime("Invalid session date"),
    startTime: zod_1.z.string().regex(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/, "Invalid time format (HH:MM)"),
    endTime: zod_1.z.string().regex(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/, "Invalid time format (HH:MM)"),
    roomId: zod_1.z.string().uuid("Invalid room ID"),
    invigilatorId: zod_1.z.string().uuid("Invalid invigilator ID"),
    studentIds: zod_1.z.array(zod_1.z.string().uuid("Invalid student ID")).min(1, "At least one student is required"),
});
const updateExamSessionSchema = zod_1.z.object({
    sessionDate: zod_1.z.string().datetime().optional(),
    startTime: zod_1.z
        .string()
        .regex(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/)
        .optional(),
    endTime: zod_1.z
        .string()
        .regex(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/)
        .optional(),
    roomId: zod_1.z.string().uuid().optional(),
    invigilatorId: zod_1.z.string().uuid().optional(),
    status: zod_1.z.enum(["SCHEDULED", "ONGOING", "COMPLETED", "CANCELLED", "POSTPONED"]).optional(),
    actualStartTime: zod_1.z.string().datetime().optional(),
    actualEndTime: zod_1.z.string().datetime().optional(),
    notes: zod_1.z.string().optional(),
});
const getExams = async (req, res) => {
    try {
        const page = Number.parseInt(req.query.page) || 1;
        const limit = Number.parseInt(req.query.limit) || 10;
        const skip = (page - 1) * limit;
        const filter = (0, setup_1.getTenantFilter)(req.user);
        const [exams, total] = await Promise.all([
            setup_1.prisma.exam.findMany({
                where: filter,
                skip,
                take: limit,
                include: {
                    subject: { select: { name: true, code: true } },
                    grade: { select: { name: true } },
                    class: { select: { name: true } },
                    term: { select: { name: true } },
                    createdBy: {
                        include: {
                            user: { select: { name: true, surname: true } },
                        },
                    },
                    _count: {
                        select: {
                            examSessions: true,
                            results: true,
                        },
                    },
                },
                orderBy: { startDate: "desc" },
            }),
            setup_1.prisma.exam.count({ where: filter }),
        ]);
        setup_1.logger.info("Exams retrieved", { userId: req.user?.id, page, limit, total });
        res.status(200).json({
            message: "Exams retrieved successfully",
            exams,
            pagination: { page, limit, total, pages: Math.ceil(total / limit) },
        });
    }
    catch (error) {
        (0, setup_1.handleError)(res, error, "Failed to retrieve exams");
    }
};
exports.getExams = getExams;
const getExamById = async (req, res) => {
    const { id } = req.params;
    try {
        const filter = (0, setup_1.getTenantFilter)(req.user);
        const exam = await setup_1.prisma.exam.findFirst({
            where: { id, ...filter },
            include: {
                subject: { select: { name: true, code: true } },
                grade: { select: { name: true, level: true } },
                class: { select: { name: true, capacity: true } },
                term: { select: { name: true, startDate: true, endDate: true } },
                createdBy: {
                    include: {
                        user: { select: { name: true, surname: true, email: true } },
                    },
                },
                examSessions: {
                    include: {
                        room: { select: { name: true, code: true, capacity: true } },
                        invigilator: {
                            include: {
                                user: { select: { name: true, surname: true } },
                            },
                        },
                        students: {
                            select: {
                                id: true,
                                name: true,
                                surname: true,
                                registrationNumber: true,
                            },
                        },
                        _count: { select: { students: true } },
                    },
                    orderBy: { sessionDate: "asc" },
                },
                results: {
                    include: {
                        student: {
                            select: {
                                name: true,
                                surname: true,
                                registrationNumber: true,
                            },
                        },
                    },
                    orderBy: { score: "desc" },
                    take: 10, // Top 10 results
                },
                _count: {
                    select: {
                        examSessions: true,
                        results: true,
                    },
                },
            },
        });
        if (!exam) {
            setup_1.logger.warn("Exam not found", { userId: req.user?.id, examId: id });
            return res.status(404).json({ message: "Exam not found" });
        }
        setup_1.logger.info("Exam retrieved", { userId: req.user?.id, examId: id });
        res.status(200).json({
            message: "Exam retrieved successfully",
            exam,
        });
    }
    catch (error) {
        (0, setup_1.handleError)(res, error, "Failed to retrieve exam");
    }
};
exports.getExamById = getExamById;
const createExam = async (req, res) => {
    try {
        const data = createExamSchema.parse(req.body);
        // Only principals and school admins can create exams
        if (!["PRINCIPAL", "SCHOOL_ADMIN", "SUPER_ADMIN"].includes(req.user?.role || "")) {
            return res.status(403).json({ message: "Access denied" });
        }
        // Verify school, subject, grade, class, and term
        const [school, subject, grade, classRecord, term] = await Promise.all([
            setup_1.prisma.school.findFirst({
                where: {
                    id: data.schoolId,
                    ...(0, setup_1.getTenantFilter)(req.user),
                },
            }),
            setup_1.prisma.subject.findFirst({
                where: {
                    id: data.subjectId,
                    schoolId: data.schoolId,
                },
            }),
            data.gradeId
                ? setup_1.prisma.grade.findFirst({
                    where: {
                        id: data.gradeId,
                        schoolId: data.schoolId,
                    },
                })
                : null,
            data.classId
                ? setup_1.prisma.class.findFirst({
                    where: {
                        id: data.classId,
                        schoolId: data.schoolId,
                    },
                })
                : null,
            data.termId
                ? setup_1.prisma.term.findFirst({
                    where: {
                        id: data.termId,
                        schoolId: data.schoolId,
                    },
                })
                : null,
        ]);
        if (!school) {
            return res.status(404).json({ message: "School not found or access denied" });
        }
        if (!subject) {
            return res.status(404).json({ message: "Subject not found" });
        }
        if (data.gradeId && !grade) {
            return res.status(404).json({ message: "Grade not found" });
        }
        if (data.classId && !classRecord) {
            return res.status(404).json({ message: "Class not found" });
        }
        if (data.termId && !term) {
            return res.status(404).json({ message: "Term not found" });
        }
        // Validate passing marks
        if (data.passingMarks > data.totalMarks) {
            return res.status(400).json({ message: "Passing marks cannot exceed total marks" });
        }
        // Validate dates
        const startDate = new Date(data.startDate);
        const endDate = new Date(data.endDate);
        if (startDate >= endDate) {
            return res.status(400).json({ message: "End date must be after start date" });
        }
        // Get the principal creating the exam
        const principal = await setup_1.prisma.principal.findFirst({
            where: {
                id: req.user?.id,
                schoolId: data.schoolId,
            },
        });
        if (!principal) {
            return res.status(403).json({ message: "Only principals can create exams" });
        }
        const exam = await setup_1.prisma.exam.create({
            data: {
                title: data.title,
                description: data.description,
                examType: data.examType,
                totalMarks: data.totalMarks,
                passingMarks: data.passingMarks,
                duration: data.duration,
                instructions: data.instructions,
                startDate: startDate,
                endDate: endDate,
                schoolId: data.schoolId,
                subjectId: data.subjectId,
                gradeId: data.gradeId,
                classId: data.classId,
                termId: data.termId,
                createdById: principal.id,
            },
            include: {
                subject: { select: { name: true, code: true } },
                grade: { select: { name: true } },
                class: { select: { name: true } },
                term: { select: { name: true } },
                createdBy: {
                    include: {
                        user: { select: { name: true, surname: true } },
                    },
                },
            },
        });
        setup_1.logger.info("Exam created", {
            userId: req.user?.id,
            examId: exam.id,
            schoolId: data.schoolId,
        });
        res.status(201).json({
            message: "Exam created successfully",
            exam,
        });
    }
    catch (error) {
        if (error instanceof zod_1.z.ZodError) {
            return res.status(400).json({ message: "Invalid input", errors: error.errors });
        }
        (0, setup_1.handleError)(res, error, "Failed to create exam");
    }
};
exports.createExam = createExam;
const updateExam = async (req, res) => {
    const { id } = req.params;
    try {
        const data = updateExamSchema.parse(req.body);
        // Only principals and school admins can update exams
        if (!["PRINCIPAL", "SCHOOL_ADMIN", "SUPER_ADMIN"].includes(req.user?.role || "")) {
            return res.status(403).json({ message: "Access denied" });
        }
        const filter = (0, setup_1.getTenantFilter)(req.user);
        const existingExam = await setup_1.prisma.exam.findFirst({
            where: { id, ...filter },
        });
        if (!existingExam) {
            return res.status(404).json({ message: "Exam not found or access denied" });
        }
        // Validate passing marks if provided
        if (data.passingMarks && data.totalMarks && data.passingMarks > data.totalMarks) {
            return res.status(400).json({ message: "Passing marks cannot exceed total marks" });
        }
        if (data.passingMarks && !data.totalMarks && data.passingMarks > existingExam.totalMarks) {
            return res.status(400).json({ message: "Passing marks cannot exceed total marks" });
        }
        if (data.totalMarks && !data.passingMarks && existingExam.passingMarks > data.totalMarks) {
            return res.status(400).json({ message: "Total marks cannot be less than passing marks" });
        }
        // Validate dates if provided
        if (data.startDate && data.endDate) {
            const startDate = new Date(data.startDate);
            const endDate = new Date(data.endDate);
            if (startDate >= endDate) {
                return res.status(400).json({ message: "End date must be after start date" });
            }
        }
        const exam = await setup_1.prisma.exam.update({
            where: { id },
            data: {
                ...(data.title && { title: data.title }),
                ...(data.description !== undefined && { description: data.description }),
                ...(data.examType && { examType: data.examType }),
                ...(data.totalMarks && { totalMarks: data.totalMarks }),
                ...(data.passingMarks !== undefined && { passingMarks: data.passingMarks }),
                ...(data.duration && { duration: data.duration }),
                ...(data.instructions !== undefined && { instructions: data.instructions }),
                ...(data.startDate && { startDate: new Date(data.startDate) }),
                ...(data.endDate && { endDate: new Date(data.endDate) }),
                ...(data.status && { status: data.status }),
                ...(data.status === "PUBLISHED" && { publishedAt: new Date() }),
            },
            include: {
                subject: { select: { name: true, code: true } },
                grade: { select: { name: true } },
                class: { select: { name: true } },
                term: { select: { name: true } },
            },
        });
        setup_1.logger.info("Exam updated", { userId: req.user?.id, examId: id });
        res.status(200).json({
            message: "Exam updated successfully",
            exam,
        });
    }
    catch (error) {
        if (error instanceof zod_1.z.ZodError) {
            return res.status(400).json({ message: "Invalid input", errors: error.errors });
        }
        (0, setup_1.handleError)(res, error, "Failed to update exam");
    }
};
exports.updateExam = updateExam;
const deleteExam = async (req, res) => {
    const { id } = req.params;
    try {
        // Only principals and school admins can delete exams
        if (!["PRINCIPAL", "SCHOOL_ADMIN", "SUPER_ADMIN"].includes(req.user?.role || "")) {
            return res.status(403).json({ message: "Access denied" });
        }
        const filter = (0, setup_1.getTenantFilter)(req.user);
        const exam = await setup_1.prisma.exam.findFirst({
            where: { id, ...filter },
            include: {
                _count: {
                    select: {
                        examSessions: true,
                        results: true,
                    },
                },
            },
        });
        if (!exam) {
            return res.status(404).json({ message: "Exam not found or access denied" });
        }
        // Check if exam has sessions or results
        if (exam._count.examSessions > 0 || exam._count.results > 0) {
            return res.status(400).json({
                message: "Cannot delete exam with existing sessions or results",
            });
        }
        await setup_1.prisma.exam.delete({ where: { id } });
        setup_1.logger.info("Exam deleted", { userId: req.user?.id, examId: id });
        res.status(200).json({ message: "Exam deleted successfully" });
    }
    catch (error) {
        (0, setup_1.handleError)(res, error, "Failed to delete exam");
    }
};
exports.deleteExam = deleteExam;
// Exam Session Management
const createExamSession = async (req, res) => {
    try {
        const data = createExamSessionSchema.parse(req.body);
        // Only principals and school admins can create exam sessions
        if (!["PRINCIPAL", "SCHOOL_ADMIN", "SUPER_ADMIN"].includes(req.user?.role || "")) {
            return res.status(403).json({ message: "Access denied" });
        }
        // Verify exam, room, invigilator, and students
        const [exam, room, invigilator, students] = await Promise.all([
            setup_1.prisma.exam.findFirst({
                where: {
                    id: data.examId,
                    ...(0, setup_1.getTenantFilter)(req.user),
                },
            }),
            setup_1.prisma.room.findFirst({
                where: {
                    id: data.roomId,
                    ...(0, setup_1.getTenantFilter)(req.user),
                },
            }),
            setup_1.prisma.teacher.findFirst({
                where: {
                    id: data.invigilatorId,
                    ...(0, setup_1.getTenantFilter)(req.user),
                },
            }),
            setup_1.prisma.student.findMany({
                where: {
                    id: { in: data.studentIds },
                    ...(0, setup_1.getTenantFilter)(req.user),
                },
            }),
        ]);
        if (!exam) {
            return res.status(404).json({ message: "Exam not found or access denied" });
        }
        if (!room) {
            return res.status(404).json({ message: "Room not found or access denied" });
        }
        if (!invigilator) {
            return res.status(404).json({ message: "Invigilator not found or access denied" });
        }
        if (students.length !== data.studentIds.length) {
            return res.status(404).json({ message: "Some students not found or access denied" });
        }
        // Check room capacity
        if (students.length > room.capacity) {
            return res.status(400).json({ message: "Room capacity exceeded" });
        }
        // Check for conflicts
        const sessionDate = new Date(data.sessionDate);
        const conflicts = await setup_1.prisma.examSession.findFirst({
            where: {
                roomId: data.roomId,
                sessionDate: {
                    gte: new Date(sessionDate.toDateString()),
                    lt: new Date(new Date(sessionDate.getTime() + 24 * 60 * 60 * 1000).toDateString()),
                },
                startTime: data.startTime,
                endTime: data.endTime,
                status: { not: "CANCELLED" },
            },
        });
        if (conflicts) {
            return res.status(409).json({ message: "Room is not available at this time" });
        }
        // Check invigilator availability
        const invigilatorConflict = await setup_1.prisma.examSession.findFirst({
            where: {
                invigilatorId: data.invigilatorId,
                sessionDate: {
                    gte: new Date(sessionDate.toDateString()),
                    lt: new Date(new Date(sessionDate.getTime() + 24 * 60 * 60 * 1000).toDateString()),
                },
                startTime: data.startTime,
                endTime: data.endTime,
                status: { not: "CANCELLED" },
            },
        });
        if (invigilatorConflict) {
            return res.status(409).json({ message: "Invigilator is not available at this time" });
        }
        const session = await setup_1.prisma.examSession.create({
            data: {
                examId: data.examId,
                sessionDate: sessionDate,
                startTime: data.startTime,
                endTime: data.endTime,
                roomId: data.roomId,
                invigilatorId: data.invigilatorId,
                students: {
                    connect: data.studentIds.map((id) => ({ id })),
                },
            },
            include: {
                exam: { select: { title: true, duration: true } },
                room: { select: { name: true, code: true, capacity: true } },
                invigilator: {
                    include: {
                        user: { select: { name: true, surname: true } },
                    },
                },
                students: {
                    select: {
                        id: true,
                        name: true,
                        surname: true,
                        registrationNumber: true,
                    },
                },
                _count: { select: { students: true } },
            },
        });
        setup_1.logger.info("Exam session created", {
            userId: req.user?.id,
            sessionId: session.id,
            examId: data.examId,
        });
        res.status(201).json({
            message: "Exam session created successfully",
            session,
        });
    }
    catch (error) {
        if (error instanceof zod_1.z.ZodError) {
            return res.status(400).json({ message: "Invalid input", errors: error.errors });
        }
        (0, setup_1.handleError)(res, error, "Failed to create exam session");
    }
};
exports.createExamSession = createExamSession;
const updateExamSession = async (req, res) => {
    const { id } = req.params;
    try {
        const data = updateExamSessionSchema.parse(req.body);
        // Only principals, school admins, and invigilators can update sessions
        if (!["PRINCIPAL", "SCHOOL_ADMIN", "TEACHER", "SUPER_ADMIN"].includes(req.user?.role || "")) {
            return res.status(403).json({ message: "Access denied" });
        }
        const existingSession = await setup_1.prisma.examSession.findFirst({
            where: {
                id,
                exam: (0, setup_1.getTenantFilter)(req.user),
            },
        });
        if (!existingSession) {
            return res.status(404).json({ message: "Exam session not found or access denied" });
        }
        // Verify room and invigilator if provided
        if (data.roomId) {
            const room = await setup_1.prisma.room.findFirst({
                where: {
                    id: data.roomId,
                    ...(0, setup_1.getTenantFilter)(req.user),
                },
            });
            if (!room) {
                return res.status(404).json({ message: "Room not found or access denied" });
            }
        }
        if (data.invigilatorId) {
            const invigilator = await setup_1.prisma.teacher.findFirst({
                where: {
                    id: data.invigilatorId,
                    ...(0, setup_1.getTenantFilter)(req.user),
                },
            });
            if (!invigilator) {
                return res.status(404).json({ message: "Invigilator not found or access denied" });
            }
        }
        const session = await setup_1.prisma.examSession.update({
            where: { id },
            data: {
                ...(data.sessionDate && { sessionDate: new Date(data.sessionDate) }),
                ...(data.startTime && { startTime: data.startTime }),
                ...(data.endTime && { endTime: data.endTime }),
                ...(data.roomId && { roomId: data.roomId }),
                ...(data.invigilatorId && { invigilatorId: data.invigilatorId }),
                ...(data.status && { status: data.status }),
                ...(data.actualStartTime && { actualStartTime: new Date(data.actualStartTime) }),
                ...(data.actualEndTime && { actualEndTime: new Date(data.actualEndTime) }),
                ...(data.notes !== undefined && { notes: data.notes }),
            },
            include: {
                exam: { select: { title: true, duration: true } },
                room: { select: { name: true, code: true } },
                invigilator: {
                    include: {
                        user: { select: { name: true, surname: true } },
                    },
                },
                _count: { select: { students: true } },
            },
        });
        setup_1.logger.info("Exam session updated", { userId: req.user?.id, sessionId: id });
        res.status(200).json({
            message: "Exam session updated successfully",
            session,
        });
    }
    catch (error) {
        if (error instanceof zod_1.z.ZodError) {
            return res.status(400).json({ message: "Invalid input", errors: error.errors });
        }
        (0, setup_1.handleError)(res, error, "Failed to update exam session");
    }
};
exports.updateExamSession = updateExamSession;
const deleteExamSession = async (req, res) => {
    const { id } = req.params;
    try {
        // Only principals and school admins can delete exam sessions
        if (!["PRINCIPAL", "SCHOOL_ADMIN", "SUPER_ADMIN"].includes(req.user?.role || "")) {
            return res.status(403).json({ message: "Access denied" });
        }
        const session = await setup_1.prisma.examSession.findFirst({
            where: {
                id,
                exam: (0, setup_1.getTenantFilter)(req.user),
            },
        });
        if (!session) {
            return res.status(404).json({ message: "Exam session not found or access denied" });
        }
        // Check if session has started
        if (session.status === "ONGOING" || session.status === "COMPLETED") {
            return res.status(400).json({ message: "Cannot delete ongoing or completed exam session" });
        }
        await setup_1.prisma.examSession.delete({ where: { id } });
        setup_1.logger.info("Exam session deleted", { userId: req.user?.id, sessionId: id });
        res.status(200).json({ message: "Exam session deleted successfully" });
    }
    catch (error) {
        (0, setup_1.handleError)(res, error, "Failed to delete exam session");
    }
};
exports.deleteExamSession = deleteExamSession;
const getExamSessions = async (req, res) => {
    const { examId } = req.params;
    try {
        const filter = (0, setup_1.getTenantFilter)(req.user);
        // Verify exam exists and user has access
        const exam = await setup_1.prisma.exam.findFirst({
            where: {
                id: examId,
                ...filter,
            },
        });
        if (!exam) {
            return res.status(404).json({ message: "Exam not found or access denied" });
        }
        const sessions = await setup_1.prisma.examSession.findMany({
            where: { examId },
            include: {
                room: { select: { name: true, code: true, capacity: true } },
                invigilator: {
                    include: {
                        user: { select: { name: true, surname: true } },
                    },
                },
                students: {
                    select: {
                        id: true,
                        name: true,
                        surname: true,
                        registrationNumber: true,
                    },
                },
                _count: { select: { students: true } },
            },
            orderBy: { sessionDate: "asc" },
        });
        setup_1.logger.info("Exam sessions retrieved", { userId: req.user?.id, examId });
        res.status(200).json({
            message: "Exam sessions retrieved successfully",
            sessions,
        });
    }
    catch (error) {
        (0, setup_1.handleError)(res, error, "Failed to retrieve exam sessions");
    }
};
exports.getExamSessions = getExamSessions;
