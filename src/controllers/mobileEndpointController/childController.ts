import type { Response } from "express"
import { prisma, type AuthRequest, handleError, logger } from "../../utils/setup"

// Get child attendance
export const getChildAttendance = async (req: AuthRequest, res: Response) => {
  try {
    const { childId } = req.params

    // Verify parent has access to this child
    if (req.user?.role !== "PARENT") {
      return res.status(403).json({ message: "Only parents can access child data" })
    }

    const child = await prisma.student.findFirst({
      where: {
        id: childId,
        OR: [
          { parentId: req.user.id }, // Legacy relationship
          { parents: { some: { parentId: req.user.id } } } // New StudentParent relationship
        ]
      },
      include: {
        school: { select: { id: true, name: true } }
      }
    })

    if (!child) {
      return res.status(404).json({ message: "Child not found or access denied" })
    }

    // Get attendance records for this week
    const now = new Date()
    const weekStart = new Date(now.setDate(now.getDate() - now.getDay()))
    const weekEnd = new Date(weekStart)
    weekEnd.setDate(weekEnd.getDate() + 6)

    const attendanceRecords = await prisma.attendance.findMany({
      where: {
        studentId: childId,
        date: {
          gte: weekStart,
          lte: weekEnd
        }
      },
      orderBy: { date: "asc" }
    })

    // Calculate attendance stats
    const present = attendanceRecords.filter(r => r.present === true).length
    const absent = attendanceRecords.filter(r => r.present === false).length
    const total = attendanceRecords.length

    const thisWeek = attendanceRecords.map(record => ({
      date: record.date.toISOString().split('T')[0],
      status: record.present ? "Present" : "Absent"
    }))

    logger.info("Child attendance retrieved", {
      userId: req.user.id,
      childId: childId,
      present,
      absent,
      total
    })

    res.status(200).json({
      present,
      absent,
      total,
      thisWeek
    })
  } catch (error) {
    handleError(res, error, "Failed to retrieve child attendance")
  }
}

// Get child assignments
export const getChildAssignments = async (req: AuthRequest, res: Response) => {
  try {
    const { childId } = req.params

    // Verify parent has access to this child
    if (req.user?.role !== "PARENT") {
      return res.status(403).json({ message: "Only parents can access child data" })
    }

    const child = await prisma.student.findFirst({
      where: {
        id: childId,
        OR: [
          { parentId: req.user.id }, // Legacy relationship
          { parents: { some: { parentId: req.user.id } } } // New StudentParent relationship
        ]
      }
    })

    if (!child) {
      return res.status(404).json({ message: "Child not found or access denied" })
    }

    // Get assignments for child's class or school-wide
    const assignments = await prisma.assignment.findMany({
      where: {
        OR: [
          { classId: child.classId },
          { assignmentType: "CLASS_WIDE", schoolId: child.schoolId }
        ]
      },
      include: {
        subject: { select: { name: true } },
        teacher: {
          include: {
            user: { select: { name: true, surname: true } }
          }
        },
        submissions: {
          where: { studentId: childId },
          select: { id: true }
        }
      },
      orderBy: { dueDate: "asc" }
    })

    const formattedAssignments = assignments.map(assignment => ({
      id: assignment.id,
      title: assignment.title,
      subject: assignment.subject.name,
      dueDate: assignment.dueDate.toISOString().split('T')[0],
      status: assignment.dueDate < new Date() ? "Overdue" :
             assignment.submissions.length > 0 ? "Completed" : "Pending"
    }))

    logger.info("Child assignments retrieved", {
      userId: req.user.id,
      childId: childId,
      count: formattedAssignments.length
    })

    res.status(200).json(formattedAssignments)
  } catch (error) {
    handleError(res, error, "Failed to retrieve child assignments")
  }
}

