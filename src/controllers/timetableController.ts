import type { Response } from "express"
import { z } from "zod"
import { prisma, type AuthRequest, handleError, logger, getTenantFilter } from "../utils/setup"

// Validation Schemas
const createTimetableSchema = z.object({
  name: z.string().min(1, "Name is required"),
  academicYearId: z.string().uuid("Invalid academic year ID"),
  termId: z.string().uuid("Invalid term ID").optional(),
  effectiveFrom: z.string().datetime("Invalid effective from date"),
  effectiveTo: z.string().datetime("Invalid effective to date").optional(),
  schoolId: z.string().uuid("Invalid school ID"),
})

const updateTimetableSchema = z.object({
  name: z.string().min(1).optional(),
  termId: z.string().uuid().optional(),
  effectiveFrom: z.string().datetime().optional(),
  effectiveTo: z.string().datetime().optional(),
  isActive: z.boolean().optional(),
})

const createTimetableSlotSchema = z.object({
  timetableId: z.string().uuid("Invalid timetable ID"),
  day: z.enum(["MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY", "FRIDAY", "SATURDAY", "SUNDAY"]),
  startTime: z.string().regex(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/, "Invalid time format (HH:MM)"),
  endTime: z.string().regex(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/, "Invalid time format (HH:MM)"),
  period: z.number().int().min(1, "Period must be a positive integer"),
  lessonId: z.string().uuid("Invalid lesson ID"),
  roomId: z.string().uuid("Invalid room ID").optional(),
  teacherId: z.string().uuid("Invalid teacher ID"),
})

const updateTimetableSlotSchema = z.object({
  day: z.enum(["MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY", "FRIDAY", "SATURDAY", "SUNDAY"]).optional(),
  startTime: z
    .string()
    .regex(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/)
    .optional(),
  endTime: z
    .string()
    .regex(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/)
    .optional(),
  period: z.number().int().min(1).optional(),
  lessonId: z.string().uuid().optional(),
  roomId: z.string().uuid().optional(),
  teacherId: z.string().uuid().optional(),
  isActive: z.boolean().optional(),
  notes: z.string().optional(),
})

export const getTimetables = async (req: AuthRequest, res: Response) => {
  try {
    const page = Number.parseInt(req.query.page as string) || 1
    const limit = Number.parseInt(req.query.limit as string) || 10
    const skip = (page - 1) * limit
    const filter = getTenantFilter(req.user)

    const [timetables, total] = await Promise.all([
      prisma.timetable.findMany({
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
      prisma.timetable.count({ where: filter }),
    ])

    logger.info("Timetables retrieved", { userId: req.user?.id, page, limit, total })
    res.status(200).json({
      message: "Timetables retrieved successfully",
      timetables,
      pagination: { page, limit, total, pages: Math.ceil(total / limit) },
    })
  } catch (error) {
    handleError(res, error, "Failed to retrieve timetables")
  }
}

export const getTimetableById = async (req: AuthRequest, res: Response) => {
  const { id } = req.params
  try {
    const filter = getTenantFilter(req.user)

    const timetable = await prisma.timetable.findFirst({
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
    })

    if (!timetable) {
      logger.warn("Timetable not found", { userId: req.user?.id, timetableId: id })
      return res.status(404).json({ message: "Timetable not found" })
    }

    logger.info("Timetable retrieved", { userId: req.user?.id, timetableId: id })
    res.status(200).json({
      message: "Timetable retrieved successfully",
      timetable,
    })
  } catch (error) {
    handleError(res, error, "Failed to retrieve timetable")
  }
}

export const createTimetable = async (req: AuthRequest, res: Response) => {
  try {
    const data = createTimetableSchema.parse(req.body)

    // Only principals and school admins can create timetables
    if (!["PRINCIPAL", "SCHOOL_ADMIN", "SUPER_ADMIN"].includes(req.user?.role || "")) {
      return res.status(403).json({ message: "Access denied" })
    }

    // Verify school, academic year, and term
    const [school, academicYear, term] = await Promise.all([
      prisma.school.findFirst({
        where: {
          id: data.schoolId,
          ...getTenantFilter(req.user),
        },
      }),
      prisma.academicYear.findFirst({
        where: {
          id: data.academicYearId,
          schoolId: data.schoolId,
        },
      }),
      data.termId
        ? prisma.term.findFirst({
            where: {
              id: data.termId,
              schoolId: data.schoolId,
            },
          })
        : null,
    ])

    if (!school) {
      return res.status(404).json({ message: "School not found or access denied" })
    }
    if (!academicYear) {
      return res.status(404).json({ message: "Academic year not found" })
    }
    if (data.termId && !term) {
      return res.status(404).json({ message: "Term not found" })
    }

    // Check for overlapping timetables
    const overlappingTimetable = await prisma.timetable.findFirst({
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
    })

    if (overlappingTimetable) {
      return res.status(409).json({ message: "A timetable already exists for this period" })
    }

    const timetable = await prisma.timetable.create({
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
    })

    logger.info("Timetable created", {
      userId: req.user?.id,
      timetableId: timetable.id,
      schoolId: data.schoolId,
    })

    res.status(201).json({
      message: "Timetable created successfully",
      timetable,
    })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ message: "Invalid input", errors: error.errors })
    }
    handleError(res, error, "Failed to create timetable")
  }
}

