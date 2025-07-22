"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getRoomUtilization = exports.getRoomAvailability = exports.deleteRoom = exports.updateRoom = exports.createRoom = exports.getRoomById = exports.getRooms = void 0;
const zod_1 = require("zod");
const setup_1 = require("../utils/setup");
// Validation Schemas
const createRoomSchema = zod_1.z.object({
    name: zod_1.z.string().min(1, "Name is required"),
    code: zod_1.z.string().optional(),
    capacity: zod_1.z.number().int().min(1, "Capacity must be positive"),
    roomType: zod_1.z.enum([
        "CLASSROOM",
        "LABORATORY",
        "LIBRARY",
        "AUDITORIUM",
        "GYMNASIUM",
        "COMPUTER_LAB",
        "ART_ROOM",
        "MUSIC_ROOM",
        "CAFETERIA",
        "OFFICE",
        "STORAGE",
        "OTHER",
    ]),
    floor: zod_1.z.string().optional(),
    building: zod_1.z.string().optional(),
    facilities: zod_1.z.array(zod_1.z.string()).optional(),
    schoolId: zod_1.z.string().uuid("Invalid school ID"),
});
const updateRoomSchema = zod_1.z.object({
    name: zod_1.z.string().min(1).optional(),
    code: zod_1.z.string().optional(),
    capacity: zod_1.z.number().int().min(1).optional(),
    roomType: zod_1.z
        .enum([
        "CLASSROOM",
        "LABORATORY",
        "LIBRARY",
        "AUDITORIUM",
        "GYMNASIUM",
        "COMPUTER_LAB",
        "ART_ROOM",
        "MUSIC_ROOM",
        "CAFETERIA",
        "OFFICE",
        "STORAGE",
        "OTHER",
    ])
        .optional(),
    floor: zod_1.z.string().optional(),
    building: zod_1.z.string().optional(),
    facilities: zod_1.z.array(zod_1.z.string()).optional(),
    isActive: zod_1.z.boolean().optional(),
});
const getRooms = async (req, res) => {
    try {
        const page = Number.parseInt(req.query.page) || 1;
        const limit = Number.parseInt(req.query.limit) || 10;
        const skip = (page - 1) * limit;
        const filter = (0, setup_1.getTenantFilter)(req.user);
        const [rooms, total] = await Promise.all([
            setup_1.prisma.room.findMany({
                where: filter,
                skip,
                take: limit,
                include: {
                    _count: {
                        select: {
                            timetableSlots: true,
                            examSessions: true,
                            events: true,
                        },
                    },
                },
                orderBy: { name: "asc" },
            }),
            setup_1.prisma.room.count({ where: filter }),
        ]);
        setup_1.logger.info("Rooms retrieved", { userId: req.user?.id, page, limit, total });
        res.status(200).json({
            message: "Rooms retrieved successfully",
            rooms,
            pagination: { page, limit, total, pages: Math.ceil(total / limit) },
        });
    }
    catch (error) {
        (0, setup_1.handleError)(res, error, "Failed to retrieve rooms");
    }
};
exports.getRooms = getRooms;
const getRoomById = async (req, res) => {
    const { id } = req.params;
    try {
        const filter = (0, setup_1.getTenantFilter)(req.user);
        const room = await setup_1.prisma.room.findFirst({
            where: { id, ...filter },
            include: {
                timetableSlots: {
                    include: {
                        lesson: {
                            include: {
                                subject: { select: { name: true } },
                                class: { select: { name: true } },
                            },
                        },
                        teacher: {
                            include: {
                                user: { select: { name: true, surname: true } },
                            },
                        },
                        timetable: { select: { name: true, isActive: true } },
                    },
                    where: {
                        timetable: { isActive: true },
                        isActive: true,
                    },
                    orderBy: [{ day: "asc" }, { period: "asc" }],
                },
                examSessions: {
                    include: {
                        exam: { select: { title: true } },
                        invigilator: {
                            include: {
                                user: { select: { name: true, surname: true } },
                            },
                        },
                        _count: { select: { students: true } },
                    },
                    where: {
                        status: { not: "CANCELLED" },
                    },
                    orderBy: { sessionDate: "asc" },
                    take: 10, // Next 10 exam sessions
                },
                events: {
                    select: {
                        id: true,
                        title: true,
                        startTime: true,
                        endTime: true,
                        eventType: true,
                    },
                    where: {
                        startTime: { gte: new Date() },
                    },
                    orderBy: { startTime: "asc" },
                    take: 5, // Next 5 events
                },
                _count: {
                    select: {
                        timetableSlots: true,
                        examSessions: true,
                        events: true,
                    },
                },
            },
        });
        if (!room) {
            setup_1.logger.warn("Room not found", { userId: req.user?.id, roomId: id });
            return res.status(404).json({ message: "Room not found" });
        }
        setup_1.logger.info("Room retrieved", { userId: req.user?.id, roomId: id });
        res.status(200).json({
            message: "Room retrieved successfully",
            room,
        });
    }
    catch (error) {
        (0, setup_1.handleError)(res, error, "Failed to retrieve room");
    }
};
exports.getRoomById = getRoomById;
const createRoom = async (req, res) => {
    try {
        const data = createRoomSchema.parse(req.body);
        // Only principals and school admins can create rooms
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
        // Check if room code already exists in school
        if (data.code) {
            const existingRoom = await setup_1.prisma.room.findFirst({
                where: {
                    code: data.code,
                    schoolId: data.schoolId,
                },
            });
            if (existingRoom) {
                return res.status(409).json({ message: "Room with this code already exists in the school" });
            }
        }
        const room = await setup_1.prisma.room.create({
            data: {
                name: data.name,
                code: data.code,
                capacity: data.capacity,
                roomType: data.roomType,
                floor: data.floor,
                building: data.building,
                facilities: data.facilities || [],
                schoolId: data.schoolId,
            },
        });
        setup_1.logger.info("Room created", {
            userId: req.user?.id,
            roomId: room.id,
            schoolId: data.schoolId,
        });
        res.status(201).json({
            message: "Room created successfully",
            room,
        });
    }
    catch (error) {
        if (error instanceof zod_1.z.ZodError) {
            return res.status(400).json({ message: "Invalid input", errors: error.errors });
        }
        (0, setup_1.handleError)(res, error, "Failed to create room");
    }
};
exports.createRoom = createRoom;
const updateRoom = async (req, res) => {
    const { id } = req.params;
    try {
        const data = updateRoomSchema.parse(req.body);
        // Only principals and school admins can update rooms
        if (!["PRINCIPAL", "SCHOOL_ADMIN", "SUPER_ADMIN"].includes(req.user?.role || "")) {
            return res.status(403).json({ message: "Access denied" });
        }
        const filter = (0, setup_1.getTenantFilter)(req.user);
        const existingRoom = await setup_1.prisma.room.findFirst({
            where: { id, ...filter },
        });
        if (!existingRoom) {
            return res.status(404).json({ message: "Room not found or access denied" });
        }
        // Check for code conflicts if code is being updated
        if (data.code && data.code !== existingRoom.code) {
            const conflictingRoom = await setup_1.prisma.room.findFirst({
                where: {
                    code: data.code,
                    schoolId: existingRoom.schoolId,
                    id: { not: id },
                },
            });
            if (conflictingRoom) {
                return res.status(409).json({ message: "Room with this code already exists in the school" });
            }
        }
        const room = await setup_1.prisma.room.update({
            where: { id },
            data: {
                ...(data.name && { name: data.name }),
                ...(data.code !== undefined && { code: data.code }),
                ...(data.capacity && { capacity: data.capacity }),
                ...(data.roomType && { roomType: data.roomType }),
                ...(data.floor !== undefined && { floor: data.floor }),
                ...(data.building !== undefined && { building: data.building }),
                ...(data.facilities !== undefined && { facilities: data.facilities }),
                ...(data.isActive !== undefined && { isActive: data.isActive }),
            },
        });
        setup_1.logger.info("Room updated", { userId: req.user?.id, roomId: id });
        res.status(200).json({
            message: "Room updated successfully",
            room,
        });
    }
    catch (error) {
        if (error instanceof zod_1.z.ZodError) {
            return res.status(400).json({ message: "Invalid input", errors: error.errors });
        }
        (0, setup_1.handleError)(res, error, "Failed to update room");
    }
};
exports.updateRoom = updateRoom;
const deleteRoom = async (req, res) => {
    const { id } = req.params;
    try {
        // Only principals and school admins can delete rooms
        if (!["PRINCIPAL", "SCHOOL_ADMIN", "SUPER_ADMIN"].includes(req.user?.role || "")) {
            return res.status(403).json({ message: "Access denied" });
        }
        const filter = (0, setup_1.getTenantFilter)(req.user);
        const room = await setup_1.prisma.room.findFirst({
            where: { id, ...filter },
            include: {
                _count: {
                    select: {
                        timetableSlots: true,
                        examSessions: true,
                        events: true,
                    },
                },
            },
        });
        if (!room) {
            return res.status(404).json({ message: "Room not found or access denied" });
        }
        // Check if room is being used
        const hasUsage = room._count.timetableSlots > 0 || room._count.examSessions > 0 || room._count.events > 0;
        if (hasUsage) {
            return res.status(400).json({
                message: "Cannot delete room that is being used in timetables, exam sessions, or events",
            });
        }
        await setup_1.prisma.room.delete({ where: { id } });
        setup_1.logger.info("Room deleted", { userId: req.user?.id, roomId: id });
        res.status(200).json({ message: "Room deleted successfully" });
    }
    catch (error) {
        (0, setup_1.handleError)(res, error, "Failed to delete room");
    }
};
exports.deleteRoom = deleteRoom;
const getRoomAvailability = async (req, res) => {
    const { id } = req.params;
    const { date, startTime, endTime } = req.query;
    try {
        if (!date || !startTime || !endTime) {
            return res.status(400).json({ message: "Date, start time, and end time are required" });
        }
        const filter = (0, setup_1.getTenantFilter)(req.user);
        const room = await setup_1.prisma.room.findFirst({
            where: { id, ...filter },
        });
        if (!room) {
            return res.status(404).json({ message: "Room not found or access denied" });
        }
        const checkDate = new Date(date);
        const dayOfWeek = checkDate.toLocaleDateString("en-US", { weekday: "long" }).toUpperCase();
        // Check timetable conflicts
        const timetableConflicts = await setup_1.prisma.timetableSlot.findMany({
            where: {
                roomId: id,
                day: dayOfWeek,
                isActive: true,
                timetable: { isActive: true },
                OR: [
                    {
                        startTime: { lte: startTime },
                        endTime: { gt: startTime },
                    },
                    {
                        startTime: { lt: endTime },
                        endTime: { gte: endTime },
                    },
                    {
                        startTime: { gte: startTime },
                        endTime: { lte: endTime },
                    },
                ],
            },
            include: {
                lesson: {
                    include: {
                        subject: { select: { name: true } },
                        class: { select: { name: true } },
                    },
                },
                teacher: {
                    include: {
                        user: { select: { name: true, surname: true } },
                    },
                },
            },
        });
        // Check exam session conflicts
        const examConflicts = await setup_1.prisma.examSession.findMany({
            where: {
                roomId: id,
                sessionDate: {
                    gte: new Date(checkDate.toDateString()),
                    lt: new Date(new Date(checkDate.getTime() + 24 * 60 * 60 * 1000).toDateString()),
                },
                status: { not: "CANCELLED" },
                OR: [
                    {
                        startTime: { lte: startTime },
                        endTime: { gt: startTime },
                    },
                    {
                        startTime: { lt: endTime },
                        endTime: { gte: endTime },
                    },
                    {
                        startTime: { gte: startTime },
                        endTime: { lte: endTime },
                    },
                ],
            },
            include: {
                exam: { select: { title: true } },
                invigilator: {
                    include: {
                        user: { select: { name: true, surname: true } },
                    },
                },
            },
        });
        // Check event conflicts
        const eventConflicts = await setup_1.prisma.event.findMany({
            where: {
                roomId: id,
                startTime: {
                    gte: checkDate,
                    lt: new Date(checkDate.getTime() + 24 * 60 * 60 * 1000),
                },
                OR: [
                    {
                        startTime: { lte: new Date(`${checkDate.toDateString()} ${startTime}`) },
                        endTime: { gt: new Date(`${checkDate.toDateString()} ${startTime}`) },
                    },
                    {
                        startTime: { lt: new Date(`${checkDate.toDateString()} ${endTime}`) },
                        endTime: { gte: new Date(`${checkDate.toDateString()} ${endTime}`) },
                    },
                ],
            },
            select: {
                id: true,
                title: true,
                startTime: true,
                endTime: true,
                eventType: true,
            },
        });
        const isAvailable = timetableConflicts.length === 0 && examConflicts.length === 0 && eventConflicts.length === 0;
        setup_1.logger.info("Room availability checked", { userId: req.user?.id, roomId: id, date, isAvailable });
        res.status(200).json({
            message: "Room availability checked successfully",
            room: {
                id: room.id,
                name: room.name,
                capacity: room.capacity,
            },
            date: checkDate,
            timeSlot: { startTime, endTime },
            isAvailable,
            conflicts: {
                timetable: timetableConflicts,
                examSessions: examConflicts,
                events: eventConflicts,
            },
        });
    }
    catch (error) {
        (0, setup_1.handleError)(res, error, "Failed to check room availability");
    }
};
exports.getRoomAvailability = getRoomAvailability;
const getRoomUtilization = async (req, res) => {
    const { id } = req.params;
    const { startDate, endDate } = req.query;
    try {
        if (!startDate || !endDate) {
            return res.status(400).json({ message: "Start date and end date are required" });
        }
        const filter = (0, setup_1.getTenantFilter)(req.user);
        const room = await setup_1.prisma.room.findFirst({
            where: { id, ...filter },
        });
        if (!room) {
            return res.status(404).json({ message: "Room not found or access denied" });
        }
        const start = new Date(startDate);
        const end = new Date(endDate);
        // Get timetable usage
        const timetableUsage = await setup_1.prisma.timetableSlot.count({
            where: {
                roomId: id,
                isActive: true,
                timetable: {
                    isActive: true,
                    effectiveFrom: { lte: end },
                    OR: [{ effectiveTo: null }, { effectiveTo: { gte: start } }],
                },
            },
        });
        // Get exam session usage
        const examUsage = await setup_1.prisma.examSession.count({
            where: {
                roomId: id,
                sessionDate: {
                    gte: start,
                    lte: end,
                },
                status: { not: "CANCELLED" },
            },
        });
        // Get event usage
        const eventUsage = await setup_1.prisma.event.count({
            where: {
                roomId: id,
                startTime: {
                    gte: start,
                    lte: end,
                },
            },
        });
        const totalUsage = timetableUsage + examUsage + eventUsage;
        setup_1.logger.info("Room utilization retrieved", { userId: req.user?.id, roomId: id });
        res.status(200).json({
            message: "Room utilization retrieved successfully",
            room: {
                id: room.id,
                name: room.name,
                capacity: room.capacity,
            },
            period: { startDate: start, endDate: end },
            utilization: {
                timetableSlots: timetableUsage,
                examSessions: examUsage,
                events: eventUsage,
                total: totalUsage,
            },
        });
    }
    catch (error) {
        (0, setup_1.handleError)(res, error, "Failed to retrieve room utilization");
    }
};
exports.getRoomUtilization = getRoomUtilization;