// Get child timetable
export const getChildTimetable = async (req: AuthRequest, res: Response) => {
  try {
    const { childId } = req.params

    // Verify parent has access to this child
    if (req.user?.role !== "PARENT") {
      return res.status(403).json({ message: "Only parents can access child data" })
    }

    const child = await prisma.student.findFirst({
      where: {
        id: childId,
        OR: [
          { parentId: req.user.id }, // Legacy relationship
          { parents: { some: { parentId: req.user.id } } } // New StudentParent relationship
        ]
      }
    })

    if (!child) {
      return res.status(404).json({ message: "Child not found or access denied" })
    }

    if (!child.classId) {
      return res.status(400).json({ message: "Child is not assigned to a class" })
    }

    // Get timetable entries for child's class
    const timetableSlots = await prisma.timetableSlot.findMany({
      where: {
        lesson: {
          classId: child.classId
        }
      },
      include: {
        lesson: {
          include: {
            subject: { select: { name: true } },
            teacher: {
              include: {
                user: { select: { name: true, surname: true } }
              }
            }
          }
        },
        room: { select: { name: true } }
      },
      orderBy: [
        { day: "asc" },
        { startTime: "asc" }
      ]
    })

    // Group by day
    const timetable: { [key: string]: any[] } = {}
    const days = ["MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY", "FRIDAY", "SATURDAY", "SUNDAY"]

    timetableSlots.forEach(slot => {
      const day = slot.day as string
      if (!timetable[day]) {
        timetable[day] = []
      }

      timetable[day].push({
        time: slot.startTime,
        subject: slot.lesson.subject.name,
        teacher: `${slot.lesson.teacher.user.name} ${slot.lesson.teacher.user.surname}`,
        room: slot.room?.name || "TBD"
      })
    })

    logger.info("Child timetable retrieved", {
      userId: req.user.id,
      childId: childId,
      daysWithClasses: Object.keys(timetable).length
    })

    res.status(200).json(timetable)
  } catch (error) {
    handleError(res, error, "Failed to retrieve child timetable")
  }
}

// Get child chat/messages
export const getChildChat = async (req: AuthRequest, res: Response) => {
  try {
    const { childId } = req.params

    // Verify parent has access to this child
    if (req.user?.role !== "PARENT") {
      return res.status(403).json({ message: "Only parents can access child data" })
    }

    const child = await prisma.student.findFirst({
      where: {
        id: childId,
        OR: [
          { parentId: req.user.id }, // Legacy relationship
          { parents: { some: { parentId: req.user.id } } } // New StudentParent relationship
        ]
      }
    })

    if (!child) {
      return res.status(404).json({ message: "Child not found or access denied" })
    }

    // Get messages for this child (using notifications as chat messages)
    const messages = await prisma.notification.findMany({
      where: {
        userId: req.user.id,
        type: "MESSAGE"
      },
      include: {
        user: { select: { name: true, surname: true } }
      },
      orderBy: { createdAt: "desc" },
      take: 50
    })

    const formattedMessages = messages.map(message => ({
      id: message.id,
      teacher: `${message.user.name} ${message.user.surname}`,
      message: message.content,
      timestamp: message.createdAt.toISOString()
    }))

    logger.info("Child chat messages retrieved", {
      userId: req.user.id,
      childId: childId,
      messageCount: formattedMessages.length
    })

    res.status(200).json(formattedMessages)
  } catch (error) {
    handleError(res, error, "Failed to retrieve child chat")
  }
}

// Get child grades
export const getChildGrades = async (req: AuthRequest, res: Response) => {
  try {
    const { childId } = req.params

    // Verify parent has access to this child
    if (req.user?.role !== "PARENT") {
      return res.status(403).json({ message: "Only parents can access child data" })
    }

    const child = await prisma.student.findFirst({
      where: {
        id: childId,
        OR: [
          { parentId: req.user.id }, // Legacy relationship
          { parents: { some: { parentId: req.user.id } } } // New StudentParent relationship
        ]
      }
    })

    if (!child) {
      return res.status(404).json({ message: "Child not found or access denied" })
    }

    // Get grades/results for this child
    const results = await prisma.result.findMany({
      where: {
        studentId: childId
      },
      include: {
        exam: {
          include: {
            subject: { select: { name: true } }
          }
        }
      },
      orderBy: { uploadedAt: "desc" }
    })

    // Calculate overall grade and course count
    const totalScore = results.reduce((sum: number, result: any) => sum + (result.percentage || 0), 0)
    const overallGrade = results.length > 0 ? Math.round(totalScore / results.length) : 0
    const totalCourses = new Set(results.map((r: any) => r.exam?.subjectId)).size

    const grades = {
      overall: `${overallGrade}%`,
      courses: totalCourses
    }

    logger.info("Child grades retrieved", {
      userId: req.user.id,
      childId: childId,
      overallGrade,
      totalCourses
    })

    res.status(200).json(grades)
  } catch (error) {
    handleError(res, error, "Failed to retrieve child grades")
  }
}