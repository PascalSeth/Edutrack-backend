"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getUpcomingEvents = exports.getEventRSVPs = exports.rsvpToEvent = exports.uploadEventImages = exports.deleteEvent = exports.updateEvent = exports.createEvent = exports.getEventById = exports.getEvents = void 0;
const zod_1 = require("zod");
const setup_1 = require("../utils/setup");
const fileUpload_1 = require("../utils/fileUpload");
const client_1 = require("@prisma/client");
// Validation Schemas
const createEventSchema = zod_1.z.object({
    title: zod_1.z.string().min(1, "Title is required"),
    description: zod_1.z.string().min(1, "Description is required"),
    location: zod_1.z.string().optional(),
    startTime: zod_1.z.string().datetime("Invalid start time"),
    endTime: zod_1.z.string().datetime("Invalid end time"),
    eventType: zod_1.z
        .enum(["ACADEMIC", "SPORTS", "CULTURAL", "MEETING", "EXAMINATION", "HOLIDAY", "GENERAL"])
        .default("GENERAL"),
    classId: zod_1.z.string().uuid("Invalid class ID").optional(),
    rsvpRequired: zod_1.z.boolean().default(false),
});
const updateEventSchema = createEventSchema.partial();
const rsvpSchema = zod_1.z.object({
    response: zod_1.z.enum(["ATTENDING", "NOT_ATTENDING", "MAYBE"]),
});
const getEvents = async (req, res) => {
    try {
        const page = Number.parseInt(req.query.page) || 1;
        const limit = Number.parseInt(req.query.limit) || 10;
        const skip = (page - 1) * limit;
        const filter = (0, setup_1.getTenantFilter)(req.user);
        const eventType = req.query.eventType;
        const classId = req.query.classId;
        const upcoming = req.query.upcoming === "true";
        const startDate = req.query.startDate;
        const endDate = req.query.endDate;
        const where = { ...filter };
        if (eventType) {
            where.eventType = eventType;
        }
        if (classId) {
            where.classId = classId;
        }
        if (upcoming) {
            where.startTime = { gte: new Date() };
        }
        if (startDate && endDate) {
            where.startTime = {
                gte: new Date(startDate),
                lte: new Date(endDate),
            };
        }
        const [events, total] = await Promise.all([
            setup_1.prisma.event.findMany({
                where,
                skip,
                take: limit,
                include: {
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
            setup_1.prisma.event.count({ where }),
        ]);
        setup_1.logger.info("Events retrieved", {
            userId: req.user?.id,
            page,
            limit,
            total,
            filters: { eventType, classId, upcoming, startDate, endDate },
        });
        res.status(200).json({
            message: "Events retrieved successfully",
            events,
            pagination: { page, limit, total, pages: Math.ceil(total / limit) },
        });
    }
    catch (error) {
        (0, setup_1.handleError)(res, error, "Failed to retrieve events");
    }
};
exports.getEvents = getEvents;
const getEventById = async (req, res) => {
    const { id } = req.params;
    try {
        const filter = (0, setup_1.getTenantFilter)(req.user);
        const event = await setup_1.prisma.event.findFirst({
            where: { id, ...filter },
            include: {
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
        });
        if (!event) {
            setup_1.logger.warn("Event not found", { userId: req.user?.id, eventId: id });
            return res.status(404).json({ message: "Event not found" });
        }
        // Check if current user has RSVP'd
        let userRsvp = null;
        if (req.user) {
            userRsvp = await setup_1.prisma.eventRSVP.findUnique({
                where: {
                    eventId_userId: {
                        eventId: id,
                        userId: req.user.id,
                    },
                },
            });
        }
        setup_1.logger.info("Event retrieved", { userId: req.user?.id, eventId: id });
        res.status(200).json({
            message: "Event retrieved successfully",
            event: {
                ...event,
                userRsvp: userRsvp?.response || null,
            },
        });
    }
    catch (error) {
        (0, setup_1.handleError)(res, error, "Failed to retrieve event");
    }
};
exports.getEventById = getEventById;
const createEvent = async (req, res) => {
    try {
        const data = createEventSchema.parse(req.body);
        // Only principals can create events
        if (req.user?.role !== "PRINCIPAL") {
            return res.status(403).json({ message: "Only principals can create events" });
        }
        // Verify class if specified
        if (data.classId) {
            const classRecord = await setup_1.prisma.class.findFirst({
                where: {
                    id: data.classId,
                    ...(0, setup_1.getTenantFilter)(req.user),
                },
            });
            if (!classRecord) {
                return res.status(404).json({ message: "Class not found" });
            }
        }
        // Validate dates
        const startTime = new Date(data.startTime);
        const endTime = new Date(data.endTime);
        if (endTime <= startTime) {
            return res.status(400).json({ message: "End time must be after start time" });
        }
        const event = await setup_1.prisma.event.create({
            data: {
                title: data.title,
                description: data.description,
                location: data.location,
                startTime,
                endTime,
                eventType: data.eventType,
                classId: data.classId,
                rsvpRequired: data.rsvpRequired,
                schoolId: req.user.schoolId,
                createdById: req.user.id,
            },
            include: {
                class: { select: { name: true } },
            },
        });
        // Create notifications for relevant users
        let notificationTargets = [];
        if (data.classId) {
            // Notify parents of students in the class
            const students = await setup_1.prisma.student.findMany({
                where: { classId: data.classId },
                include: { parent: { include: { user: true } } },
            });
            notificationTargets = students.map((s) => s.parent.user.id);
        }
        else {
            // Notify all parents in the school - need to find parents through their children
            const students = await setup_1.prisma.student.findMany({
                where: { schoolId: req.user.schoolId },
                include: { parent: { include: { user: true } } },
            });
            // Remove duplicates using Set
            const uniqueParentIds = new Set(students.map((s) => s.parent.user.id));
            notificationTargets = Array.from(uniqueParentIds);
        }
        // Send notifications
        const notificationPromises = notificationTargets.map((userId) => (0, setup_1.createNotification)(userId, `New Event: ${data.title}`, `A new event has been scheduled for ${startTime.toLocaleDateString()} at ${startTime.toLocaleTimeString()}. ${data.description}`, "EVENT", { eventId: event.id, rsvpRequired: data.rsvpRequired }));
        await Promise.all(notificationPromises);
        setup_1.logger.info("Event created", {
            userId: req.user?.id,
            eventId: event.id,
            classId: data.classId,
            notificationsSent: notificationTargets.length,
        });
        res.status(201).json({
            message: "Event created successfully",
            event,
        });
    }
    catch (error) {
        if (error instanceof zod_1.z.ZodError) {
            return res.status(400).json({ message: "Invalid input", errors: error.errors });
        }
        (0, setup_1.handleError)(res, error, "Failed to create event");
    }
};
exports.createEvent = createEvent;
const updateEvent = async (req, res) => {
    const { id } = req.params;
    try {
        const data = updateEventSchema.parse(req.body);
        // Only principals can update events
        if (req.user?.role !== "PRINCIPAL") {
            return res.status(403).json({ message: "Only principals can update events" });
        }
        const filter = (0, setup_1.getTenantFilter)(req.user);
        const existingEvent = await setup_1.prisma.event.findFirst({
            where: { id, ...filter, createdById: req.user.id },
        });
        if (!existingEvent) {
            return res.status(404).json({ message: "Event not found or access denied" });
        }
        // Validate dates if provided
        if (data.startTime && data.endTime) {
            const startTime = new Date(data.startTime);
            const endTime = new Date(data.endTime);
            if (endTime <= startTime) {
                return res.status(400).json({ message: "End time must be after start time" });
            }
        }
        const event = await setup_1.prisma.event.update({
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
        });
        setup_1.logger.info("Event updated", { userId: req.user?.id, eventId: id });
        res.status(200).json({
            message: "Event updated successfully",
            event,
        });
    }
    catch (error) {
        if (error instanceof zod_1.z.ZodError) {
            return res.status(400).json({ message: "Invalid input", errors: error.errors });
        }
        (0, setup_1.handleError)(res, error, "Failed to update event");
    }
};
exports.updateEvent = updateEvent;
const deleteEvent = async (req, res) => {
    const { id } = req.params;
    try {
        // Only principals can delete events
        if (req.user?.role !== "PRINCIPAL") {
            return res.status(403).json({ message: "Only principals can delete events" });
        }
        const filter = (0, setup_1.getTenantFilter)(req.user);
        const event = await setup_1.prisma.event.findFirst({
            where: { id, ...filter, createdById: req.user.id },
        });
        if (!event) {
            return res.status(404).json({ message: "Event not found or access denied" });
        }
        await setup_1.prisma.event.delete({ where: { id } });
        setup_1.logger.info("Event deleted", { userId: req.user?.id, eventId: id });
        res.status(200).json({ message: "Event deleted successfully" });
    }
    catch (error) {
        (0, setup_1.handleError)(res, error, "Failed to delete event");
    }
};
exports.deleteEvent = deleteEvent;
const uploadEventImages = async (req, res) => {
    const { id } = req.params;
    try {
        if (!req.files || !Array.isArray(req.files) || req.files.length === 0) {
            return res.status(400).json({ message: "No files uploaded" });
        }
        const filter = (0, setup_1.getTenantFilter)(req.user);
        const event = await setup_1.prisma.event.findFirst({
            where: { id, ...filter },
        });
        if (!event) {
            return res.status(404).json({ message: "Event not found or access denied" });
        }
        // Upload files
        const uploadPromises = req.files.map(async (file, index) => {
            return fileUpload_1.FileUploadService.uploadFile({
                file: file.buffer,
                fileName: `event-${event.title.replace(/\s+/g, "-")}-${index + 1}-${file.originalname}`,
                mimeType: file.mimetype,
                bucket: fileUpload_1.FileUploadService.getBucketForCategory(client_1.FileCategory.EVENT_IMAGE),
                schoolId: req.user.schoolId,
                uploadedById: req.user.id,
                category: client_1.FileCategory.EVENT_IMAGE,
            });
        });
        const uploadResults = await Promise.all(uploadPromises);
        const imageUrls = uploadResults.map((result) => result.fileUrl);
        // Update event with image URLs
        const updatedEvent = await setup_1.prisma.event.update({
            where: { id },
            data: {
                imageUrls: [...event.imageUrls, ...imageUrls],
                updatedAt: new Date(),
            },
        });
        setup_1.logger.info("Event images uploaded", {
            userId: req.user?.id,
            eventId: id,
            imageCount: imageUrls.length,
        });
        res.status(200).json({
            message: "Event images uploaded successfully",
            imageUrls,
            event: updatedEvent,
        });
    }
    catch (error) {
        (0, setup_1.handleError)(res, error, "Failed to upload event images");
    }
};
exports.uploadEventImages = uploadEventImages;
const rsvpToEvent = async (req, res) => {
    const { id } = req.params;
    try {
        const data = rsvpSchema.parse(req.body);
        const filter = (0, setup_1.getTenantFilter)(req.user);
        const event = await setup_1.prisma.event.findFirst({
            where: { id, ...filter },
        });
        if (!event) {
            return res.status(404).json({ message: "Event not found or access denied" });
        }
        if (!event.rsvpRequired) {
            return res.status(400).json({ message: "RSVP is not required for this event" });
        }
        // Create or update RSVP
        const rsvp = await setup_1.prisma.eventRSVP.upsert({
            where: {
                eventId_userId: {
                    eventId: id,
                    userId: req.user.id,
                },
            },
            update: {
                response: data.response,
                respondedAt: new Date(),
            },
            create: {
                eventId: id,
                userId: req.user.id,
                response: data.response,
            },
        });
        // Notify event creator
        if (event.createdById) {
            const user = await setup_1.prisma.user.findUnique({
                where: { id: req.user.id },
                select: { name: true, surname: true },
            });
            await (0, setup_1.createNotification)(event.createdById, "Event RSVP Response", `${user?.name} ${user?.surname} has responded "${data.response}" to the event "${event.title}"`, "EVENT", { eventId: id, rsvpId: rsvp.id, response: data.response });
        }
        setup_1.logger.info("Event RSVP recorded", {
            userId: req.user?.id,
            eventId: id,
            response: data.response,
        });
        res.status(200).json({
            message: "RSVP recorded successfully",
            rsvp,
        });
    }
    catch (error) {
        if (error instanceof zod_1.z.ZodError) {
            return res.status(400).json({ message: "Invalid input", errors: error.errors });
        }
        (0, setup_1.handleError)(res, error, "Failed to record RSVP");
    }
};
exports.rsvpToEvent = rsvpToEvent;
const getEventRSVPs = async (req, res) => {
    const { id } = req.params;
    try {
        // Only principals and event creators can view RSVPs
        if (req.user?.role !== "PRINCIPAL") {
            return res.status(403).json({ message: "Only principals can view event RSVPs" });
        }
        const filter = (0, setup_1.getTenantFilter)(req.user);
        const event = await setup_1.prisma.event.findFirst({
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
        });
        if (!event) {
            return res.status(404).json({ message: "Event not found or access denied" });
        }
        const summary = {
            total: event.rsvps.length,
            attending: event.rsvps.filter((r) => r.response === "ATTENDING").length,
            notAttending: event.rsvps.filter((r) => r.response === "NOT_ATTENDING").length,
            maybe: event.rsvps.filter((r) => r.response === "MAYBE").length,
        };
        setup_1.logger.info("Event RSVPs retrieved", {
            userId: req.user?.id,
            eventId: id,
            rsvpCount: event.rsvps.length,
        });
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
        });
    }
    catch (error) {
        (0, setup_1.handleError)(res, error, "Failed to retrieve event RSVPs");
    }
};
exports.getEventRSVPs = getEventRSVPs;
const getUpcomingEvents = async (req, res) => {
    try {
        const limit = Number.parseInt(req.query.limit) || 5;
        const filter = (0, setup_1.getTenantFilter)(req.user);
        // Get events for the next 30 days
        const thirtyDaysFromNow = new Date();
        thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30);
        const where = {
            ...filter,
            startTime: {
                gte: new Date(),
                lte: thirtyDaysFromNow,
            },
        };
        // If parent, filter by their children's classes
        if (req.user?.role === "PARENT") {
            const children = await setup_1.prisma.student.findMany({
                where: { parentId: req.user.id },
                select: { classId: true },
            });
            const classIds = children.map((child) => child.classId).filter(Boolean);
            where.OR = [
                { classId: null }, // School-wide events
                { classId: { in: classIds } }, // Class-specific events
            ];
        }
        const events = await setup_1.prisma.event.findMany({
            where,
            take: limit,
            include: {
                class: { select: { name: true } },
                _count: { select: { rsvps: true } },
            },
            orderBy: { startTime: "asc" },
        });
        setup_1.logger.info("Upcoming events retrieved", {
            userId: req.user?.id,
            eventCount: events.length,
            limit,
        });
        res.status(200).json({
            message: "Upcoming events retrieved successfully",
            events,
        });
    }
    catch (error) {
        (0, setup_1.handleError)(res, error, "Failed to retrieve upcoming events");
    }
};
exports.getUpcomingEvents = getUpcomingEvents;
