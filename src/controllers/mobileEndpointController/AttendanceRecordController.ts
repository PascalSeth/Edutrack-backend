import type { Request, Response } from "express"
import { PrismaClient } from "@prisma/client" // Removed AttendanceStatus import

const prisma = new PrismaClient()

export const getAttendanceBasedOnFilter = async (req: Request, res: Response) => {
  try {
    const { studentId, filterType, termId } = req.query

    if (!studentId) {
      return res.status(400).json({ message: "Student ID is required." })
    }

    let startDate: Date
    let endDate: Date
    const today = new Date()
    today.setHours(0, 0, 0, 0) // Normalize to start of day

    switch (
      (filterType as string)?.toUpperCase() // Explicitly cast filterType to string
    ) {
      case "MONTH":
        startDate = new Date(today.getFullYear(), today.getMonth(), 1)
        endDate = new Date(today.getFullYear(), today.getMonth() + 1, 0) // Last day of current month
        endDate.setHours(23, 59, 59, 999)
        break
      case "TERM":
        if (!termId) {
          return res.status(400).json({ message: "Term ID is required for term filter." })
        }
        const term = await prisma.term.findUnique({
          where: { id: termId as string },
          select: { startDate: true, endDate: true },
        })
        if (!term) {
          return res.status(404).json({ message: "Term not found." })
        }
        startDate = term.startDate
        endDate = term.endDate
        endDate.setHours(23, 59, 59, 999)
        break
      case "WEEK":
      default: // Default to week
        const dayOfWeek = today.getDay() // 0 for Sunday, 1 for Monday, etc.
        const diff = today.getDate() - dayOfWeek + (dayOfWeek === 0 ? -6 : 1) // Adjust to Monday of current week
        startDate = new Date(today.setDate(diff))
        startDate.setHours(0, 0, 0, 0)
        endDate = new Date(startDate)
        endDate.setDate(startDate.getDate() + 6) // End of Sunday
        endDate.setHours(23, 59, 59, 999)
        break
    }

    const student = await prisma.student.findUnique({
      where: { id: studentId as string },
      select: { name: true, surname: true },
    })

    if (!student) {
      return res.status(404).json({ message: "Student not found." })
    }

    const attendanceRecords = await prisma.attendance.findMany({
      where: {
        studentId: studentId as string,
        date: {
          gte: startDate,
          lte: endDate,
        },
      },
      select: {
        id: true,
        date: true,
        present: true, // Select 'present' boolean instead of 'status'
        // timeReported is not available on the Attendance model based on errors
      },
      orderBy: {
        date: "asc",
      },
    })

    // Calculate attendance summary based on 'present' boolean
    let presentCount = 0
    let absentCount = 0
    // 'lateCount' cannot be determined from the current schema (no 'timeReported' or 'late' field)

    attendanceRecords.forEach((record) => {
      if (record.present) {
        presentCount++
      } else {
        absentCount++
      }
    })

    res.status(200).json({
      success: true,
      data: {
        studentName: `${student.name} ${student.surname}`,
        filter: filterType || "WEEK",
        dateRange: {
          startDate: startDate.toISOString().split("T")[0],
          endDate: endDate.toISOString().split("T")[0],
        },
        summary: {
          totalDays: attendanceRecords.length,
          present: presentCount,
          absent: absentCount,
          // late: lateCount, // Removed as it's not supported by schema
        },
        records: attendanceRecords.map((record) => ({
          id: record.id,
          date: record.date.toISOString().split("T")[0],
          status: record.present ? "PRESENT" : "ABSENT", // Derive status from 'present'
          timeReported: null, // Set to null as it's not available in the schema
        })),
      },
    })
  } catch (error: unknown) {
    console.error("Error fetching attendance records:", error)
    res.status(500).json({ message: "Failed to fetch attendance records.", error: (error as Error).message })
  }
}
