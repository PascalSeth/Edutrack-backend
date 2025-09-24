"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getAcademicCalendar = exports.getCalendarItems = exports.createCalendarItem = exports.deleteHoliday = exports.updateHoliday = exports.createHoliday = exports.getHolidays = exports.deleteTerm = exports.updateTerm = exports.createTerm = exports.getTermById = exports.getTerms = void 0;
const zod_1 = require("zod");
const setup_1 = require("../utils/setup");
// Validation Schemas
const createTermSchema = zod_1.z.object({
    name: zod_1.z.string().min(1, "Name is required"),
    startDate: zod_1.z.string().datetime("Invalid start date"),
    endDate: zod_1.z.string().datetime("Invalid end date"),
    schoolId: zod_1.z.string().uuid("Invalid school ID"),
    academicYearId: zod_1.z.string().uuid("Invalid academic year ID"),
});
const updateTermSchema = zod_1.z.object({
    name: zod_1.z.string().min(1).optional(),
    startDate: zod_1.z.string().datetime().optional(),
    endDate: zod_1.z.string().datetime().optional(),
    isActive: zod_1.z.boolean().optional(),
});
const createHolidaySchema = zod_1.z.object({
    name: zod_1.z.string().min(1, "Name is required"),
    description: zod_1.z.string().optional(),
    startDate: zod_1.z.string().datetime("Invalid start date"),
    endDate: zod_1.z.string().datetime("Invalid end date"),
    holidayType: zod_1.z.enum(["PUBLIC", "SCHOOL_SPECIFIC", "RELIGIOUS", "NATIONAL", "REGIONAL"]),
    isRecurring: zod_1.z.boolean().default(false),
    schoolId: zod_1.z.string().uuid("Invalid school ID"),
});
const updateHolidaySchema = zod_1.z.object({
    name: zod_1.z.string().min(1).optional(),
    description: zod_1.z.string().optional(),
    startDate: zod_1.z.string().datetime().optional(),
    endDate: zod_1.z.string().datetime().optional(),
    holidayType: zod_1.z.enum(["PUBLIC", "SCHOOL_SPECIFIC", "RELIGIOUS", "NATIONAL", "REGIONAL"]).optional(),
    isRecurring: zod_1.z.boolean().optional(),
});
const createCalendarItemSchema = zod_1.z.object({
    title: zod_1.z.string().min(1, "Title is required"),
    description: zod_1.z.string().optional(),
    startDate: zod_1.z.string().datetime("Invalid start date"),
    endDate: zod_1.z.string().datetime("Invalid end date"),
    itemType: zod_1.z.enum([
        "HOLIDAY",
        "EXAM_PERIOD",
        "TERM_START",
        "TERM_END",
        "SPECIAL_EVENT",
        "SPORTS_DAY",
        "PARENT_TEACHER_MEETING",
        "OTHER",
    ]),
    isAllDay: zod_1.z.boolean().default(false),
    academicCalendarId: zod_1.z.string().uuid("Invalid academic calendar ID"),
    termId: zod_1.z.string().uuid("Invalid term ID").optional(),
});
// Term Management
const getTerms = async (req, res) => {
    try {
        const page = Number.parseInt(req.query.page) || 1;
        const limit = Number.parseInt(req.query.limit) || 10;
        const skip = (page - 1) * limit;
        const filter = (0, setup_1.getTenantFilter)(req.user);
        const [terms, total] = await Promise.all([
            setup_1.prisma.term.findMany({
                where: filter,
                skip,
                take: limit,
                include: {
                    academicYear: { select: { name: true } },
                    _count: {
                        select: {
                            timetables: true,
                            exams: true,
                            reportCards: true,
                        },
                    },
                },
                orderBy: [{ academicYear: { startDate: "desc" } }, { startDate: "asc" }],
            }),
            setup_1.prisma.term.count({ where: filter }),
        ]);
        setup_1.logger.info("Terms retrieved", { userId: req.user?.id, page, limit, total });
        res.status(200).json({
            message: "Terms retrieved successfully",
            terms,
            pagination: { page, limit, total, pages: Math.ceil(total / limit) },
        });
    }
    catch (error) {
        (0, setup_1.handleError)(res, error, "Failed to retrieve terms");
    }
};
exports.getTerms = getTerms;
const getTermById = async (req, res) => {
    const { id } = req.params;
    try {
        const filter = (0, setup_1.getTenantFilter)(req.user);
        const term = await setup_1.prisma.term.findFirst({
            where: { id, ...filter },
            include: {
                academicYear: { select: { name: true, startDate: true, endDate: true } },
                timetables: {
                    select: {
                        id: true,
                        name: true,
                        isActive: true,
                        effectiveFrom: true,
                        effectiveTo: true,
                    },
                    orderBy: { effectiveFrom: "desc" },
                },
                exams: {
                    select: {
                        id: true,
                        title: true,
                        examType: true,
                        startDate: true,
                        endDate: true,
                        status: true,
                        subject: { select: { name: true } },
                    },
                    orderBy: { startDate: "asc" },
                },
                reportCards: {
                    select: {
                        id: true,
                        title: true,
                        status: true,
                        student: {
                            select: {
                                name: true,
                                surname: true,
                                registrationNumber: true,
                            },
                        },
                    },
                    orderBy: { createdAt: "desc" },
                    take: 10, // Latest 10 report cards
                },
                _count: {
                    select: {
                        timetables: true,
                        exams: true,
                        reportCards: true,
                    },
                },
            },
        });
        if (!term) {
            setup_1.logger.warn("Term not found", { userId: req.user?.id, termId: id });
            return res.status(404).json({ message: "Term not found" });
        }
        setup_1.logger.info("Term retrieved", { userId: req.user?.id, termId: id });
        res.status(200).json({
            message: "Term retrieved successfully",
            term,
        });
    }
    catch (error) {
        (0, setup_1.handleError)(res, error, "Failed to retrieve term");
    }
};
exports.getTermById = getTermById;
const createTerm = async (req, res) => {
    try {
        const data = createTermSchema.parse(req.body);
        // Only principals and school admins can create terms
        if (!["PRINCIPAL", "SCHOOL_ADMIN", "SUPER_ADMIN"].includes(req.user?.role || "")) {
            return res.status(403).json({ message: "Access denied" });
        }
        // Verify school and academic year
        const [school, academicYear] = await Promise.all([
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
        ]);
        if (!school) {
            return res.status(404).json({ message: "School not found or access denied" });
        }
        if (!academicYear) {
            return res.status(404).json({ message: "Academic year not found" });
        }
        // Validate dates
        const startDate = new Date(data.startDate);
        const endDate = new Date(data.endDate);
        if (startDate >= endDate) {
            return res.status(400).json({ message: "End date must be after start date" });
        }
        if (startDate < academicYear.startDate || endDate > academicYear.endDate) {
            return res.status(400).json({ message: "Term dates must be within the academic year" });
        }
        // Check for overlapping terms
        const overlappingTerm = await setup_1.prisma.term.findFirst({
            where: {
                schoolId: data.schoolId,
                academicYearId: data.academicYearId,
                OR: [
                    {
                        startDate: { lte: startDate },
                        endDate: { gte: startDate },
                    },
                    {
                        startDate: { lte: endDate },
                        endDate: { gte: endDate },
                    },
                    {
                        startDate: { gte: startDate },
                        endDate: { lte: endDate },
                    },
                ],
            },
        });
        if (overlappingTerm) {
            return res.status(409).json({ message: "Term dates overlap with existing term" });
        }
        const term = await setup_1.prisma.term.create({
            data: {
                name: data.name,
                startDate,
                endDate,
                schoolId: data.schoolId,
                academicYearId: data.academicYearId,
            },
            include: {
                academicYear: { select: { name: true } },
            },
        });
        setup_1.logger.info("Term created", {
            userId: req.user?.id,
            termId: term.id,
            schoolId: data.schoolId,
        });
        res.status(201).json({
            message: "Term created successfully",
            term,
        });
    }
    catch (error) {
        if (error instanceof zod_1.z.ZodError) {
            return res.status(400).json({ message: "Invalid input", errors: error.errors });
        }
        (0, setup_1.handleError)(res, error, "Failed to create term");
    }
};
exports.createTerm = createTerm;
const updateTerm = async (req, res) => {
    const { id } = req.params;
    try {
        const data = updateTermSchema.parse(req.body);
        // Only principals and school admins can update terms
        if (!["PRINCIPAL", "SCHOOL_ADMIN", "SUPER_ADMIN"].includes(req.user?.role || "")) {
            return res.status(403).json({ message: "Access denied" });
        }
        const filter = (0, setup_1.getTenantFilter)(req.user);
        const existingTerm = await setup_1.prisma.term.findFirst({
            where: { id, ...filter },
            include: {
                academicYear: { select: { startDate: true, endDate: true } },
            },
        });
        if (!existingTerm) {
            return res.status(404).json({ message: "Term not found or access denied" });
        }
        // Validate dates if provided
        if (data.startDate || data.endDate) {
            const startDate = data.startDate ? new Date(data.startDate) : existingTerm.startDate;
            const endDate = data.endDate ? new Date(data.endDate) : existingTerm.endDate;
            if (startDate >= endDate) {
                return res.status(400).json({ message: "End date must be after start date" });
            }
            if (startDate < existingTerm.academicYear.startDate || endDate > existingTerm.academicYear.endDate) {
                return res.status(400).json({ message: "Term dates must be within the academic year" });
            }
        }
        const term = await setup_1.prisma.term.update({
            where: { id },
            data: {
                ...(data.name && { name: data.name }),
                ...(data.startDate && { startDate: new Date(data.startDate) }),
                ...(data.endDate && { endDate: new Date(data.endDate) }),
                ...(data.isActive !== undefined && { isActive: data.isActive }),
            },
            include: {
                academicYear: { select: { name: true } },
            },
        });
        setup_1.logger.info("Term updated", { userId: req.user?.id, termId: id });
        res.status(200).json({
            message: "Term updated successfully",
            term,
        });
    }
    catch (error) {
        if (error instanceof zod_1.z.ZodError) {
            return res.status(400).json({ message: "Invalid input", errors: error.errors });
        }
        (0, setup_1.handleError)(res, error, "Failed to update term");
    }
};
exports.updateTerm = updateTerm;
const deleteTerm = async (req, res) => {
    const { id } = req.params;
    try {
        // Only principals and school admins can delete terms
        if (!["PRINCIPAL", "SCHOOL_ADMIN", "SUPER_ADMIN"].includes(req.user?.role || "")) {
            return res.status(403).json({ message: "Access denied" });
        }
        const filter = (0, setup_1.getTenantFilter)(req.user);
        const term = await setup_1.prisma.term.findFirst({
            where: { id, ...filter },
            include: {
                _count: {
                    select: {
                        timetables: true,
                        exams: true,
                        reportCards: true,
                    },
                },
            },
        });
        if (!term) {
            return res.status(404).json({ message: "Term not found or access denied" });
        }
        // Check if term is being used
        const hasUsage = term._count.timetables > 0 || term._count.exams > 0 || term._count.reportCards > 0;
        if (hasUsage) {
            return res.status(400).json({
                message: "Cannot delete term that is being used in timetables, exams, or report cards",
            });
        }
        await setup_1.prisma.term.delete({ where: { id } });
        setup_1.logger.info("Term deleted", { userId: req.user?.id, termId: id });
        res.status(200).json({ message: "Term deleted successfully" });
    }
    catch (error) {
        (0, setup_1.handleError)(res, error, "Failed to delete term");
    }
};
exports.deleteTerm = deleteTerm;
// Holiday Management
const getHolidays = async (req, res) => {
    try {
        const page = Number.parseInt(req.query.page) || 1;
        const limit = Number.parseInt(req.query.limit) || 10;
        const skip = (page - 1) * limit;
        const filter = (0, setup_1.getTenantFilter)(req.user);
        const [holidays, total] = await Promise.all([
            setup_1.prisma.holiday.findMany({
                where: filter,
                skip,
                take: limit,
                orderBy: { startDate: "asc" },
            }),
            setup_1.prisma.holiday.count({ where: filter }),
        ]);
        setup_1.logger.info("Holidays retrieved", { userId: req.user?.id, page, limit, total });
        res.status(200).json({
            message: "Holidays retrieved successfully",
            holidays,
            pagination: { page, limit, total, pages: Math.ceil(total / limit) },
        });
    }
    catch (error) {
        (0, setup_1.handleError)(res, error, "Failed to retrieve holidays");
    }
};
exports.getHolidays = getHolidays;
const createHoliday = async (req, res) => {
    try {
        const data = createHolidaySchema.parse(req.body);
        // Only principals and school admins can create holidays
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
        // Validate dates
        const startDate = new Date(data.startDate);
        const endDate = new Date(data.endDate);
        if (startDate > endDate) {
            return res.status(400).json({ message: "End date must be on or after start date" });
        }
        const holiday = await setup_1.prisma.holiday.create({
            data: {
                name: data.name,
                description: data.description,
                startDate,
                endDate,
                holidayType: data.holidayType,
                isRecurring: data.isRecurring,
                schoolId: data.schoolId,
            },
        });
        setup_1.logger.info("Holiday created", {
            userId: req.user?.id,
            holidayId: holiday.id,
            schoolId: data.schoolId,
        });
        res.status(201).json({
            message: "Holiday created successfully",
            holiday,
        });
    }
    catch (error) {
        if (error instanceof zod_1.z.ZodError) {
            return res.status(400).json({ message: "Invalid input", errors: error.errors });
        }
        (0, setup_1.handleError)(res, error, "Failed to create holiday");
    }
};
exports.createHoliday = createHoliday;
const updateHoliday = async (req, res) => {
    const { id } = req.params;
    try {
        const data = updateHolidaySchema.parse(req.body);
        // Only principals and school admins can update holidays
        if (!["PRINCIPAL", "SCHOOL_ADMIN", "SUPER_ADMIN"].includes(req.user?.role || "")) {
            return res.status(403).json({ message: "Access denied" });
        }
        const filter = (0, setup_1.getTenantFilter)(req.user);
        const existingHoliday = await setup_1.prisma.holiday.findFirst({
            where: { id, ...filter },
        });
        if (!existingHoliday) {
            return res.status(404).json({ message: "Holiday not found or access denied" });
        }
        // Validate dates if provided
        if (data.startDate || data.endDate) {
            const startDate = data.startDate ? new Date(data.startDate) : existingHoliday.startDate;
            const endDate = data.endDate ? new Date(data.endDate) : existingHoliday.endDate;
            if (startDate > endDate) {
                return res.status(400).json({ message: "End date must be on or after start date" });
            }
        }
        const holiday = await setup_1.prisma.holiday.update({
            where: { id },
            data: {
                ...(data.name && { name: data.name }),
                ...(data.description !== undefined && { description: data.description }),
                ...(data.startDate && { startDate: new Date(data.startDate) }),
                ...(data.endDate && { endDate: new Date(data.endDate) }),
                ...(data.holidayType && { holidayType: data.holidayType }),
                ...(data.isRecurring !== undefined && { isRecurring: data.isRecurring }),
            },
        });
        setup_1.logger.info("Holiday updated", { userId: req.user?.id, holidayId: id });
        res.status(200).json({
            message: "Holiday updated successfully",
            holiday,
        });
    }
    catch (error) {
        if (error instanceof zod_1.z.ZodError) {
            return res.status(400).json({ message: "Invalid input", errors: error.errors });
        }
        (0, setup_1.handleError)(res, error, "Failed to update holiday");
    }
};
exports.updateHoliday = updateHoliday;
const deleteHoliday = async (req, res) => {
    const { id } = req.params;
    try {
        // Only principals and school admins can delete holidays
        if (!["PRINCIPAL", "SCHOOL_ADMIN", "SUPER_ADMIN"].includes(req.user?.role || "")) {
            return res.status(403).json({ message: "Access denied" });
        }
        const filter = (0, setup_1.getTenantFilter)(req.user);
        const holiday = await setup_1.prisma.holiday.findFirst({
            where: { id, ...filter },
        });
        if (!holiday) {
            return res.status(404).json({ message: "Holiday not found or access denied" });
        }
        await setup_1.prisma.holiday.delete({ where: { id } });
        setup_1.logger.info("Holiday deleted", { userId: req.user?.id, holidayId: id });
        res.status(200).json({ message: "Holiday deleted successfully" });
    }
    catch (error) {
        (0, setup_1.handleError)(res, error, "Failed to delete holiday");
    }
};
exports.deleteHoliday = deleteHoliday;
// Calendar Item Management
const createCalendarItem = async (req, res) => {
    try {
        const data = createCalendarItemSchema.parse(req.body);
        // Only principals and school admins can create calendar items
        if (!["PRINCIPAL", "SCHOOL_ADMIN", "SUPER_ADMIN"].includes(req.user?.role || "")) {
            return res.status(403).json({ message: "Access denied" });
        }
        // Verify academic calendar exists and user has access
        const academicCalendar = await setup_1.prisma.academicCalendar.findFirst({
            where: {
                id: data.academicCalendarId,
                ...(0, setup_1.getTenantFilter)(req.user),
            },
        });
        if (!academicCalendar) {
            return res.status(404).json({ message: "Academic calendar not found or access denied" });
        }
        // If termId is provided, verify it exists and belongs to the same school
        if (data.termId) {
            const term = await setup_1.prisma.term.findFirst({
                where: {
                    id: data.termId,
                    schoolId: academicCalendar.schoolId,
                },
            });
            if (!term) {
                return res.status(404).json({ message: "Term not found or does not belong to the same school" });
            }
        }
        // Validate dates
        const startDate = new Date(data.startDate);
        const endDate = new Date(data.endDate);
        if (startDate > endDate) {
            return res.status(400).json({ message: "End date must be on or after start date" });
        }
        const calendarItem = await setup_1.prisma.calendarItem.create({
            data: {
                title: data.title,
                description: data.description,
                startDate,
                endDate,
                itemType: data.itemType,
                isAllDay: data.isAllDay,
                academicCalendarId: data.academicCalendarId,
                termId: data.termId,
            },
        });
        setup_1.logger.info("Calendar item created", {
            userId: req.user?.id,
            calendarItemId: calendarItem.id,
            academicCalendarId: data.academicCalendarId,
            termId: data.termId,
        });
        res.status(201).json({
            message: "Calendar item created successfully",
            calendarItem,
        });
    }
    catch (error) {
        if (error instanceof zod_1.z.ZodError) {
            return res.status(400).json({ message: "Invalid input", errors: error.errors });
        }
        (0, setup_1.handleError)(res, error, "Failed to create calendar item");
    }
};
exports.createCalendarItem = createCalendarItem;
const getCalendarItems = async (req, res) => {
    const { academicCalendarId } = req.params;
    const { startDate, endDate } = req.query;
    try {
        // Verify academic calendar exists and user has access
        const academicCalendar = await setup_1.prisma.academicCalendar.findFirst({
            where: {
                id: academicCalendarId,
                ...(0, setup_1.getTenantFilter)(req.user),
            },
        });
        if (!academicCalendar) {
            return res.status(404).json({ message: "Academic calendar not found or access denied" });
        }
        // Build query filters
        const where = { academicCalendarId };
        if (startDate && endDate) {
            where.OR = [
                {
                    startDate: {
                        gte: new Date(startDate),
                        lte: new Date(endDate),
                    },
                },
                {
                    endDate: {
                        gte: new Date(startDate),
                        lte: new Date(endDate),
                    },
                },
                {
                    startDate: { lte: new Date(startDate) },
                    endDate: { gte: new Date(endDate) },
                },
            ];
        }
        const calendarItems = await setup_1.prisma.calendarItem.findMany({
            where,
            include: {
                term: { select: { id: true, name: true, startDate: true, endDate: true } },
            },
            orderBy: { startDate: "asc" },
        });
        setup_1.logger.info("Calendar items retrieved", { userId: req.user?.id, academicCalendarId });
        res.status(200).json({
            message: "Calendar items retrieved successfully",
            calendarItems,
        });
    }
    catch (error) {
        (0, setup_1.handleError)(res, error, "Failed to retrieve calendar items");
    }
};
exports.getCalendarItems = getCalendarItems;
const getAcademicCalendar = async (req, res) => {
    const { startDate, endDate } = req.query;
    try {
        const filter = (0, setup_1.getTenantFilter)(req.user);
        if (!startDate || !endDate) {
            return res.status(400).json({ message: "Start date and end date are required" });
        }
        const start = new Date(startDate);
        const end = new Date(endDate);
        // Get terms within the date range
        const terms = await setup_1.prisma.term.findMany({
            where: {
                ...filter,
                OR: [
                    {
                        startDate: { gte: start, lte: end },
                    },
                    {
                        endDate: { gte: start, lte: end },
                    },
                    {
                        startDate: { lte: start },
                        endDate: { gte: end },
                    },
                ],
            },
            include: {
                academicYear: { select: { name: true } },
            },
            orderBy: { startDate: "asc" },
        });
        // Get holidays within the date range
        const holidays = await setup_1.prisma.holiday.findMany({
            where: {
                ...filter,
                OR: [
                    {
                        startDate: { gte: start, lte: end },
                    },
                    {
                        endDate: { gte: start, lte: end },
                    },
                    {
                        startDate: { lte: start },
                        endDate: { gte: end },
                    },
                ],
            },
            orderBy: { startDate: "asc" },
        });
        // Get exams within the date range
        const exams = await setup_1.prisma.exam.findMany({
            where: {
                ...filter,
                OR: [
                    {
                        startDate: { gte: start, lte: end },
                    },
                    {
                        endDate: { gte: start, lte: end },
                    },
                    {
                        startDate: { lte: start },
                        endDate: { gte: end },
                    },
                ],
                status: { not: "CANCELLED" },
            },
            include: {
                subject: { select: { name: true } },
                grade: { select: { name: true } },
                class: { select: { name: true } },
            },
            orderBy: { startDate: "asc" },
        });
        // Get events within the date range
        const events = await setup_1.prisma.event.findMany({
            where: {
                ...filter,
                OR: [
                    {
                        startTime: { gte: start, lte: end },
                    },
                    {
                        endTime: { gte: start, lte: end },
                    },
                    {
                        startTime: { lte: start },
                        endTime: { gte: end },
                    },
                ],
            },
            select: {
                id: true,
                title: true,
                description: true,
                startTime: true,
                endTime: true,
                eventType: true,
                location: true,
            },
            orderBy: { startTime: "asc" },
        });
        // Get calendar items within the date range
        const calendarItems = await setup_1.prisma.calendarItem.findMany({
            where: {
                ...filter,
                OR: [
                    {
                        startDate: { gte: start, lte: end },
                    },
                    {
                        endDate: { gte: start, lte: end },
                    },
                    {
                        startDate: { lte: start },
                        endDate: { gte: end },
                    },
                ],
            },
            include: {
                term: { select: { id: true, name: true } },
            },
            orderBy: { startDate: "asc" },
        });
        setup_1.logger.info("Academic calendar retrieved", { userId: req.user?.id, startDate, endDate });
        res.status(200).json({
            message: "Academic calendar retrieved successfully",
            period: { startDate: start, endDate: end },
            calendar: {
                terms,
                holidays,
                exams,
                events,
                calendarItems,
            },
        });
    }
    catch (error) {
        (0, setup_1.handleError)(res, error, "Failed to retrieve academic calendar");
    }
};
exports.getAcademicCalendar = getAcademicCalendar;