export const updateTimetable = async (req: AuthRequest, res: Response) => {
  const { id } = req.params
  try {
    const data = updateTimetableSchema.parse(req.body)

    // Only principals and school admins can update timetables
    if (!["PRINCIPAL", "SCHOOL_ADMIN", "SUPER_ADMIN"].includes(req.user?.role || "")) {
      return res.status(403).json({ message: "Access denied" })
    }

    const filter = getTenantFilter(req.user)
    const existingTimetable = await prisma.timetable.findFirst({
      where: { id, ...filter },
    })

    if (!existingTimetable) {
      return res.status(404).json({ message: "Timetable not found or access denied" })
    }

    // Verify term if provided
    if (data.termId) {
      const term = await prisma.term.findFirst({
        where: {
          id: data.termId,
          schoolId: existingTimetable.schoolId,
        },
      })
      if (!term) {
        return res.status(404).json({ message: "Term not found" })
      }
    }

    const timetable = await prisma.timetable.update({
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
    })

    logger.info("Timetable updated", { userId: req.user?.id, timetableId: id })
    res.status(200).json({
      message: "Timetable updated successfully",
      timetable,
    })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ message: "Invalid input", errors: error.errors })
    }
    handleError(res, error, "Failed to update timetable")
  }
}

export const deleteTimetable = async (req: AuthRequest, res: Response) => {
  const { id } = req.params
  try {
    // Only principals and school admins can delete timetables
    if (!["PRINCIPAL", "SCHOOL_ADMIN", "SUPER_ADMIN"].includes(req.user?.role || "")) {
      return res.status(403).json({ message: "Access denied" })
    }

    const filter = getTenantFilter(req.user)
    const timetable = await prisma.timetable.findFirst({
      where: { id, ...filter },
      include: {
        _count: { select: { slots: true } },
      },
    })

    if (!timetable) {
      return res.status(404).json({ message: "Timetable not found or access denied" })
    }

    // Check if timetable has slots
    if (timetable._count.slots > 0) {
      return res.status(400).json({
        message: "Cannot delete timetable with existing slots. Please remove all slots first.",
      })
    }

    await prisma.timetable.delete({ where: { id } })

    logger.info("Timetable deleted", { userId: req.user?.id, timetableId: id })
    res.status(200).json({ message: "Timetable deleted successfully" })
  } catch (error) {
    handleError(res, error, "Failed to delete timetable")
  }
}

