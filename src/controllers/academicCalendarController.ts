import type { Response } from "express"
import { z } from "zod"
import { prisma, type AuthRequest, handleError, logger, getTenantFilter } from "../utils/setup"

// Validation Schemas
const createTermSchema = z.object({
  name: z.string().min(1, "Name is required"),
  startDate: z.string().datetime("Invalid start date"),
  endDate: z.string().datetime("Invalid end date"),
  schoolId: z.string().uuid("Invalid school ID"),
  academicYearId: z.string().uuid("Invalid academic year ID"),
})

const updateTermSchema = z.object({
  name: z.string().min(1).optional(),
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional(),
  isActive: z.boolean().optional(),
})

const createHolidaySchema = z.object({
  name: z.string().min(1, "Name is required"),
  description: z.string().optional(),
  startDate: z.string().datetime("Invalid start date"),
  endDate: z.string().datetime("Invalid end date"),
  holidayType: z.enum(["PUBLIC", "SCHOOL_SPECIFIC", "RELIGIOUS", "NATIONAL", "REGIONAL"]),
  isRecurring: z.boolean().default(false),
  schoolId: z.string().uuid("Invalid school ID"),
})

const updateHolidaySchema = z.object({
  name: z.string().min(1).optional(),
  description: z.string().optional(),
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional(),
  holidayType: z.enum(["PUBLIC", "SCHOOL_SPECIFIC", "RELIGIOUS", "NATIONAL", "REGIONAL"]).optional(),
  isRecurring: z.boolean().optional(),
})

const createCalendarItemSchema = z.object({
  title: z.string().min(1, "Title is required"),
  description: z.string().optional(),
  startDate: z.string().datetime("Invalid start date"),
  endDate: z.string().datetime("Invalid end date"),
  itemType: z.enum([
    "HOLIDAY",
    "EXAM_PERIOD",
    "TERM_START",
    "TERM_END",
    "SPECIAL_EVENT",
    "SPORTS_DAY",
    "PARENT_TEACHER_MEETING",
    "OTHER",
  ]),
  isAllDay: z.boolean().default(false),
  academicCalendarId: z.string().uuid("Invalid academic calendar ID"),
})

// Term Management
export const getTerms = async (req: AuthRequest, res: Response) => {
  try {
    const page = Number.parseInt(req.query.page as string) || 1
    const limit = Number.parseInt(req.query.limit as string) || 10
    const skip = (page - 1) * limit
    const filter = getTenantFilter(req.user)

    const [terms, total] = await Promise.all([
      prisma.term.findMany({
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
      prisma.term.count({ where: filter }),
    ])

    logger.info("Terms retrieved", { userId: req.user?.id, page, limit, total })
    res.status(200).json({
      message: "Terms retrieved successfully",
      terms,
      pagination: { page, limit, total, pages: Math.ceil(total / limit) },
    })
  } catch (error) {
    handleError(res, error, "Failed to retrieve terms")
  }
}

export const getTermById = async (req: AuthRequest, res: Response) => {
  const { id } = req.params
  try {
    const filter = getTenantFilter(req.user)

    const term = await prisma.term.findFirst({
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
    })

    if (!term) {
      logger.warn("Term not found", { userId: req.user?.id, termId: id })
      return res.status(404).json({ message: "Term not found" })
    }

    logger.info("Term retrieved", { userId: req.user?.id, termId: id })
    res.status(200).json({
      message: "Term retrieved successfully",
      term,
    })
  } catch (error) {
    handleError(res, error, "Failed to retrieve term")
  }
}

export const createTerm = async (req: AuthRequest, res: Response) => {
  try {
    const data = createTermSchema.parse(req.body)

    // Only principals and school admins can create terms
    if (!["PRINCIPAL", "SCHOOL_ADMIN", "SUPER_ADMIN"].includes(req.user?.role || "")) {
      return res.status(403).json({ message: "Access denied" })
    }

    // Verify school and academic year
    const [school, academicYear] = await Promise.all([
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
    ])

    if (!school) {
      return res.status(404).json({ message: "School not found or access denied" })
    }
    if (!academicYear) {
      return res.status(404).json({ message: "Academic year not found" })
    }

    // Validate dates
    const startDate = new Date(data.startDate)
    const endDate = new Date(data.endDate)

    if (startDate >= endDate) {
      return res.status(400).json({ message: "End date must be after start date" })
    }

    if (startDate < academicYear.startDate || endDate > academicYear.endDate) {
      return res.status(400).json({ message: "Term dates must be within the academic year" })
    }

    // Check for overlapping terms
    const overlappingTerm = await prisma.term.findFirst({
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
    })

    if (overlappingTerm) {
      return res.status(409).json({ message: "Term dates overlap with existing term" })
    }

    const term = await prisma.term.create({
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
    })

    logger.info("Term created", {
      userId: req.user?.id,
      termId: term.id,
      schoolId: data.schoolId,
    })

    res.status(201).json({
      message: "Term created successfully",
      term,
    })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ message: "Invalid input", errors: error.errors })
    }
    handleError(res, error, "Failed to create term")
  }
}

