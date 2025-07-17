import type { Response, Request } from "express"
import { z } from "zod"
import { prisma, type AuthRequest, handleError, logger, getTenantFilter, createNotification } from "../utils/setup"
import { supabase } from "../config/supabase"
import type { Express } from "express"

// Validation Schemas
const createEventSchema = z.object({
  title: z.string().min(1, "Title is required"),
  description: z.string().min(1, "Description is required"),
  location: z.string().optional(),
  startTime: z.string().datetime("Invalid start time"),
  endTime: z.string().datetime("Invalid end time"),
  eventType: z
    .enum(["ACADEMIC", "SPORTS", "CULTURAL", "MEETING", "EXAMINATION", "HOLIDAY", "GENERAL"])
    .default("GENERAL"),
  classId: z.string().uuid("Invalid class ID").optional(),
  rsvpRequired: z.boolean().default(false),
})

const updateEventSchema = createEventSchema.partial()

const rsvpSchema = z.object({
  response: z.enum(["ATTENDING", "NOT_ATTENDING", "MAYBE"]),
})

export const getEvents = async (req: AuthRequest, res: Response) => {
  try {
    const page = Number.parseInt(req.query.page as string) || 1
    const limit = Number.parseInt(req.query.limit as string) || 10
    const skip = (page - 1) * limit

    const eventType = req.query.eventType as string
    const classId = req.query.classId as string
    const upcoming = req.query.upcoming === "true"
    const startDate = req.query.startDate as string
    const endDate = req.query.endDate as string

    let where: any = {}

    // Apply tenant filtering based on user role
    if (req.user?.role === "SUPER_ADMIN") {
      // Super admin sees all events
      where = {}
    } else if (req.user?.role === "PRINCIPAL" || req.user?.role === "SCHOOL_ADMIN" || req.user?.role === "TEACHER") {
      // School staff see events in their school
      where = getTenantFilter(req.user)
    } else if (req.user?.role === "PARENT") {
      // Parents see events from schools where their children are enrolled
      const schoolIds = await getParentSchoolIds(req.user.id)
      where = {
        schoolId: { in: schoolIds },
        OR: [
          { classId: null }, // School-wide events
          {
            class: {
              students: {
                some: { parentId: req.user.id },
              },
            },
          },
        ],
      }
    }

    // Apply additional filters
    if (eventType) where.eventType = eventType
    if (classId) where.classId = classId
    if (upcoming) where.startTime = { gte: new Date() }
    if (startDate && endDate) {
      where.startTime = {
        gte: new Date(startDate),
        lte: new Date(endDate),
      }
    }

    const [events, total] = await Promise.all([
      prisma.event.findMany({
        where,
        skip,
        take: limit,
        include: {
          school: { select: { name: true } },
          class: { select: { name: true } },
          createdBy: {
            include: {
              user: { select: { name: true, surname: true } },
            },
          },
          _count: { select: { rsvps: true } },
        },
        orderBy: { startTime: "asc" },
      }),
      prisma.event.count({ where }),
    ])

    logger.info("Events retrieved", {
      userId: req.user?.id,
      userRole: req.user?.role,
      page,
      limit,
      total,
      filters: { eventType, classId, upcoming, startDate, endDate },
    })

    res.status(200).json({
      message: "Events retrieved successfully",
      events,
      pagination: { page, limit, total, pages: Math.ceil(total / limit) },
    })
  } catch (error) {
    handleError(res, error, "Failed to retrieve events")
  }
}

export const getEventById = async (req: AuthRequest, res: Response) => {
  const { id } = req.params
  try {
    const filter = getTenantFilter(req.user)

    const event = await prisma.event.findFirst({
      where: { id, ...filter },
      include: {
        class: {
          select: {
            name: true,
            students:
              req.user?.role === "PARENT"
                ? {
                    where: { parentId: req.user.id },
                    select: { id: true, name: true, surname: true },
                  }
                : { select: { id: true, name: true, surname: true } },
          },
        },
        createdBy: {
          include: {
            user: { select: { name: true, surname: true, email: true } },
          },
        },
        rsvps: {
          include: {
            user: { select: { name: true, surname: true, email: true } },
          },
        },
      },
    })

    if (!event) {
      logger.warn("Event not found", { userId: req.user?.id, eventId: id })
      return res.status(404).json({ message: "Event not found" })
    }

    // Check if current user has RSVP'd
    let userRsvp = null
    if (req.user) {
      userRsvp = await prisma.eventRSVP.findUnique({
        where: {
          eventId_userId: {
            eventId: id,
            userId: req.user.id,
          },
        },
      })
    }

    logger.info("Event retrieved", { userId: req.user?.id, eventId: id })
    res.status(200).json({
      message: "Event retrieved successfully",
      event: {
        ...event,
        userRsvp: userRsvp?.response || null,
      },
    })
  } catch (error) {
    handleError(res, error, "Failed to retrieve event")
  }
}

