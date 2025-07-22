"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getCurriculumProgress = exports.getStudentProgress = exports.updateStudentProgress = exports.getLearningObjectives = exports.createLearningObjective = exports.createCurriculumSubject = exports.deleteCurriculum = exports.updateCurriculum = exports.createCurriculum = exports.getCurriculumById = exports.getCurriculums = void 0;
const zod_1 = require("zod");
const setup_1 = require("../utils/setup");
// Validation Schemas
const createCurriculumSchema = zod_1.z.object({
    name: zod_1.z.string().min(1, "Name is required"),
    description: zod_1.z.string().optional(),
    version: zod_1.z.string().default("1.0"),
    schoolId: zod_1.z.string().uuid("Invalid school ID"),
});
const updateCurriculumSchema = zod_1.z.object({
    name: zod_1.z.string().min(1).optional(),
    description: zod_1.z.string().optional(),
    version: zod_1.z.string().optional(),
    isActive: zod_1.z.boolean().optional(),
});
const createCurriculumSubjectSchema = zod_1.z.object({
    curriculumId: zod_1.z.string().uuid("Invalid curriculum ID"),
    subjectId: zod_1.z.string().uuid("Invalid subject ID"),
    gradeId: zod_1.z.string().uuid("Invalid grade ID"),
    hoursPerWeek: zod_1.z.number().int().min(0).optional(),
    isCore: zod_1.z.boolean().default(true),
    prerequisites: zod_1.z.array(zod_1.z.string().uuid()).optional(),
});
const createLearningObjectiveSchema = zod_1.z.object({
    curriculumSubjectId: zod_1.z.string().uuid("Invalid curriculum subject ID"),
    title: zod_1.z.string().min(1, "Title is required"),
    description: zod_1.z.string().min(1, "Description is required"),
    objectiveType: zod_1.z.enum(["KNOWLEDGE", "SKILL", "ATTITUDE", "COMPETENCY"]),
    bloomsLevel: zod_1.z.enum(["REMEMBER", "UNDERSTAND", "APPLY", "ANALYZE", "EVALUATE", "CREATE"]),
});
const updateProgressSchema = zod_1.z.object({
    studentId: zod_1.z.string().uuid("Invalid student ID"),
    learningObjectiveId: zod_1.z.string().uuid("Invalid learning objective ID"),
    status: zod_1.z.enum(["NOT_STARTED", "IN_PROGRESS", "COMPLETED", "MASTERED"]),
    masteryLevel: zod_1.z.enum(["BEGINNER", "DEVELOPING", "PROFICIENT", "ADVANCED", "EXPERT"]),
    notes: zod_1.z.string().optional(),
    assessmentScore: zod_1.z.number().min(0).max(100).optional(),
});
const getCurriculums = async (req, res) => {
    try {
        const page = Number.parseInt(req.query.page) || 1;
        const limit = Number.parseInt(req.query.limit) || 10;
        const skip = (page - 1) * limit;
        const filter = (0, setup_1.getTenantFilter)(req.user);
        const [curriculums, total] = await Promise.all([
            setup_1.prisma.curriculum.findMany({
                where: filter,
                skip,
                take: limit,
                include: {
                    _count: {
                        select: {
                            curriculumSubjects: true,
                        },
                    },
                },
                orderBy: { createdAt: "desc" },
            }),
            setup_1.prisma.curriculum.count({ where: filter }),
        ]);
        setup_1.logger.info("Curriculums retrieved", { userId: req.user?.id, page, limit, total });
        res.status(200).json({
            message: "Curriculums retrieved successfully",
            curriculums,
            pagination: { page, limit, total, pages: Math.ceil(total / limit) },
        });
    }
    catch (error) {
        (0, setup_1.handleError)(res, error, "Failed to retrieve curriculums");
    }
};
exports.getCurriculums = getCurriculums;
const getCurriculumById = async (req, res) => {
    const { id } = req.params;
    try {
        const filter = (0, setup_1.getTenantFilter)(req.user);
        const curriculum = await setup_1.prisma.curriculum.findFirst({
            where: { id, ...filter },
            include: {
                curriculumSubjects: {
                    include: {
                        subject: { select: { name: true, code: true } },
                        grade: { select: { name: true, level: true } },
                        learningObjectives: {
                            include: {
                                _count: {
                                    select: {
                                        studentProgress: true,
                                    },
                                },
                            },
                            orderBy: { createdAt: "asc" },
                        },
                    },
                    orderBy: [{ grade: { level: "asc" } }, { subject: { name: "asc" } }],
                },
                _count: {
                    select: {
                        curriculumSubjects: true,
                    },
                },
            },
        });
        if (!curriculum) {
            setup_1.logger.warn("Curriculum not found", { userId: req.user?.id, curriculumId: id });
            return res.status(404).json({ message: "Curriculum not found" });
        }
        setup_1.logger.info("Curriculum retrieved", { userId: req.user?.id, curriculumId: id });
        res.status(200).json({
            message: "Curriculum retrieved successfully",
            curriculum,
        });
    }
    catch (error) {
        (0, setup_1.handleError)(res, error, "Failed to retrieve curriculum");
    }
};
exports.getCurriculumById = getCurriculumById;
const createCurriculum = async (req, res) => {
    try {
        const data = createCurriculumSchema.parse(req.body);
        // Only principals and school admins can create curriculums
        if (!["PRINCIPAL", "SCHOOL_ADMIN", "SUPER_ADMIN"].includes(req.user?.role || "")) {
            return res.status(403).json({ message: "Access denied" });
        }
        // Verify school exists and user has access
        const school = await setup_1.prisma.school.findFirst({
            where: {
                id: data.schoolId,
                ...(0, setup_1.getTenantFilter)(req.user),
            },
        });
        if (!school) {
            return res.status(404).json({ message: "School not found or access denied" });
        }
        // Check if curriculum with same name and version exists
        const existingCurriculum = await setup_1.prisma.curriculum.findFirst({
            where: {
                name: data.name,
                version: data.version,
                schoolId: data.schoolId,
            },
        });
        if (existingCurriculum) {
            return res.status(409).json({ message: "Curriculum with this name and version already exists" });
        }
        const curriculum = await setup_1.prisma.curriculum.create({
            data: {
                name: data.name,
                description: data.description,
                version: data.version,
                schoolId: data.schoolId,
            },
        });
        setup_1.logger.info("Curriculum created", {
            userId: req.user?.id,
            curriculumId: curriculum.id,
            schoolId: data.schoolId,
        });
        res.status(201).json({
            message: "Curriculum created successfully",
            curriculum,
        });
    }
    catch (error) {
        if (error instanceof zod_1.z.ZodError) {
            return res.status(400).json({ message: "Invalid input", errors: error.errors });
        }
        (0, setup_1.handleError)(res, error, "Failed to create curriculum");
    }
};
exports.createCurriculum = createCurriculum;
const updateCurriculum = async (req, res) => {
    const { id } = req.params;
    try {
        const data = updateCurriculumSchema.parse(req.body);
        // Only principals and school admins can update curriculums
        if (!["PRINCIPAL", "SCHOOL_ADMIN", "SUPER_ADMIN"].includes(req.user?.role || "")) {
            return res.status(403).json({ message: "Access denied" });
        }
        const filter = (0, setup_1.getTenantFilter)(req.user);
        const existingCurriculum = await setup_1.prisma.curriculum.findFirst({
            where: { id, ...filter },
        });
        if (!existingCurriculum) {
            return res.status(404).json({ message: "Curriculum not found or access denied" });
        }
        // Check for name and version conflicts if being updated
        if (data.name || data.version) {
            const conflictingCurriculum = await setup_1.prisma.curriculum.findFirst({
                where: {
                    name: data.name || existingCurriculum.name,
                    version: data.version || existingCurriculum.version,
                    schoolId: existingCurriculum.schoolId,
                    id: { not: id },
                },
            });
            if (conflictingCurriculum) {
                return res.status(409).json({ message: "Curriculum with this name and version already exists" });
            }
        }
        const curriculum = await setup_1.prisma.curriculum.update({
            where: { id },
            data: {
                ...(data.name && { name: data.name }),
                ...(data.description !== undefined && { description: data.description }),
                ...(data.version && { version: data.version }),
                ...(data.isActive !== undefined && { isActive: data.isActive }),
            },
        });
        setup_1.logger.info("Curriculum updated", { userId: req.user?.id, curriculumId: id });
        res.status(200).json({
            message: "Curriculum updated successfully",
            curriculum,
        });
    }
    catch (error) {
        if (error instanceof zod_1.z.ZodError) {
            return res.status(400).json({ message: "Invalid input", errors: error.errors });
        }
        (0, setup_1.handleError)(res, error, "Failed to update curriculum");
    }
};
exports.updateCurriculum = updateCurriculum;
const deleteCurriculum = async (req, res) => {
    const { id } = req.params;
    try {
        // Only principals and school admins can delete curriculums
        if (!["PRINCIPAL", "SCHOOL_ADMIN", "SUPER_ADMIN"].includes(req.user?.role || "")) {
            return res.status(403).json({ message: "Access denied" });
        }
        const filter = (0, setup_1.getTenantFilter)(req.user);
        const curriculum = await setup_1.prisma.curriculum.findFirst({
            where: { id, ...filter },
            include: {
                _count: {
                    select: {
                        curriculumSubjects: true,
                    },
                },
            },
        });
        if (!curriculum) {
            return res.status(404).json({ message: "Curriculum not found or access denied" });
        }
        // Check if curriculum has subjects
        if (curriculum._count.curriculumSubjects > 0) {
            return res.status(400).json({
                message: "Cannot delete curriculum with existing subjects. Please remove all subjects first.",
            });
        }
        await setup_1.prisma.curriculum.delete({ where: { id } });
        setup_1.logger.info("Curriculum deleted", { userId: req.user?.id, curriculumId: id });
        res.status(200).json({ message: "Curriculum deleted successfully" });
    }
    catch (error) {
        (0, setup_1.handleError)(res, error, "Failed to delete curriculum");
    }
};
exports.deleteCurriculum = deleteCurriculum;
// Curriculum Subject Management
const createCurriculumSubject = async (req, res) => {
    try {
        const data = createCurriculumSubjectSchema.parse(req.body);
        // Only principals and school admins can create curriculum subjects
        if (!["PRINCIPAL", "SCHOOL_ADMIN", "SUPER_ADMIN"].includes(req.user?.role || "")) {
            return res.status(403).json({ message: "Access denied" });
        }
        // Verify curriculum, subject, and grade
        const [curriculum, subject, grade] = await Promise.all([
            setup_1.prisma.curriculum.findFirst({
                where: {
                    id: data.curriculumId,
                    ...(0, setup_1.getTenantFilter)(req.user),
                },
            }),
            setup_1.prisma.subject.findFirst({
                where: {
                    id: data.subjectId,
                    ...(0, setup_1.getTenantFilter)(req.user),
                },
            }),
            setup_1.prisma.grade.findFirst({
                where: {
                    id: data.gradeId,
                    ...(0, setup_1.getTenantFilter)(req.user),
                },
            }),
        ]);
        if (!curriculum) {
            return res.status(404).json({ message: "Curriculum not found or access denied" });
        }
        if (!subject) {
            return res.status(404).json({ message: "Subject not found or access denied" });
        }
        if (!grade) {
            return res.status(404).json({ message: "Grade not found or access denied" });
        }
        // Check if curriculum subject already exists
        const existingCurriculumSubject = await setup_1.prisma.curriculumSubject.findFirst({
            where: {
                curriculumId: data.curriculumId,
                subjectId: data.subjectId,
                gradeId: data.gradeId,
            },
        });
        if (existingCurriculumSubject) {
            return res.status(409).json({ message: "Subject already exists in this curriculum for this grade" });
        }
        const curriculumSubject = await setup_1.prisma.curriculumSubject.create({
            data: {
                curriculumId: data.curriculumId,
                subjectId: data.subjectId,
                gradeId: data.gradeId,
                hoursPerWeek: data.hoursPerWeek,
                isCore: data.isCore,
                prerequisites: data.prerequisites || [],
            },
            include: {
                subject: { select: { name: true, code: true } },
                grade: { select: { name: true, level: true } },
            },
        });
        setup_1.logger.info("Curriculum subject created", {
            userId: req.user?.id,
            curriculumSubjectId: curriculumSubject.id,
            curriculumId: data.curriculumId,
        });
        res.status(201).json({
            message: "Curriculum subject created successfully",
            curriculumSubject,
        });
    }
    catch (error) {
        if (error instanceof zod_1.z.ZodError) {
            return res.status(400).json({ message: "Invalid input", errors: error.errors });
        }
        (0, setup_1.handleError)(res, error, "Failed to create curriculum subject");
    }
};
exports.createCurriculumSubject = createCurriculumSubject;
// Learning Objective Management
const createLearningObjective = async (req, res) => {
    try {
        const data = createLearningObjectiveSchema.parse(req.body);
        // Only principals, school admins, and teachers can create learning objectives
        if (!["PRINCIPAL", "SCHOOL_ADMIN", "TEACHER", "SUPER_ADMIN"].includes(req.user?.role || "")) {
            return res.status(403).json({ message: "Access denied" });
        }
        // Verify curriculum subject exists and user has access
        const curriculumSubject = await setup_1.prisma.curriculumSubject.findFirst({
            where: {
                id: data.curriculumSubjectId,
                curriculum: (0, setup_1.getTenantFilter)(req.user),
            },
            include: {
                curriculum: { select: { name: true } },
                subject: { select: { name: true } },
                grade: { select: { name: true } },
            },
        });
        if (!curriculumSubject) {
            return res.status(404).json({ message: "Curriculum subject not found or access denied" });
        }
        const learningObjective = await setup_1.prisma.learningObjective.create({
            data: {
                curriculumSubjectId: data.curriculumSubjectId,
                title: data.title,
                description: data.description,
                objectiveType: data.objectiveType,
                bloomsLevel: data.bloomsLevel,
            },
        });
        setup_1.logger.info("Learning objective created", {
            userId: req.user?.id,
            learningObjectiveId: learningObjective.id,
            curriculumSubjectId: data.curriculumSubjectId,
        });
        res.status(201).json({
            message: "Learning objective created successfully",
            learningObjective: {
                ...learningObjective,
                curriculumSubject,
            },
        });
    }
    catch (error) {
        if (error instanceof zod_1.z.ZodError) {
            return res.status(400).json({ message: "Invalid input", errors: error.errors });
        }
        (0, setup_1.handleError)(res, error, "Failed to create learning objective");
    }
};
exports.createLearningObjective = createLearningObjective;
const getLearningObjectives = async (req, res) => {
    const { curriculumSubjectId } = req.params;
    try {
        // Verify curriculum subject exists and user has access
        const curriculumSubject = await setup_1.prisma.curriculumSubject.findFirst({
            where: {
                id: curriculumSubjectId,
                curriculum: (0, setup_1.getTenantFilter)(req.user),
            },
            include: {
                curriculum: { select: { name: true } },
                subject: { select: { name: true } },
                grade: { select: { name: true } },
            },
        });
        if (!curriculumSubject) {
            return res.status(404).json({ message: "Curriculum subject not found or access denied" });
        }
        const learningObjectives = await setup_1.prisma.learningObjective.findMany({
            where: { curriculumSubjectId },
            include: {
                _count: {
                    select: {
                        studentProgress: true,
                    },
                },
            },
            orderBy: { createdAt: "asc" },
        });
        setup_1.logger.info("Learning objectives retrieved", { userId: req.user?.id, curriculumSubjectId });
        res.status(200).json({
            message: "Learning objectives retrieved successfully",
            curriculumSubject,
            learningObjectives,
        });
    }
    catch (error) {
        (0, setup_1.handleError)(res, error, "Failed to retrieve learning objectives");
    }
};
exports.getLearningObjectives = getLearningObjectives;
// Student Progress Management
const updateStudentProgress = async (req, res) => {
    try {
        const data = updateProgressSchema.parse(req.body);
        // Only teachers, principals, and school admins can update progress
        if (!["TEACHER", "PRINCIPAL", "SCHOOL_ADMIN", "SUPER_ADMIN"].includes(req.user?.role || "")) {
            return res.status(403).json({ message: "Access denied" });
        }
        // Verify student and learning objective exist and user has access
        const [student, learningObjective] = await Promise.all([
            setup_1.prisma.student.findFirst({
                where: {
                    id: data.studentId,
                    ...(0, setup_1.getTenantFilter)(req.user),
                },
            }),
            setup_1.prisma.learningObjective.findFirst({
                where: {
                    id: data.learningObjectiveId,
                    curriculumSubject: {
                        curriculum: (0, setup_1.getTenantFilter)(req.user),
                    },
                },
                include: {
                    curriculumSubject: {
                        include: {
                            subject: { select: { name: true } },
                            grade: { select: { name: true } },
                        },
                    },
                },
            }),
        ]);
        if (!student) {
            return res.status(404).json({ message: "Student not found or access denied" });
        }
        if (!learningObjective) {
            return res.status(404).json({ message: "Learning objective not found or access denied" });
        }
        const progress = await setup_1.prisma.curriculumProgress.upsert({
            where: {
                studentId_learningObjectiveId: {
                    studentId: data.studentId,
                    learningObjectiveId: data.learningObjectiveId,
                },
            },
            update: {
                status: data.status,
                masteryLevel: data.masteryLevel,
                notes: data.notes,
                assessmentScore: data.assessmentScore,
                assessmentDate: data.assessmentScore ? new Date() : undefined,
                completedAt: data.status === "COMPLETED" || data.status === "MASTERED" ? new Date() : undefined,
            },
            create: {
                studentId: data.studentId,
                learningObjectiveId: data.learningObjectiveId,
                status: data.status,
                masteryLevel: data.masteryLevel,
                notes: data.notes,
                assessmentScore: data.assessmentScore,
                assessmentDate: data.assessmentScore ? new Date() : undefined,
                completedAt: data.status === "COMPLETED" || data.status === "MASTERED" ? new Date() : undefined,
            },
            include: {
                student: {
                    select: {
                        name: true,
                        surname: true,
                        registrationNumber: true,
                    },
                },
                learningObjective: {
                    select: {
                        title: true,
                        description: true,
                        objectiveType: true,
                        bloomsLevel: true,
                    },
                },
            },
        });
        setup_1.logger.info("Student progress updated", {
            userId: req.user?.id,
            studentId: data.studentId,
            learningObjectiveId: data.learningObjectiveId,
        });
        res.status(200).json({
            message: "Student progress updated successfully",
            progress,
        });
    }
    catch (error) {
        if (error instanceof zod_1.z.ZodError) {
            return res.status(400).json({ message: "Invalid input", errors: error.errors });
        }
        (0, setup_1.handleError)(res, error, "Failed to update student progress");
    }
};
exports.updateStudentProgress = updateStudentProgress;
const getStudentProgress = async (req, res) => {
    const { studentId } = req.params;
    const { curriculumId } = req.query;
    try {
        const filter = (0, setup_1.getTenantFilter)(req.user);
        // Verify student exists and user has access
        const student = await setup_1.prisma.student.findFirst({
            where: {
                id: studentId,
                ...filter,
            },
            include: {
                class: { select: { name: true } },
                grade: { select: { name: true, level: true } },
            },
        });
        if (!student) {
            return res.status(404).json({ message: "Student not found or access denied" });
        }
        // Build progress query
        const progressWhere = {
            studentId,
            learningObjective: {
                curriculumSubject: {
                    curriculum: {
                        ...filter,
                        ...(curriculumId && { id: curriculumId }),
                    },
                },
            },
        };
        const progress = await setup_1.prisma.curriculumProgress.findMany({
            where: progressWhere,
            include: {
                learningObjective: {
                    include: {
                        curriculumSubject: {
                            include: {
                                curriculum: { select: { name: true, version: true } },
                                subject: { select: { name: true, code: true } },
                                grade: { select: { name: true } },
                            },
                        },
                    },
                },
            },
            orderBy: [
                { learningObjective: { curriculumSubject: { subject: { name: "asc" } } } },
                { learningObjective: { createdAt: "asc" } },
            ],
        });
        // Calculate progress statistics
        const stats = {
            total: progress.length,
            notStarted: progress.filter((p) => p.status === "NOT_STARTED").length,
            inProgress: progress.filter((p) => p.status === "IN_PROGRESS").length,
            completed: progress.filter((p) => p.status === "COMPLETED").length,
            mastered: progress.filter((p) => p.status === "MASTERED").length,
            averageScore: progress.filter((p) => p.assessmentScore !== null).reduce((sum, p) => sum + (p.assessmentScore || 0), 0) /
                progress.filter((p) => p.assessmentScore !== null).length || 0,
        };
        setup_1.logger.info("Student progress retrieved", { userId: req.user?.id, studentId });
        res.status(200).json({
            message: "Student progress retrieved successfully",
            student: {
                id: student.id,
                name: `${student.name} ${student.surname}`,
                registrationNumber: student.registrationNumber,
                class: student.class?.name,
                grade: student.grade?.name,
            },
            progress,
            statistics: stats,
        });
    }
    catch (error) {
        (0, setup_1.handleError)(res, error, "Failed to retrieve student progress");
    }
};
exports.getStudentProgress = getStudentProgress;
const getCurriculumProgress = async (req, res) => {
    const { curriculumId } = req.params;
    const { gradeId, subjectId } = req.query;
    try {
        const filter = (0, setup_1.getTenantFilter)(req.user);
        // Verify curriculum exists and user has access
        const curriculum = await setup_1.prisma.curriculum.findFirst({
            where: {
                id: curriculumId,
                ...filter,
            },
        });
        if (!curriculum) {
            return res.status(404).json({ message: "Curriculum not found or access denied" });
        }
        // Build progress query
        const progressWhere = {
            learningObjective: {
                curriculumSubject: {
                    curriculumId,
                    ...(gradeId && { gradeId: gradeId }),
                    ...(subjectId && { subjectId: subjectId }),
                },
            },
            student: filter,
        };
        const progress = await setup_1.prisma.curriculumProgress.findMany({
            where: progressWhere,
            include: {
                student: {
                    select: {
                        id: true,
                        name: true,
                        surname: true,
                        registrationNumber: true,
                        class: { select: { name: true } },
                        grade: { select: { name: true } },
                    },
                },
                learningObjective: {
                    include: {
                        curriculumSubject: {
                            include: {
                                subject: { select: { name: true, code: true } },
                                grade: { select: { name: true } },
                            },
                        },
                    },
                },
            },
            orderBy: [
                { student: { name: "asc" } },
                { learningObjective: { curriculumSubject: { subject: { name: "asc" } } } },
            ],
        });
        // Group progress by student
        const studentProgress = progress.reduce((acc, p) => {
            const studentId = p.student.id;
            if (!acc[studentId]) {
                acc[studentId] = {
                    student: p.student,
                    objectives: [],
                    stats: {
                        total: 0,
                        notStarted: 0,
                        inProgress: 0,
                        completed: 0,
                        mastered: 0,
                        averageScore: 0,
                    },
                };
            }
            acc[studentId].objectives.push(p);
            return acc;
        }, {});
        // Calculate statistics for each student
        Object.values(studentProgress).forEach((sp) => {
            sp.stats.total = sp.objectives.length;
            sp.stats.notStarted = sp.objectives.filter((o) => o.status === "NOT_STARTED").length;
            sp.stats.inProgress = sp.objectives.filter((o) => o.status === "IN_PROGRESS").length;
            sp.stats.completed = sp.objectives.filter((o) => o.status === "COMPLETED").length;
            sp.stats.mastered = sp.objectives.filter((o) => o.status === "MASTERED").length;
            const scoresWithValues = sp.objectives.filter((o) => o.assessmentScore !== null);
            sp.stats.averageScore =
                scoresWithValues.length > 0
                    ? scoresWithValues.reduce((sum, o) => sum + o.assessmentScore, 0) / scoresWithValues.length
                    : 0;
        });
        setup_1.logger.info("Curriculum progress retrieved", { userId: req.user?.id, curriculumId });
        res.status(200).json({
            message: "Curriculum progress retrieved successfully",
            curriculum: {
                id: curriculum.id,
                name: curriculum.name,
                version: curriculum.version,
            },
            studentProgress: Object.values(studentProgress),
        });
    }
    catch (error) {
        (0, setup_1.handleError)(res, error, "Failed to retrieve curriculum progress");
    }
};
exports.getCurriculumProgress = getCurriculumProgress;