export const updateTerm = async (req: AuthRequest, res: Response) => {
  const { id } = req.params
  try {
    const data = updateTermSchema.parse(req.body)

    // Only principals and school admins can update terms
    if (!["PRINCIPAL", "SCHOOL_ADMIN", "SUPER_ADMIN"].includes(req.user?.role || "")) {
      return res.status(403).json({ message: "Access denied" })
    }

    const filter = getTenantFilter(req.user)
    const existingTerm = await prisma.term.findFirst({
      where: { id, ...filter },
      include: {
        academicYear: { select: { startDate: true, endDate: true } },
      },
    })

    if (!existingTerm) {
      return res.status(404).json({ message: "Term not found or access denied" })
    }

    // Validate dates if provided
    if (data.startDate || data.endDate) {
      const startDate = data.startDate ? new Date(data.startDate) : existingTerm.startDate
      const endDate = data.endDate ? new Date(data.endDate) : existingTerm.endDate

      if (startDate >= endDate) {
        return res.status(400).json({ message: "End date must be after start date" })
      }

      if (startDate < existingTerm.academicYear.startDate || endDate > existingTerm.academicYear.endDate) {
        return res.status(400).json({ message: "Term dates must be within the academic year" })
      }
    }

    const term = await prisma.term.update({
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
    })

    logger.info("Term updated", { userId: req.user?.id, termId: id })
    res.status(200).json({
      message: "Term updated successfully",
      term,
    })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ message: "Invalid input", errors: error.errors })
    }
    handleError(res, error, "Failed to update term")
  }
}

export const deleteTerm = async (req: AuthRequest, res: Response) => {
  const { id } = req.params
  try {
    // Only principals and school admins can delete terms
    if (!["PRINCIPAL", "SCHOOL_ADMIN", "SUPER_ADMIN"].includes(req.user?.role || "")) {
      return res.status(403).json({ message: "Access denied" })
    }

    const filter = getTenantFilter(req.user)
    const term = await prisma.term.findFirst({
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
    })

    if (!term) {
      return res.status(404).json({ message: "Term not found or access denied" })
    }

    // Check if term is being used
    const hasUsage = term._count.timetables > 0 || term._count.exams > 0 || term._count.reportCards > 0

    if (hasUsage) {
      return res.status(400).json({
        message: "Cannot delete term that is being used in timetables, exams, or report cards",
      })
    }

    await prisma.term.delete({ where: { id } })

    logger.info("Term deleted", { userId: req.user?.id, termId: id })
    res.status(200).json({ message: "Term deleted successfully" })
  } catch (error) {
    handleError(res, error, "Failed to delete term")
  }
}