export const createEvent = async (req: AuthRequest, res: Response) => {
  try {
    const data = createEventSchema.parse(req.body)

    // Only principals can create events
    if (req.user?.role !== "PRINCIPAL") {
      return res.status(403).json({ message: "Only principals can create events" })
    }

    // Verify class if specified
    if (data.classId) {
      const classRecord = await prisma.class.findFirst({
        where: {
          id: data.classId,
          ...getTenantFilter(req.user),
        },
      })
      if (!classRecord) {
        return res.status(404).json({ message: "Class not found" })
      }
    }

    // Validate dates
    const startTime = new Date(data.startTime)
    const endTime = new Date(data.endTime)
    if (endTime <= startTime) {
      return res.status(400).json({ message: "End time must be after start time" })
    }

    const event = await prisma.event.create({
      data: {
        title: data.title,
        description: data.description,
        location: data.location,
        startTime,
        endTime,
        eventType: data.eventType,
        classId: data.classId,
        rsvpRequired: data.rsvpRequired,
        schoolId: req.user!.schoolId!,
        createdById: req.user!.id,
      },
      include: {
        class: { select: { name: true } },
      },
    })

    // Create notifications for relevant users
    let notificationTargets: string[] = []

    if (data.classId) {
      // Notify parents of students in the class
      const students = await prisma.student.findMany({
        where: { classId: data.classId },
        include: { parent: { include: { user: true } } },
      })
      notificationTargets = students.map((s) => s.parent.user.id)
    } else {
      // Notify all parents in the school - need to find parents through their children
      const students = await prisma.student.findMany({
        where: { schoolId: req.user!.schoolId! },
        include: { parent: { include: { user: true } } },
      })
      // Remove duplicates using Set
      const uniqueParentIds = new Set(students.map((s) => s.parent.user.id))
      notificationTargets = Array.from(uniqueParentIds)
    }

    // Send notifications
    const notificationPromises = notificationTargets.map((userId) =>
      createNotification(
        userId,
        `New Event: ${data.title}`,
        `A new event has been scheduled for ${startTime.toLocaleDateString()} at ${startTime.toLocaleTimeString()}. ${data.description}`,
        "EVENT",
        { eventId: event.id, rsvpRequired: data.rsvpRequired },
      ),
    )

    await Promise.all(notificationPromises)

    logger.info("Event created", {
      userId: req.user?.id,
      eventId: event.id,
      classId: data.classId,
      notificationsSent: notificationTargets.length,
    })

    res.status(201).json({
      message: "Event created successfully",
      event,
    })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ message: "Invalid input", errors: error.errors })
    }
    handleError(res, error, "Failed to create event")
  }
}

export const updateEvent = async (req: AuthRequest, res: Response) => {
  const { id } = req.params
  try {
    const data = updateEventSchema.parse(req.body)

    // Only principals can update events
    if (req.user?.role !== "PRINCIPAL") {
      return res.status(403).json({ message: "Only principals can update events" })
    }

    const filter = getTenantFilter(req.user)
    const existingEvent = await prisma.event.findFirst({
      where: { id, ...filter, createdById: req.user.id },
    })

    if (!existingEvent) {
      return res.status(404).json({ message: "Event not found or access denied" })
    }

    // Validate dates if provided
    if (data.startTime && data.endTime) {
      const startTime = new Date(data.startTime)
      const endTime = new Date(data.endTime)
      if (endTime <= startTime) {
        return res.status(400).json({ message: "End time must be after start time" })
      }
    }

    const event = await prisma.event.update({
      where: { id },
      data: {
        ...(data.title && { title: data.title }),
        ...(data.description && { description: data.description }),
        ...(data.location !== undefined && { location: data.location }),
        ...(data.startTime && { startTime: new Date(data.startTime) }),
        ...(data.endTime && { endTime: new Date(data.endTime) }),
        ...(data.eventType && { eventType: data.eventType }),
        ...(data.classId !== undefined && { classId: data.classId }),
        ...(data.rsvpRequired !== undefined && { rsvpRequired: data.rsvpRequired }),
        updatedAt: new Date(),
      },
      include: {
        class: { select: { name: true } },
      },
    })

    logger.info("Event updated", { userId: req.user?.id, eventId: id })
    res.status(200).json({
      message: "Event updated successfully",
      event,
    })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ message: "Invalid input", errors: error.errors })
    }
    handleError(res, error, "Failed to update event")
  }
}