// Timetable Slot Management
export const createTimetableSlot = async (req: AuthRequest, res: Response) => {
  try {
    const data = createTimetableSlotSchema.parse(req.body)

    // Only principals, school admins, and teachers can create slots
    if (!["PRINCIPAL", "SCHOOL_ADMIN", "TEACHER", "SUPER_ADMIN"].includes(req.user?.role || "")) {
      return res.status(403).json({ message: "Access denied" })
    }

    // Verify timetable, lesson, room, and teacher
    const [timetable, lesson, room, teacher] = await Promise.all([
      prisma.timetable.findFirst({
        where: {
          id: data.timetableId,
          ...getTenantFilter(req.user),
        },
      }),
      prisma.lesson.findUnique({
        where: { id: data.lessonId },
        include: { subject: true, class: true },
      }),
      data.roomId
        ? prisma.room.findFirst({
            where: {
              id: data.roomId,
              ...getTenantFilter(req.user),
            },
          })
        : null,
      prisma.teacher.findFirst({
        where: {
          id: data.teacherId,
          ...getTenantFilter(req.user),
        },
      }),
    ])

    if (!timetable) {
      return res.status(404).json({ message: "Timetable not found or access denied" })
    }
    if (!lesson) {
      return res.status(404).json({ message: "Lesson not found" })
    }
    if (data.roomId && !room) {
      return res.status(404).json({ message: "Room not found or access denied" })
    }
    if (!teacher) {
      return res.status(404).json({ message: "Teacher not found or access denied" })
    }

    // Check for conflicts
    const conflicts = await prisma.timetableSlot.findFirst({
      where: {
        timetableId: data.timetableId,
        day: data.day,
        period: data.period,
        isActive: true,
      },
    })

    if (conflicts) {
      return res.status(409).json({ message: "Time slot already occupied" })
    }

    // Check teacher availability
    const teacherConflict = await prisma.timetableSlot.findFirst({
      where: {
        teacherId: data.teacherId,
        day: data.day,
        startTime: data.startTime,
        endTime: data.endTime,
        isActive: true,
        timetable: { isActive: true },
      },
    })

    if (teacherConflict) {
      return res.status(409).json({ message: "Teacher is not available at this time" })
    }

    // Check room availability
    if (data.roomId) {
      const roomConflict = await prisma.timetableSlot.findFirst({
        where: {
          roomId: data.roomId,
          day: data.day,
          startTime: data.startTime,
          endTime: data.endTime,
          isActive: true,
          timetable: { isActive: true },
        },
      })

      if (roomConflict) {
        return res.status(409).json({ message: "Room is not available at this time" })
      }
    }

    const slot = await prisma.timetableSlot.create({
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
    })

    logger.info("Timetable slot created", {
      userId: req.user?.id,
      slotId: slot.id,
      timetableId: data.timetableId,
    })

    res.status(201).json({
      message: "Timetable slot created successfully",
      slot,
    })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ message: "Invalid input", errors: error.errors })
    }
    handleError(res, error, "Failed to create timetable slot")
  }
}

