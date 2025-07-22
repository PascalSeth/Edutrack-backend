import { Prisma } from "@prisma/client"
import type { Request, Response } from "express"
import { prisma } from "../../utils/setup"


// Helper to calculate duration in minutes from "HH:MM" strings
const calculateDuration = (startTimeStr: string, endTimeStr: string): number => {
  const [startHour, startMinute] = startTimeStr.split(":").map(Number)
  const [endHour, endMinute] = endTimeStr.split(":").map(Number)

  const startMinutes = startHour * 60 + startMinute
  const endMinutes = endHour * 60 + endMinute

  return endMinutes - startMinutes
}

// Define a type for the TimetableSlot with included relations
type TimetableSlotWithRelations = Prisma.TimetableSlotGetPayload<{
  include: {
    lesson: {
      include: {
        subject: true
      }
    }
    teacher: {
      include: {
        user: true // Include the user relation for teacher's name
      }
    }
    room: true
  }
}>

export const getTimetableForChild = async (req: Request, res: Response) => {
  try {
    const { studentId } = req.params
    const { day, startTime, endTime, subjectId, teacherId } = req.query

    if (!studentId) {
      return res.status(400).json({ message: "Student ID is required." })
    }

    // 1. Find the student and their class
    const student = await prisma.student.findUnique({
      where: { id: studentId },
      select: {
        id: true,
        name: true,
        surname: true,
        classId: true,
      },
    })

    if (!student) {
      return res.status(404).json({ message: "Student not found." })
    }

    if (!student.classId) {
      return res.status(404).json({ message: "Student is not assigned to a class, no timetable available." })
    }

    // 2. Find the active timetable associated with the student's class
    const today = new Date()
    today.setHours(0, 0, 0, 0) // Normalize to start of day

    const activeTimetable = await prisma.timetable.findFirst({
      where: {
        isActive: true,
        effectiveFrom: { lte: today },
        OR: [{ effectiveTo: { gte: today } }, { effectiveTo: null }],
        // Corrected: Use 'Class' (singular) as the relation name for many-to-many
        Class: {
          some: {
            id: student.classId,
          },
        },
      },
      select: {
        id: true,
        name: true, // Include timetable name for context
      },
    })

    if (!activeTimetable) {
      return res.status(404).json({ message: "No active timetable found for this student's class." })
    }

    // 3. Build the WHERE clause for timetable slots query
    const slotWhereClause: any = {
      timetableId: activeTimetable.id,
    }

    if (day) {
      slotWhereClause.day = String(day).toUpperCase() // Assuming Day enum values are uppercase
    }

    if (startTime) {
      slotWhereClause.startTime = { gte: String(startTime) }
    }
    if (endTime) {
      slotWhereClause.endTime = { lte: String(endTime) }
    }

    if (subjectId) {
      slotWhereClause.lesson = {
        subjectId: String(subjectId),
      }
    }
    if (teacherId) {
      slotWhereClause.teacherId = String(teacherId)
    }

    // 4. Fetch timetable slots - Fixed: Use include instead of select for lesson
    const timetableSlots: TimetableSlotWithRelations[] = await prisma.timetableSlot.findMany({
      where: slotWhereClause,
      include: {
        lesson: {
          include: {
            subject: true, // Include the full subject object
          },
        },
        teacher: {
          include: {
            user: {
              select: {
                name: true,
                surname: true,
              },
            },
          },
        },
        room: true, // Include the full room object
      },
      orderBy: [{ day: "asc" }, { startTime: "asc" }],
    })

    // 5. Format the results
    const formattedTimetable = timetableSlots.map((slot) => {
      const durationMinutes = calculateDuration(slot.startTime, slot.endTime)

      return {
        id: slot.id,
        day: slot.day,
        period: slot.period,
        startTime: slot.startTime,
        endTime: slot.endTime,
        durationMinutes: durationMinutes,
        lessonName: slot.lesson?.name || "N/A",
        subject: slot.lesson?.subject?.name || "N/A",
        // Corrected: Access name and surname from the nested user object
        teacher: slot.teacher?.user ? `${slot.teacher.user.name} ${slot.teacher.user.surname}` : "N/A",
        room: slot.room?.name || "N/A",
        isActive: slot.isActive,
        notes: slot.notes,
      }
    })

    res.status(200).json({
      message: "Timetable fetched successfully",
      timetableName: activeTimetable.name,
      data: formattedTimetable,
    })
  } catch (error: unknown) {
    console.error("Error fetching timetable:", error)
    res.status(500).json({ message: "Failed to fetch timetable", error: (error as Error).message })
  }
}