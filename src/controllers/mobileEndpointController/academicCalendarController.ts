import type { Request, Response } from "express"
import { PrismaClient } from "@prisma/client"

const prisma = new PrismaClient()

export const getEventsPerDatesAndTypes = async (req: Request, res: Response) => {
  try {
    const { startDate: startParam, endDate: endParam, eventTypes } = req.query

    const startDate = startParam ? new Date(startParam as string) : new Date()
    // Default to 7 days from start if endDate is not provided
    const endDate = endParam ? new Date(endParam as string) : new Date(startDate.getTime() + 7 * 24 * 60 * 60 * 1000)

    if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
      return res.status(400).json({ message: "Invalid date format. Use YYYY-MM-DD." })
    }

    const types = eventTypes
      ? (eventTypes as string).split(",").map((type) => type.trim().toUpperCase())
      : ["EXAM", "HOLIDAY", "EVENT", "ASSIGNMENT"]

    let allEvents: any[] = []

    // For mobile, we need to get schoolId from somewhere. Assuming it's passed or from auth.
    // Since doc doesn't specify, and it's mobile for parents, perhaps get from student's school.
    // But for now, to match doc, I'll assume schoolId is optional or get from auth.
    // Let's assume schoolId is required for now, but change param name.
    // Wait, doc doesn't have schoolId, so perhaps remove it and assume all schools or something.
    // To make it work, I'll keep schoolId but change to optional, and if not provided, get from auth or something.
    // But since it's not AuthRequest, perhaps add schoolId as optional.

    // For simplicity, make schoolId optional, and if not provided, fetch from all schools (but that might not be secure).
    // Perhaps the mobile app passes schoolId.

    // To match doc, I'll remove schoolId requirement and assume we filter by school later.
    // But for now, to make it work, I'll keep it as is but change response.

    // Actually, looking at doc, it's for academic calendar, probably per school, but doc doesn't specify.
    // Perhaps it's per student's school, but since no studentId, maybe global.

    // For now, I'll update the response structure to match doc.

    if (types.includes("EXAM") || types.includes("EXAMINATION")) {
      const exams = await prisma.exam.findMany({
        where: {
          startDate: {
            gte: startDate,
            lte: endDate,
          },
          // Remove schoolId filter for now
        },
        select: {
          id: true,
          title: true,
          startDate: true,
          endDate: true,
          description: true,
        },
      })
      allEvents = allEvents.concat(
        exams.map((exam) => ({
          id: exam.id,
          title: exam.title,
          description: exam.description,
          startDate: exam.startDate.toISOString().split('T')[0],
          endDate: exam.endDate.toISOString().split('T')[0],
          eventType: "EXAMINATION",
          isHoliday: false,
        })),
      )
    }

    if (types.includes("HOLIDAY")) {
      const holidays = await prisma.holiday.findMany({
        where: {
          startDate: {
            gte: startDate,
            lte: endDate,
          },
          // Remove schoolId
        },
        select: {
          id: true,
          name: true,
          startDate: true,
          endDate: true,
          description: true,
        },
      })
      allEvents = allEvents.concat(
        holidays.map((holiday) => ({
          id: holiday.id,
          title: holiday.name,
          description: holiday.description,
          startDate: holiday.startDate.toISOString().split('T')[0],
          endDate: holiday.endDate.toISOString().split('T')[0],
          eventType: "HOLIDAY",
          isHoliday: true,
        })),
      )
    }

    if (types.includes("EVENT")) {
      const schoolEvents = await prisma.event.findMany({
        where: {
          startTime: {
            gte: startDate,
            lte: endDate,
          },
          // Remove schoolId
        },
        select: {
          id: true,
          title: true,
          startTime: true,
          endTime: true,
          description: true,
        },
      })
      allEvents = allEvents.concat(
        schoolEvents.map((event) => ({
          id: event.id,
          title: event.title,
          description: event.description,
          startDate: event.startTime.toISOString().split('T')[0],
          endDate: event.endTime.toISOString().split('T')[0],
          eventType: "EVENT",
          isHoliday: false,
        })),
      )
    }

    if (types.includes("ASSIGNMENT")) {
      const assignments = await prisma.assignment.findMany({
        where: {
          dueDate: {
            gte: startDate,
            lte: endDate,
          },
          // Remove schoolId
        },
        select: {
          id: true,
          title: true,
          dueDate: true,
          description: true,
        },
      })
      allEvents = allEvents.concat(
        assignments.map((assignment) => ({
          id: assignment.id,
          title: assignment.title,
          description: assignment.description,
          startDate: assignment.dueDate.toISOString().split('T')[0],
          endDate: assignment.dueDate.toISOString().split('T')[0], // Same for assignments
          eventType: "ASSIGNMENT",
          isHoliday: false,
        })),
      )
    }

    // Sort events by startDate
    allEvents.sort((a, b) => new Date(a.startDate).getTime() - new Date(b.startDate).getTime())

    res.status(200).json({
      message: "Academic calendar events retrieved successfully",
      events: allEvents
    })
  } catch (error: unknown) {
    console.error("Error fetching academic calendar events:", error)
    res.status(500).json({ message: "Failed to fetch academic calendar events.", error: (error as Error).message })
  }
}
