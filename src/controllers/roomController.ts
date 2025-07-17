import type { Response } from "express"
import { z } from "zod"
import { prisma, type AuthRequest, handleError, logger, getTenantFilter } from "../utils/setup"

// Validation Schemas
const createRoomSchema = z.object({
  name: z.string().min(1, "Name is required"),
  code: z.string().optional(),
  capacity: z.number().int().min(1, "Capacity must be positive"),
  roomType: z.enum([
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
  floor: z.string().optional(),
  building: z.string().optional(),
  facilities: z.array(z.string()).optional(),
  schoolId: z.string().uuid("Invalid school ID"),
})

const updateRoomSchema = z.object({
  name: z.string().min(1).optional(),
  code: z.string().optional(),
  capacity: z.number().int().min(1).optional(),
  roomType: z
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
  floor: z.string().optional(),
  building: z.string().optional(),
  facilities: z.array(z.string()).optional(),
  isActive: z.boolean().optional(),
})

export const getRooms = async (req: AuthRequest, res: Response) => {
  try {
    const page = Number.parseInt(req.query.page as string) || 1
    const limit = Number.parseInt(req.query.limit as string) || 10
    const skip = (page - 1) * limit
    const filter = getTenantFilter(req.user)

    const [rooms, total] = await Promise.all([
      prisma.room.findMany({
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
      prisma.room.count({ where: filter }),
    ])

    logger.info("Rooms retrieved", { userId: req.user?.id, page, limit, total })
    res.status(200).json({
      message: "Rooms retrieved successfully",
      rooms,
      pagination: { page, limit, total, pages: Math.ceil(total / limit) },
    })
  } catch (error) {
    handleError(res, error, "Failed to retrieve rooms")
  }
}

export const getRoomById = async (req: AuthRequest, res: Response) => {
  const { id } = req.params
  try {
    const filter = getTenantFilter(req.user)

    const room = await prisma.room.findFirst({
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
    })

    if (!room) {
      logger.warn("Room not found", { userId: req.user?.id, roomId: id })
      return res.status(404).json({ message: "Room not found" })
    }

    logger.info("Room retrieved", { userId: req.user?.id, roomId: id })
    res.status(200).json({
      message: "Room retrieved successfully",
      room,
    })
  } catch (error) {
    handleError(res, error, "Failed to retrieve room")
  }
}

export const createRoom = async (req: AuthRequest, res: Response) => {
  try {
    const data = createRoomSchema.parse(req.body)

    // Only principals and school admins can create rooms
    if (!["PRINCIPAL", "SCHOOL_ADMIN", "SUPER_ADMIN"].includes(req.user?.role || "")) {
      return res.status(403).json({ message: "Access denied" })
    }

    // Verify school exists and user has access
    const school = await prisma.school.findFirst({
      where: {
        id: data.schoolId,
        ...getTenantFilter(req.user),
      },
    })

    if (!school) {
      return res.status(404).json({ message: "School not found or access denied" })
    }

    // Check if room code already exists in school
    if (data.code) {
      const existingRoom = await prisma.room.findFirst({
        where: {
          code: data.code,
          schoolId: data.schoolId,
        },
      })

      if (existingRoom) {
        return res.status(409).json({ message: "Room with this code already exists in the school" })
      }
    }

    const room = await prisma.room.create({
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
    })

    logger.info("Room created", {
      userId: req.user?.id,
      roomId: room.id,
      schoolId: data.schoolId,
    })

    res.status(201).json({
      message: "Room created successfully",
      room,
    })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ message: "Invalid input", errors: error.errors })
    }
    handleError(res, error, "Failed to create room")
  }
}

export const updateRoom = async (req: AuthRequest, res: Response) => {
  const { id } = req.params
  try {
    const data = updateRoomSchema.parse(req.body)

    // Only principals and school admins can update rooms
    if (!["PRINCIPAL", "SCHOOL_ADMIN", "SUPER_ADMIN"].includes(req.user?.role || "")) {
      return res.status(403).json({ message: "Access denied" })
    }

    const filter = getTenantFilter(req.user)
    const existingRoom = await prisma.room.findFirst({
      where: { id, ...filter },
    })

    if (!existingRoom) {
      return res.status(404).json({ message: "Room not found or access denied" })
    }

    // Check for code conflicts if code is being updated
    if (data.code && data.code !== existingRoom.code) {
      const conflictingRoom = await prisma.room.findFirst({
        where: {
          code: data.code,
          schoolId: existingRoom.schoolId,
          id: { not: id },
        },
      })

      if (conflictingRoom) {
        return res.status(409).json({ message: "Room with this code already exists in the school" })
      }
    }

    const room = await prisma.room.update({
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
    })

    logger.info("Room updated", { userId: req.user?.id, roomId: id })
    res.status(200).json({
      message: "Room updated successfully",
      room,
    })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ message: "Invalid input", errors: error.errors })
    }
    handleError(res, error, "Failed to update room")
  }
}