// Holiday Management
export const getHolidays = async (req: AuthRequest, res: Response) => {
  try {
    const page = Number.parseInt(req.query.page as string) || 1
    const limit = Number.parseInt(req.query.limit as string) || 10
    const skip = (page - 1) * limit
    const filter = getTenantFilter(req.user)

    const [holidays, total] = await Promise.all([
      prisma.holiday.findMany({
        where: filter,
        skip,
        take: limit,
        orderBy: { startDate: "asc" },
      }),
      prisma.holiday.count({ where: filter }),
    ])

    logger.info("Holidays retrieved", { userId: req.user?.id, page, limit, total })
    res.status(200).json({
      message: "Holidays retrieved successfully",
      holidays,
      pagination: { page, limit, total, pages: Math.ceil(total / limit) },
    })
  } catch (error) {
    handleError(res, error, "Failed to retrieve holidays")
  }
}

export const createHoliday = async (req: AuthRequest, res: Response) => {
  try {
    const data = createHolidaySchema.parse(req.body)

    // Only principals and school admins can create holidays
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

    // Validate dates
    const startDate = new Date(data.startDate)
    const endDate = new Date(data.endDate)

    if (startDate > endDate) {
      return res.status(400).json({ message: "End date must be on or after start date" })
    }

    const holiday = await prisma.holiday.create({
      data: {
        name: data.name,
        description: data.description,
        startDate,
        endDate,
        holidayType: data.holidayType,
        isRecurring: data.isRecurring,
        schoolId: data.schoolId,
      },
    })

    logger.info("Holiday created", {
      userId: req.user?.id,
      holidayId: holiday.id,
      schoolId: data.schoolId,
    })

    res.status(201).json({
      message: "Holiday created successfully",
      holiday,
    })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ message: "Invalid input", errors: error.errors })
    }
    handleError(res, error, "Failed to create holiday")
  }
}

export const updateHoliday = async (req: AuthRequest, res: Response) => {
  const { id } = req.params
  try {
    const data = updateHolidaySchema.parse(req.body)

    // Only principals and school admins can update holidays
    if (!["PRINCIPAL", "SCHOOL_ADMIN", "SUPER_ADMIN"].includes(req.user?.role || "")) {
      return res.status(403).json({ message: "Access denied" })
    }

    const filter = getTenantFilter(req.user)
    const existingHoliday = await prisma.holiday.findFirst({
      where: { id, ...filter },
    })

    if (!existingHoliday) {
      return res.status(404).json({ message: "Holiday not found or access denied" })
    }

    // Validate dates if provided
    if (data.startDate || data.endDate) {
      const startDate = data.startDate ? new Date(data.startDate) : existingHoliday.startDate
      const endDate = data.endDate ? new Date(data.endDate) : existingHoliday.endDate

      if (startDate > endDate) {
        return res.status(400).json({ message: "End date must be on or after start date" })
      }
    }

    const holiday = await prisma.holiday.update({
      where: { id },
      data: {
        ...(data.name && { name: data.name }),
        ...(data.description !== undefined && { description: data.description }),
        ...(data.startDate && { startDate: new Date(data.startDate) }),
        ...(data.endDate && { endDate: new Date(data.endDate) }),
        ...(data.holidayType && { holidayType: data.holidayType }),
        ...(data.isRecurring !== undefined && { isRecurring: data.isRecurring }),
      },
    })

    logger.info("Holiday updated", { userId: req.user?.id, holidayId: id })
    res.status(200).json({
      message: "Holiday updated successfully",
      holiday,
    })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ message: "Invalid input", errors: error.errors })
    }
    handleError(res, error, "Failed to update holiday")
  }
}

export const deleteHoliday = async (req: AuthRequest, res: Response) => {
  const { id } = req.params
  try {
    // Only principals and school admins can delete holidays
    if (!["PRINCIPAL", "SCHOOL_ADMIN", "SUPER_ADMIN"].includes(req.user?.role || "")) {
      return res.status(403).json({ message: "Access denied" })
    }

    const filter = getTenantFilter(req.user)
    const holiday = await prisma.holiday.findFirst({
      where: { id, ...filter },
    })

    if (!holiday) {
      return res.status(404).json({ message: "Holiday not found or access denied" })
    }

    await prisma.holiday.delete({ where: { id } })

    logger.info("Holiday deleted", { userId: req.user?.id, holidayId: id })
    res.status(200).json({ message: "Holiday deleted successfully" })
  } catch (error) {
    handleError(res, error, "Failed to delete holiday")
  }
}