export const updateTimetableSlot = async (req: AuthRequest, res: Response) => {
  const { id } = req.params
  try {
    const data = updateTimetableSlotSchema.parse(req.body)

    // Only principals, school admins, and teachers can update slots
    if (!["PRINCIPAL", "SCHOOL_ADMIN", "TEACHER", "SUPER_ADMIN"].includes(req.user?.role || "")) {
      return res.status(403).json({ message: "Access denied" })
    }

    const existingSlot = await prisma.timetableSlot.findFirst({
      where: {
        id,
        timetable: getTenantFilter(req.user),
      },
    })

    if (!existingSlot) {
      return res.status(404).json({ message: "Timetable slot not found or access denied" })
    }

    // Verify lesson, room, and teacher if provided
    if (data.lessonId) {
      const lesson = await prisma.lesson.findUnique({ where: { id: data.lessonId } })
      if (!lesson) {
        return res.status(404).json({ message: "Lesson not found" })
      }
    }

    if (data.roomId) {
      const room = await prisma.room.findFirst({
        where: {
          id: data.roomId,
          ...getTenantFilter(req.user),
        },
      })
      if (!room) {
        return res.status(404).json({ message: "Room not found or access denied" })
      }
    }

    if (data.teacherId) {
      const teacher = await prisma.teacher.findFirst({
        where: {
          id: data.teacherId,
          ...getTenantFilter(req.user),
        },
      })
      if (!teacher) {
        return res.status(404).json({ message: "Teacher not found or access denied" })
      }
    }

    const slot = await prisma.timetableSlot.update({
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
    })

    logger.info("Timetable slot updated", { userId: req.user?.id, slotId: id })
    res.status(200).json({
      message: "Timetable slot updated successfully",
      slot,
    })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ message: "Invalid input", errors: error.errors })
    }
    handleError(res, error, "Failed to update timetable slot")
  }
}

export const deleteTimetableSlot = async (req: AuthRequest, res: Response) => {
  const { id } = req.params
  try {
    // Only principals, school admins, and teachers can delete slots
    if (!["PRINCIPAL", "SCHOOL_ADMIN", "TEACHER", "SUPER_ADMIN"].includes(req.user?.role || "")) {
      return res.status(403).json({ message: "Access denied" })
    }

    const slot = await prisma.timetableSlot.findFirst({
      where: {
        id,
        timetable: getTenantFilter(req.user),
      },
    })

    if (!slot) {
      return res.status(404).json({ message: "Timetable slot not found or access denied" })
    }

    await prisma.timetableSlot.delete({ where: { id } })

    logger.info("Timetable slot deleted", { userId: req.user?.id, slotId: id })
    res.status(200).json({ message: "Timetable slot deleted successfully" })
  } catch (error) {
    handleError(res, error, "Failed to delete timetable slot")
  }
}

export const getTeacherTimetable = async (req: AuthRequest, res: Response) => {
  const { teacherId } = req.params
  try {
    const filter = getTenantFilter(req.user)

    // Verify teacher exists and user has access
    const teacher = await prisma.teacher.findFirst({
      where: {
        id: teacherId,
        ...filter,
      },
      include: {
        user: { select: { name: true, surname: true } },
      },
    })

    if (!teacher) {
      return res.status(404).json({ message: "Teacher not found or access denied" })
    }

    // Get active timetable slots for the teacher
    const slots = await prisma.timetableSlot.findMany({
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
    })

    logger.info("Teacher timetable retrieved", { userId: req.user?.id, teacherId })
    res.status(200).json({
      message: "Teacher timetable retrieved successfully",
      teacher: {
        id: teacher.id,
        name: `${teacher.user.name} ${teacher.user.surname}`,
      },
      slots,
    })
  } catch (error) {
    handleError(res, error, "Failed to retrieve teacher timetable")
  }
}

export const getClassTimetable = async (req: AuthRequest, res: Response) => {
  const { classId } = req.params
  try {
    const filter = getTenantFilter(req.user)

    // Verify class exists and user has access
    const classRecord = await prisma.class.findFirst({
      where: {
        id: classId,
        ...filter,
      },
      include: {
        grade: { select: { name: true } },
      },
    })

    if (!classRecord) {
      return res.status(404).json({ message: "Class not found or access denied" })
    }

    // Get active timetable slots for the class
    const slots = await prisma.timetableSlot.findMany({
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
    })

    logger.info("Class timetable retrieved", { userId: req.user?.id, classId })
    res.status(200).json({
      message: "Class timetable retrieved successfully",
      class: {
        id: classRecord.id,
        name: classRecord.name,
        grade: classRecord.grade?.name,
      },
      slots,
    })
  } catch (error) {
    handleError(res, error, "Failed to retrieve class timetable")
  }
}
