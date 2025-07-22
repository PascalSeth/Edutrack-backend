"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getClassTimetable = exports.getTeacherTimetable = exports.deleteTimetableSlot = exports.updateTimetableSlot = exports.createTimetableSlot = exports.deleteTimetable = exports.updateTimetable = exports.createTimetable = exports.getTimetableById = exports.getTimetables = void 0;
const zod_1 = require("zod");
const setup_1 = require("../utils/setup");
// Validation Schemas
const createTimetableSchema = zod_1.z.object({
    name: zod_1.z.string().min(1, "Name is required"),
    academicYearId: zod_1.z.string().uuid("Invalid academic year ID"),
    termId: zod_1.z.string().uuid("Invalid term ID").optional(),
    effectiveFrom: zod_1.z.string().datetime("Invalid effective from date"),
    effectiveTo: zod_1.z.string().datetime("Invalid effective to date").optional(),
    schoolId: zod_1.z.string().uuid("Invalid school ID"),
});
const updateTimetableSchema = zod_1.z.object({
    name: zod_1.z.string().min(1).optional(),
    termId: zod_1.z.string().uuid().optional(),
    effectiveFrom: zod_1.z.string().datetime().optional(),
    effectiveTo: zod_1.z.string().datetime().optional(),
    isActive: zod_1.z.boolean().optional(),
});
const createTimetableSlotSchema = zod_1.z.object({
    timetableId: zod_1.z.string().uuid("Invalid timetable ID"),
    day: zod_1.z.enum(["MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY", "FRIDAY", "SATURDAY", "SUNDAY"]),
    startTime: zod_1.z.string().regex(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/, "Invalid time format (HH:MM)"),
    endTime: zod_1.z.string().regex(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/, "Invalid time format (HH:MM)"),
    period: zod_1.z.number().int().min(1, "Period must be a positive integer"),
    lessonId: zod_1.z.string().uuid("Invalid lesson ID"),
    roomId: zod_1.z.string().uuid("Invalid room ID").optional(),
    teacherId: zod_1.z.string().uuid("Invalid teacher ID"),
});
const updateTimetableSlotSchema = zod_1.z.object({
    day: zod_1.z.enum(["MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY", "FRIDAY", "SATURDAY", "SUNDAY"]).optional(),
    startTime: zod_1.z
        .string()
        .regex(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/)
        .optional(),
    endTime: zod_1.z
        .string()
        .regex(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/)
        .optional(),
    period: zod_1.z.number().int().min(1).optional(),
    lessonId: zod_1.z.string().uuid().optional(),
    roomId: zod_1.z.string().uuid().optional(),
    teacherId: zod_1.z.string().uuid().optional(),
    isActive: zod_1.z.boolean().optional(),
    notes: zod_1.z.string().optional(),
});
const getTimetables = async (req, res) => {
    try {
        const page = Number.parseInt(req.query.page) || 1;
        const limit = Number.parseInt(req.query.limit) || 10;
        const skip = (page - 1) * limit;
        const filter = (0, setup_1.getTenantFilter)(req.user);
        const [timetables, total] = await Promise.all([
            setup_1.prisma.timetable.findMany({
                where: filter,
                skip,
                take: limit,
                include: {
                    academicYear: { select: { name: true } },
                    term: { select: { name: true } },
                    slots: {
                        include: {
                            lesson: {
                                include: {
                                    subject: { select: { name: true, code: true } },
                                    class: { select: { name: true } },
                                },
                            },
                            room: { select: { name: true, code: true } },
                            teacher: {
                                include: {
                                    user: { select: { name: true, surname: true } },
                                },
                            },
                        },
                        orderBy: [{ day: "asc" }, { period: "asc" }],
                    },
                    _count: { select: { slots: true } },
                },
                orderBy: { createdAt: "desc" },
            }),
            setup_1.prisma.timetable.count({ where: filter }),
        ]);
        setup_1.logger.info("Timetables retrieved", { userId: req.user?.id, page, limit, total });
        res.status(200).json({
            message: "Timetables retrieved successfully",
            timetables,
            pagination: { page, limit, total, pages: Math.ceil(total / limit) },
        });
    }
    catch (error) {
        (0, setup_1.handleError)(res, error, "Failed to retrieve timetables");
    }
};
exports.getTimetables = getTimetables;
const getTimetableById = async (req, res) => {
    const { id } = req.params;
    try {
        const filter = (0, setup_1.getTenantFilter)(req.user);
        const timetable = await setup_1.prisma.timetable.findFirst({
            where: { id, ...filter },
            include: {
                academicYear: { select: { name: true, startDate: true, endDate: true } },
                term: { select: { name: true, startDate: true, endDate: true } },
                slots: {
                    include: {
                        lesson: {
                            include: {
                                subject: { select: { name: true, code: true } },
                                class: { select: { name: true } },
                            },
                        },
                        room: { select: { name: true, code: true, capacity: true } },
                        teacher: {
                            include: {
                                user: { select: { name: true, surname: true, email: true } },
                            },
                        },
                    },
                    orderBy: [{ day: "asc" }, { period: "asc" }],
                },
            },
        });
        if (!timetable) {
            setup_1.logger.warn("Timetable not found", { userId: req.user?.id, timetableId: id });
            return res.status(404).json({ message: "Timetable not found" });
        }
        setup_1.logger.info("Timetable retrieved", { userId: req.user?.id, timetableId: id });
        res.status(200).json({
            message: "Timetable retrieved successfully",
            timetable,
        });
    }
    catch (error) {
        (0, setup_1.handleError)(res, error, "Failed to retrieve timetable");
    }
};
exports.getTimetableById = getTimetableById;
const createTimetable = async (req, res) => {
    try {
        const data = createTimetableSchema.parse(req.body);
        // Only principals and school admins can create timetables
        if (!["PRINCIPAL", "SCHOOL_ADMIN", "SUPER_ADMIN"].includes(req.user?.role || "")) {
            return res.status(403).json({ message: "Access denied" });
        }
        // Verify school, academic year, and term
        const [school, academicYear, term] = await Promise.all([
            setup_1.prisma.school.findFirst({
                where: {
                    id: data.schoolId,
                    ...(0, setup_1.getTenantFilter)(req.user),
                },
            }),
            setup_1.prisma.academicYear.findFirst({
                where: {
                    id: data.academicYearId,
                    schoolId: data.schoolId,
                },
            }),
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
        if (!academicYear) {
            return res.status(404).json({ message: "Academic year not found" });
        }
        if (data.termId && !term) {
            return res.status(404).json({ message: "Term not found" });
        }
        // Check for overlapping timetables
        const overlappingTimetable = await setup_1.prisma.timetable.findFirst({
            where: {
                schoolId: data.schoolId,
                academicYearId: data.academicYearId,
                termId: data.termId || null,
                isActive: true,
                OR: [
                    {
                        effectiveFrom: { lte: new Date(data.effectiveFrom) },
                        effectiveTo: data.effectiveTo ? { gte: new Date(data.effectiveFrom) } : null,
                    },
                    data.effectiveTo
                        ? {
                            effectiveFrom: { lte: new Date(data.effectiveTo) },
                            effectiveTo: { gte: new Date(data.effectiveTo) },
                        }
                        : {},
                ],
            },
        });
        if (overlappingTimetable) {
            return res.status(409).json({ message: "A timetable already exists for this period" });
        }
        const timetable = await setup_1.prisma.timetable.create({
            data: {
                name: data.name,
                schoolId: data.schoolId,
                academicYearId: data.academicYearId,
                termId: data.termId,
                effectiveFrom: new Date(data.effectiveFrom),
                effectiveTo: data.effectiveTo ? new Date(data.effectiveTo) : null,
            },
            include: {
                academicYear: { select: { name: true } },
                term: { select: { name: true } },
            },
        });
        setup_1.logger.info("Timetable created", {
            userId: req.user?.id,
            timetableId: timetable.id,
            schoolId: data.schoolId,
        });
        res.status(201).json({
            message: "Timetable created successfully",
            timetable,
        });
    }
    catch (error) {
        if (error instanceof zod_1.z.ZodError) {
            return res.status(400).json({ message: "Invalid input", errors: error.errors });
        }
        (0, setup_1.handleError)(res, error, "Failed to create timetable");
    }
};
exports.createTimetable = createTimetable;
const updateTimetable = async (req, res) => {
    const { id } = req.params;
    try {
        const data = updateTimetableSchema.parse(req.body);
        // Only principals and school admins can update timetables
        if (!["PRINCIPAL", "SCHOOL_ADMIN", "SUPER_ADMIN"].includes(req.user?.role || "")) {
            return res.status(403).json({ message: "Access denied" });
        }
        const filter = (0, setup_1.getTenantFilter)(req.user);
        const existingTimetable = await setup_1.prisma.timetable.findFirst({
            where: { id, ...filter },
        });
        if (!existingTimetable) {
            return res.status(404).json({ message: "Timetable not found or access denied" });
        }
        // Verify term if provided
        if (data.termId) {
            const term = await setup_1.prisma.term.findFirst({
                where: {
                    id: data.termId,
                    schoolId: existingTimetable.schoolId,
                },
            });
            if (!term) {
                return res.status(404).json({ message: "Term not found" });
            }
        }
        const timetable = await setup_1.prisma.timetable.update({
            where: { id },
            data: {
                ...(data.name && { name: data.name }),
                ...(data.termId !== undefined && { termId: data.termId }),
                ...(data.effectiveFrom && { effectiveFrom: new Date(data.effectiveFrom) }),
                ...(data.effectiveTo !== undefined && {
                    effectiveTo: data.effectiveTo ? new Date(data.effectiveTo) : null,
                }),
                ...(data.isActive !== undefined && { isActive: data.isActive }),
            },
            include: {
                academicYear: { select: { name: true } },
                term: { select: { name: true } },
            },
        });
        setup_1.logger.info("Timetable updated", { userId: req.user?.id, timetableId: id });
        res.status(200).json({
            message: "Timetable updated successfully",
            timetable,
        });
    }
    catch (error) {
        if (error instanceof zod_1.z.ZodError) {
            return res.status(400).json({ message: "Invalid input", errors: error.errors });
        }
        (0, setup_1.handleError)(res, error, "Failed to update timetable");
    }
};
exports.updateTimetable = updateTimetable;
const deleteTimetable = async (req, res) => {
    const { id } = req.params;
    try {
        // Only principals and school admins can delete timetables
        if (!["PRINCIPAL", "SCHOOL_ADMIN", "SUPER_ADMIN"].includes(req.user?.role || "")) {
            return res.status(403).json({ message: "Access denied" });
        }
        const filter = (0, setup_1.getTenantFilter)(req.user);
        const timetable = await setup_1.prisma.timetable.findFirst({
            where: { id, ...filter },
            include: {
                _count: { select: { slots: true } },
            },
        });
        if (!timetable) {
            return res.status(404).json({ message: "Timetable not found or access denied" });
        }
        // Check if timetable has slots
        if (timetable._count.slots > 0) {
            return res.status(400).json({
                message: "Cannot delete timetable with existing slots. Please remove all slots first.",
            });
        }
        await setup_1.prisma.timetable.delete({ where: { id } });
        setup_1.logger.info("Timetable deleted", { userId: req.user?.id, timetableId: id });
        res.status(200).json({ message: "Timetable deleted successfully" });
    }
    catch (error) {
        (0, setup_1.handleError)(res, error, "Failed to delete timetable");
    }
};
exports.deleteTimetable = deleteTimetable;
// Timetable Slot Management
const createTimetableSlot = async (req, res) => {
    try {
        const data = createTimetableSlotSchema.parse(req.body);
        // Only principals, school admins, and teachers can create slots
        if (!["PRINCIPAL", "SCHOOL_ADMIN", "TEACHER", "SUPER_ADMIN"].includes(req.user?.role || "")) {
            return res.status(403).json({ message: "Access denied" });
        }
        // Verify timetable, lesson, room, and teacher
        const [timetable, lesson, room, teacher] = await Promise.all([
            setup_1.prisma.timetable.findFirst({
                where: {
                    id: data.timetableId,
                    ...(0, setup_1.getTenantFilter)(req.user),
                },
            }),
            setup_1.prisma.lesson.findUnique({
                where: { id: data.lessonId },
                include: { subject: true, class: true },
            }),
            data.roomId
                ? setup_1.prisma.room.findFirst({
                    where: {
                        id: data.roomId,
                        ...(0, setup_1.getTenantFilter)(req.user),
                    },
                })
                : null,
            setup_1.prisma.teacher.findFirst({
                where: {
                    id: data.teacherId,
                    ...(0, setup_1.getTenantFilter)(req.user),
                },
            }),
        ]);
        if (!timetable) {
            return res.status(404).json({ message: "Timetable not found or access denied" });
        }
        if (!lesson) {
            return res.status(404).json({ message: "Lesson not found" });
        }
        if (data.roomId && !room) {
            return res.status(404).json({ message: "Room not found or access denied" });
        }
        if (!teacher) {
            return res.status(404).json({ message: "Teacher not found or access denied" });
        }
        // Check for conflicts
        const conflicts = await setup_1.prisma.timetableSlot.findFirst({
            where: {
                timetableId: data.timetableId,
                day: data.day,
                period: data.period,
                isActive: true,
            },
        });
        if (conflicts) {
            return res.status(409).json({ message: "Time slot already occupied" });
        }
        // Check teacher availability
        const teacherConflict = await setup_1.prisma.timetableSlot.findFirst({
            where: {
                teacherId: data.teacherId,
                day: data.day,
                startTime: data.startTime,
                endTime: data.endTime,
                isActive: true,
                timetable: { isActive: true },
            },
        });
        if (teacherConflict) {
            return res.status(409).json({ message: "Teacher is not available at this time" });
        }
        // Check room availability
        if (data.roomId) {
            const roomConflict = await setup_1.prisma.timetableSlot.findFirst({
                where: {
                    roomId: data.roomId,
                    day: data.day,
                    startTime: data.startTime,
                    endTime: data.endTime,
                    isActive: true,
                    timetable: { isActive: true },
                },
            });
            if (roomConflict) {
                return res.status(409).json({ message: "Room is not available at this time" });
            }
        }
        const slot = await setup_1.prisma.timetableSlot.create({
            data: {
                timetableId: data.timetableId,
                day: data.day,
                startTime: data.startTime,
                endTime: data.endTime,
                period: data.period,
                lessonId: data.lessonId,
                roomId: data.roomId,
                teacherId: data.teacherId,
            },
            include: {
                lesson: {
                    include: {
                        subject: { select: { name: true, code: true } },
                        class: { select: { name: true } },
                    },
                },
                room: { select: { name: true, code: true } },
                teacher: {
                    include: {
                        user: { select: { name: true, surname: true } },
                    },
                },
            },
        });
        setup_1.logger.info("Timetable slot created", {
            userId: req.user?.id,
            slotId: slot.id,
            timetableId: data.timetableId,
        });
        res.status(201).json({
            message: "Timetable slot created successfully",
            slot,
        });
    }
    catch (error) {
        if (error instanceof zod_1.z.ZodError) {
            return res.status(400).json({ message: "Invalid input", errors: error.errors });
        }
        (0, setup_1.handleError)(res, error, "Failed to create timetable slot");
    }
};
exports.createTimetableSlot = createTimetableSlot;
const updateTimetableSlot = async (req, res) => {
    const { id } = req.params;
    try {
        const data = updateTimetableSlotSchema.parse(req.body);
        // Only principals, school admins, and teachers can update slots
        if (!["PRINCIPAL", "SCHOOL_ADMIN", "TEACHER", "SUPER_ADMIN"].includes(req.user?.role || "")) {
            return res.status(403).json({ message: "Access denied" });
        }
        const existingSlot = await setup_1.prisma.timetableSlot.findFirst({
            where: {
                id,
                timetable: (0, setup_1.getTenantFilter)(req.user),
            },
        });
        if (!existingSlot) {
            return res.status(404).json({ message: "Timetable slot not found or access denied" });
        }
        // Verify lesson, room, and teacher if provided
        if (data.lessonId) {
            const lesson = await setup_1.prisma.lesson.findUnique({ where: { id: data.lessonId } });
            if (!lesson) {
                return res.status(404).json({ message: "Lesson not found" });
            }
        }
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
        if (data.teacherId) {
            const teacher = await setup_1.prisma.teacher.findFirst({
                where: {
                    id: data.teacherId,
                    ...(0, setup_1.getTenantFilter)(req.user),
                },
            });
            if (!teacher) {
                return res.status(404).json({ message: "Teacher not found or access denied" });
            }
        }
        const slot = await setup_1.prisma.timetableSlot.update({
            where: { id },
            data: {
                ...(data.day && { day: data.day }),
                ...(data.startTime && { startTime: data.startTime }),
                ...(data.endTime && { endTime: data.endTime }),
                ...(data.period && { period: data.period }),
                ...(data.lessonId && { lessonId: data.lessonId }),
                ...(data.roomId !== undefined && { roomId: data.roomId }),
                ...(data.teacherId && { teacherId: data.teacherId }),
                ...(data.isActive !== undefined && { isActive: data.isActive }),
                ...(data.notes !== undefined && { notes: data.notes }),
            },
            include: {
                lesson: {
                    include: {
                        subject: { select: { name: true, code: true } },
                        class: { select: { name: true } },
                    },
                },
                room: { select: { name: true, code: true } },
                teacher: {
                    include: {
                        user: { select: { name: true, surname: true } },
                    },
                },
            },
        });
        setup_1.logger.info("Timetable slot updated", { userId: req.user?.id, slotId: id });
        res.status(200).json({
            message: "Timetable slot updated successfully",
            slot,
        });
    }
    catch (error) {
        if (error instanceof zod_1.z.ZodError) {
            return res.status(400).json({ message: "Invalid input", errors: error.errors });
        }
        (0, setup_1.handleError)(res, error, "Failed to update timetable slot");
    }
};
exports.updateTimetableSlot = updateTimetableSlot;
const deleteTimetableSlot = async (req, res) => {
    const { id } = req.params;
    try {
        // Only principals, school admins, and teachers can delete slots
        if (!["PRINCIPAL", "SCHOOL_ADMIN", "TEACHER", "SUPER_ADMIN"].includes(req.user?.role || "")) {
            return res.status(403).json({ message: "Access denied" });
        }
        const slot = await setup_1.prisma.timetableSlot.findFirst({
            where: {
                id,
                timetable: (0, setup_1.getTenantFilter)(req.user),
            },
        });
        if (!slot) {
            return res.status(404).json({ message: "Timetable slot not found or access denied" });
        }
        await setup_1.prisma.timetableSlot.delete({ where: { id } });
        setup_1.logger.info("Timetable slot deleted", { userId: req.user?.id, slotId: id });
        res.status(200).json({ message: "Timetable slot deleted successfully" });
    }
    catch (error) {
        (0, setup_1.handleError)(res, error, "Failed to delete timetable slot");
    }
};
exports.deleteTimetableSlot = deleteTimetableSlot;
const getTeacherTimetable = async (req, res) => {
    const { teacherId } = req.params;
    try {
        const filter = (0, setup_1.getTenantFilter)(req.user);
        // Verify teacher exists and user has access
        const teacher = await setup_1.prisma.teacher.findFirst({
            where: {
                id: teacherId,
                ...filter,
            },
            include: {
                user: { select: { name: true, surname: true } },
            },
        });
        if (!teacher) {
            return res.status(404).json({ message: "Teacher not found or access denied" });
        }
        // Get active timetable slots for the teacher
        const slots = await setup_1.prisma.timetableSlot.findMany({
            where: {
                teacherId,
                isActive: true,
                timetable: {
                    isActive: true,
                    ...filter,
                },
            },
            include: {
                lesson: {
                    include: {
                        subject: { select: { name: true, code: true } },
                        class: { select: { name: true } },
                    },
                },
                room: { select: { name: true, code: true } },
                timetable: {
                    select: {
                        name: true,
                        academicYear: { select: { name: true } },
                        term: { select: { name: true } },
                    },
                },
            },
            orderBy: [{ day: "asc" }, { period: "asc" }],
        });
        setup_1.logger.info("Teacher timetable retrieved", { userId: req.user?.id, teacherId });
        res.status(200).json({
            message: "Teacher timetable retrieved successfully",
            teacher: {
                id: teacher.id,
                name: `${teacher.user.name} ${teacher.user.surname}`,
            },
            slots,
        });
    }
    catch (error) {
        (0, setup_1.handleError)(res, error, "Failed to retrieve teacher timetable");
    }
};
exports.getTeacherTimetable = getTeacherTimetable;
const getClassTimetable = async (req, res) => {
    const { classId } = req.params;
    try {
        const filter = (0, setup_1.getTenantFilter)(req.user);
        // Verify class exists and user has access
        const classRecord = await setup_1.prisma.class.findFirst({
            where: {
                id: classId,
                ...filter,
            },
            include: {
                grade: { select: { name: true } },
            },
        });
        if (!classRecord) {
            return res.status(404).json({ message: "Class not found or access denied" });
        }
        // Get active timetable slots for the class
        const slots = await setup_1.prisma.timetableSlot.findMany({
            where: {
                lesson: {
                    classId,
                },
                isActive: true,
                timetable: {
                    isActive: true,
                    ...filter,
                },
            },
            include: {
                lesson: {
                    include: {
                        subject: { select: { name: true, code: true } },
                    },
                },
                room: { select: { name: true, code: true } },
                teacher: {
                    include: {
                        user: { select: { name: true, surname: true } },
                    },
                },
                timetable: {
                    select: {
                        name: true,
                        academicYear: { select: { name: true } },
                        term: { select: { name: true } },
                    },
                },
            },
            orderBy: [{ day: "asc" }, { period: "asc" }],
        });
        setup_1.logger.info("Class timetable retrieved", { userId: req.user?.id, classId });
        res.status(200).json({
            message: "Class timetable retrieved successfully",
            class: {
                id: classRecord.id,
                name: classRecord.name,
                grade: classRecord.grade?.name,
            },
            slots,
        });
    }
    catch (error) {
        (0, setup_1.handleError)(res, error, "Failed to retrieve class timetable");
    }
};
exports.getClassTimetable = getClassTimetable;