export const deleteRoom = async (req: AuthRequest, res: Response) => {
  const { id } = req.params
  try {
    // Only principals and school admins can delete rooms
    if (!["PRINCIPAL", "SCHOOL_ADMIN", "SUPER_ADMIN"].includes(req.user?.role || "")) {
      return res.status(403).json({ message: "Access denied" })
    }

    const filter = getTenantFilter(req.user)
    const room = await prisma.room.findFirst({
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
    })

    if (!room) {
      return res.status(404).json({ message: "Room not found or access denied" })
    }

    // Check if room is being used
    const hasUsage = room._count.timetableSlots > 0 || room._count.examSessions > 0 || room._count.events > 0

    if (hasUsage) {
      return res.status(400).json({
        message: "Cannot delete room that is being used in timetables, exam sessions, or events",
      })
    }

    await prisma.room.delete({ where: { id } })

    logger.info("Room deleted", { userId: req.user?.id, roomId: id })
    res.status(200).json({ message: "Room deleted successfully" })
  } catch (error) {
    handleError(res, error, "Failed to delete room")
  }
}

export const getRoomAvailability = async (req: AuthRequest, res: Response) => {
  const { id } = req.params
  const { date, startTime, endTime } = req.query

  try {
    if (!date || !startTime || !endTime) {
      return res.status(400).json({ message: "Date, start time, and end time are required" })
    }

    const filter = getTenantFilter(req.user)
    const room = await prisma.room.findFirst({
      where: { id, ...filter },
    })

    if (!room) {
      return res.status(404).json({ message: "Room not found or access denied" })
    }

    const checkDate = new Date(date as string)
    const dayOfWeek = checkDate.toLocaleDateString("en-US", { weekday: "long" }).toUpperCase()

    // Check timetable conflicts
    const timetableConflicts = await prisma.timetableSlot.findMany({
      where: {
        roomId: id,
        day: dayOfWeek as any,
        isActive: true,
        timetable: { isActive: true },
        OR: [
          {
            startTime: { lte: startTime as string },
            endTime: { gt: startTime as string },
          },
          {
            startTime: { lt: endTime as string },
            endTime: { gte: endTime as string },
          },
          {
            startTime: { gte: startTime as string },
            endTime: { lte: endTime as string },
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
    })

    // Check exam session conflicts
    const examConflicts = await prisma.examSession.findMany({
      where: {
        roomId: id,
        sessionDate: {
          gte: new Date(checkDate.toDateString()),
          lt: new Date(new Date(checkDate.getTime() + 24 * 60 * 60 * 1000).toDateString()),
        },
        status: { not: "CANCELLED" },
        OR: [
          {
            startTime: { lte: startTime as string },
            endTime: { gt: startTime as string },
          },
          {
            startTime: { lt: endTime as string },
            endTime: { gte: endTime as string },
          },
          {
            startTime: { gte: startTime as string },
            endTime: { lte: endTime as string },
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
    })

    // Check event conflicts
    const eventConflicts = await prisma.event.findMany({
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
    })

    const isAvailable = timetableConflicts.length === 0 && examConflicts.length === 0 && eventConflicts.length === 0

    logger.info("Room availability checked", { userId: req.user?.id, roomId: id, date, isAvailable })
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
    })
  } catch (error) {
    handleError(res, error, "Failed to check room availability")
  }
}

export const getRoomUtilization = async (req: AuthRequest, res: Response) => {
  const { id } = req.params
  const { startDate, endDate } = req.query

  try {
    if (!startDate || !endDate) {
      return res.status(400).json({ message: "Start date and end date are required" })
    }

    const filter = getTenantFilter(req.user)
    const room = await prisma.room.findFirst({
      where: { id, ...filter },
    })

    if (!room) {
      return res.status(404).json({ message: "Room not found or access denied" })
    }

    const start = new Date(startDate as string)
    const end = new Date(endDate as string)

    // Get timetable usage
    const timetableUsage = await prisma.timetableSlot.count({
      where: {
        roomId: id,
        isActive: true,
        timetable: {
          isActive: true,
          effectiveFrom: { lte: end },
          OR: [{ effectiveTo: null }, { effectiveTo: { gte: start } }],
        },
      },
    })

    // Get exam session usage
    const examUsage = await prisma.examSession.count({
      where: {
        roomId: id,
        sessionDate: {
          gte: start,
          lte: end,
        },
        status: { not: "CANCELLED" },
      },
    })

    // Get event usage
    const eventUsage = await prisma.event.count({
      where: {
        roomId: id,
        startTime: {
          gte: start,
          lte: end,
        },
      },
    })

    const totalUsage = timetableUsage + examUsage + eventUsage

    logger.info("Room utilization retrieved", { userId: req.user?.id, roomId: id })
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
    })
  } catch (error) {
    handleError(res, error, "Failed to retrieve room utilization")
  }
}