// Calendar Item Management
export const createCalendarItem = async (req: AuthRequest, res: Response) => {
  try {
    const data = createCalendarItemSchema.parse(req.body)

    // Only principals and school admins can create calendar items
    if (!["PRINCIPAL", "SCHOOL_ADMIN", "SUPER_ADMIN"].includes(req.user?.role || "")) {
      return res.status(403).json({ message: "Access denied" })
    }

    // Verify academic calendar exists and user has access
    const academicCalendar = await prisma.academicCalendar.findFirst({
      where: {
        id: data.academicCalendarId,
        ...getTenantFilter(req.user),
      },
    })

    if (!academicCalendar) {
      return res.status(404).json({ message: "Academic calendar not found or access denied" })
    }

    // Validate dates
    const startDate = new Date(data.startDate)
    const endDate = new Date(data.endDate)

    if (startDate > endDate) {
      return res.status(400).json({ message: "End date must be on or after start date" })
    }

    const calendarItem = await prisma.calendarItem.create({
      data: {
        title: data.title,
        description: data.description,
        startDate,
        endDate,
        itemType: data.itemType,
        isAllDay: data.isAllDay,
        academicCalendarId: data.academicCalendarId,
      },
    })

    logger.info("Calendar item created", {
      userId: req.user?.id,
      calendarItemId: calendarItem.id,
      academicCalendarId: data.academicCalendarId,
    })

    res.status(201).json({
      message: "Calendar item created successfully",
      calendarItem,
    })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ message: "Invalid input", errors: error.errors })
    }
    handleError(res, error, "Failed to create calendar item")
  }
}

export const getCalendarItems = async (req: AuthRequest, res: Response) => {
  const { academicCalendarId } = req.params
  const { startDate, endDate } = req.query

  try {
    // Verify academic calendar exists and user has access
    const academicCalendar = await prisma.academicCalendar.findFirst({
      where: {
        id: academicCalendarId,
        ...getTenantFilter(req.user),
      },
    })

    if (!academicCalendar) {
      return res.status(404).json({ message: "Academic calendar not found or access denied" })
    }

    // Build query filters
    const where: any = { academicCalendarId }

    if (startDate && endDate) {
      where.OR = [
        {
          startDate: {
            gte: new Date(startDate as string),
            lte: new Date(endDate as string),
          },
        },
        {
          endDate: {
            gte: new Date(startDate as string),
            lte: new Date(endDate as string),
          },
        },
        {
          startDate: { lte: new Date(startDate as string) },
          endDate: { gte: new Date(endDate as string) },
        },
      ]
    }

    const calendarItems = await prisma.calendarItem.findMany({
      where,
      orderBy: { startDate: "asc" },
    })

    logger.info("Calendar items retrieved", { userId: req.user?.id, academicCalendarId })
    res.status(200).json({
      message: "Calendar items retrieved successfully",
      calendarItems,
    })
  } catch (error) {
    handleError(res, error, "Failed to retrieve calendar items")
  }
}

export const getAcademicCalendar = async (req: AuthRequest, res: Response) => {
  const { startDate, endDate } = req.query

  try {
    const filter = getTenantFilter(req.user)

    if (!startDate || !endDate) {
      return res.status(400).json({ message: "Start date and end date are required" })
    }

    const start = new Date(startDate as string)
    const end = new Date(endDate as string)

    // Get terms within the date range
    const terms = await prisma.term.findMany({
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
    })

    // Get holidays within the date range
    const holidays = await prisma.holiday.findMany({
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
    })

    // Get exams within the date range
    const exams = await prisma.exam.findMany({
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
    })

    // Get events within the date range
    const events = await prisma.event.findMany({
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
    })

    logger.info("Academic calendar retrieved", { userId: req.user?.id, startDate, endDate })
    res.status(200).json({
      message: "Academic calendar retrieved successfully",
      period: { startDate: start, endDate: end },
      calendar: {
        terms,
        holidays,
        exams,
        events,
      },
    })
  } catch (error) {
    handleError(res, error, "Failed to retrieve academic calendar")
  }
}