export const deleteEvent = async (req: AuthRequest, res: Response) => {
  const { id } = req.params
  try {
    // Only principals can delete events
    if (req.user?.role !== "PRINCIPAL") {
      return res.status(403).json({ message: "Only principals can delete events" })
    }

    const filter = getTenantFilter(req.user)
    const event = await prisma.event.findFirst({
      where: { id, ...filter, createdById: req.user.id },
    })

    if (!event) {
      return res.status(404).json({ message: "Event not found or access denied" })
    }

    await prisma.event.delete({ where: { id } })

    logger.info("Event deleted", { userId: req.user?.id, eventId: id })
    res.status(200).json({ message: "Event deleted successfully" })
  } catch (error) {
    handleError(res, error, "Failed to delete event")
  }
}

export const uploadEventImages = async (req: AuthRequest & Request, res: Response) => {
  const { id } = req.params
  try {
    if (!req.files || !Array.isArray(req.files) || req.files.length === 0) {
      return res.status(400).json({ message: "No files uploaded" })
    }

    const filter = getTenantFilter(req.user)
    const event = await prisma.event.findFirst({
      where: { id, ...filter },
    })

    if (!event) {
      return res.status(404).json({ message: "Event not found or access denied" })
    }

    // Upload files directly to Supabase
    const uploadPromises = req.files.map(async (file: Express.Multer.File, index: number) => {
      const fileName = `event-${event.title.replace(/\s+/g, "-")}-${index + 1}-${Date.now()}-${file.originalname}`

      const { data: imageData, error: uploadError } = await supabase.storage
        .from("events")
        .upload(`/${req.user!.schoolId}/${fileName}`, file.buffer, {
          cacheControl: "2592000",
          contentType: file.mimetype,
        })

      if (uploadError) {
        throw new Error(uploadError.message)
      }

      // Get public URL
      const { data: urlData } = supabase.storage.from("events").getPublicUrl(imageData.path)

      // Save file record to database
      await prisma.fileStorage.create({
        data: {
          fileName: fileName,
          originalName: file.originalname,
          fileSize: file.size,
          mimeType: file.mimetype,
          fileUrl: urlData.publicUrl,
          bucketName: "events",
          uploadedById: req.user!.id,
          schoolId: req.user!.schoolId,
          fileCategory: "EVENT_IMAGE",
        },
      })

      return urlData.publicUrl
    })

    const imageUrls = await Promise.all(uploadPromises)

    // Update event with image URLs
    const updatedEvent = await prisma.event.update({
      where: { id },
      data: {
        imageUrls: [...event.imageUrls, ...imageUrls],
        updatedAt: new Date(),
      },
    })

    logger.info("Event images uploaded", {
      userId: req.user?.id,
      eventId: id,
      imageCount: imageUrls.length,
    })

    res.status(200).json({
      message: "Event images uploaded successfully",
      imageUrls,
      event: updatedEvent,
    })
  } catch (error) {
    handleError(res, error, "Failed to upload event images")
  }
}

export const rsvpToEvent = async (req: AuthRequest, res: Response) => {
  const { id } = req.params
  try {
    const data = rsvpSchema.parse(req.body)

    const filter = getTenantFilter(req.user)
    const event = await prisma.event.findFirst({
      where: { id, ...filter },
    })

    if (!event) {
      return res.status(404).json({ message: "Event not found or access denied" })
    }

    if (!event.rsvpRequired) {
      return res.status(400).json({ message: "RSVP is not required for this event" })
    }

    // Create or update RSVP
    const rsvp = await prisma.eventRSVP.upsert({
      where: {
        eventId_userId: {
          eventId: id,
          userId: req.user!.id,
        },
      },
      update: {
        response: data.response,
        respondedAt: new Date(),
      },
      create: {
        eventId: id,
        userId: req.user!.id,
        response: data.response,
      },
    })

    // Notify event creator
    if (event.createdById) {
      const user = await prisma.user.findUnique({
        where: { id: req.user!.id },
        select: { name: true, surname: true },
      })

      await createNotification(
        event.createdById,
        "Event RSVP Response",
        `${user?.name} ${user?.surname} has responded "${data.response}" to the event "${event.title}"`,
        "EVENT",
        { eventId: id, rsvpId: rsvp.id, response: data.response },
      )
    }

    logger.info("Event RSVP recorded", {
      userId: req.user?.id,
      eventId: id,
      response: data.response,
    })

    res.status(200).json({
      message: "RSVP recorded successfully",
      rsvp,
    })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ message: "Invalid input", errors: error.errors })
    }
    handleError(res, error, "Failed to record RSVP")
  }
}

export const getEventRSVPs = async (req: AuthRequest, res: Response) => {
  const { id } = req.params
  try {
    // Only principals and event creators can view RSVPs
    if (req.user?.role !== "PRINCIPAL") {
      return res.status(403).json({ message: "Only principals can view event RSVPs" })
    }

    const filter = getTenantFilter(req.user)
    const event = await prisma.event.findFirst({
      where: { id, ...filter },
      include: {
        rsvps: {
          include: {
            user: { select: { name: true, surname: true, email: true, role: true } },
          },
          select: {
            id: true,
            response: true,
            respondedAt: true,
            user: true,
          },
        },
      },
    })

    if (!event) {
      return res.status(404).json({ message: "Event not found or access denied" })
    }

    const summary = {
      total: event.rsvps.length,
      attending: event.rsvps.filter((r) => r.response === "ATTENDING").length,
      notAttending: event.rsvps.filter((r) => r.response === "NOT_ATTENDING").length,
      maybe: event.rsvps.filter((r) => r.response === "MAYBE").length,
    }

    logger.info("Event RSVPs retrieved", {
      userId: req.user?.id,
      eventId: id,
      rsvpCount: event.rsvps.length,
    })

    res.status(200).json({
      message: "Event RSVPs retrieved successfully",
      event: {
        id: event.id,
        title: event.title,
        startTime: event.startTime,
        rsvpRequired: event.rsvpRequired,
      },
      rsvps: event.rsvps,
      summary,
    })
  } catch (error) {
    handleError(res, error, "Failed to retrieve event RSVPs")
  }
}

export const getUpcomingEvents = async (req: AuthRequest, res: Response) => {
  try {
    const limit = Number.parseInt(req.query.limit as string) || 5
    const filter = getTenantFilter(req.user)

    // Get events for the next 30 days
    const thirtyDaysFromNow = new Date()
    thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30)

    const where: any = {
      ...filter,
      startTime: {
        gte: new Date(),
        lte: thirtyDaysFromNow,
      },
    }

    // If parent, filter by their children's classes
    if (req.user?.role === "PARENT") {
      const children = await prisma.student.findMany({
        where: { parentId: req.user.id },
        select: { classId: true },
      })

      const classIds = children.map((child) => child.classId).filter(Boolean)

      where.OR = [
        { classId: null }, // School-wide events
        { classId: { in: classIds } }, // Class-specific events
      ]
    }

    const events = await prisma.event.findMany({
      where,
      take: limit,
      include: {
        class: { select: { name: true } },
        _count: { select: { rsvps: true } },
      },
      orderBy: { startTime: "asc" },
    })

    logger.info("Upcoming events retrieved", {
      userId: req.user?.id,
      eventCount: events.length,
      limit,
    })

    res.status(200).json({
      message: "Upcoming events retrieved successfully",
      events,
    })
  } catch (error) {
    handleError(res, error, "Failed to retrieve upcoming events")
  }
}

async function getParentSchoolIds(parentId: string): Promise<string[]> {
  const children = await prisma.student.findMany({
    where: { parentId: parentId },
    select: { schoolId: true },
  })
  return children.map((child) => child.schoolId).filter((schoolId) => schoolId !== null) as string[]
}
