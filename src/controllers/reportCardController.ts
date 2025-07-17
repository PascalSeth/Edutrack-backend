import type { Response } from "express"
import { z } from "zod"
import { prisma, type AuthRequest, handleError, logger, getTenantFilter } from "../utils/setup"

// Validation Schemas
const createReportCardSchema = z.object({
  title: z.string().min(1, "Title is required"),
  studentId: z.string().uuid("Invalid student ID"),
  academicYearId: z.string().uuid("Invalid academic year ID"),
  termId: z.string().uuid("Invalid term ID").optional(),
  schoolId: z.string().uuid("Invalid school ID"),
})

const updateReportCardSchema = z.object({
  title: z.string().min(1).optional(),
  overallGrade: z.string().optional(),
  overallGPA: z.number().min(0).max(4).optional(),
  totalMarks: z.number().int().min(0).optional(),
  obtainedMarks: z.number().int().min(0).optional(),
  percentage: z.number().min(0).max(100).optional(),
  position: z.number().int().min(1).optional(),
  totalStudents: z.number().int().min(1).optional(),
  teacherComments: z.string().optional(),
  principalComments: z.string().optional(),
  status: z.enum(["DRAFT", "GENERATED", "APPROVED", "PUBLISHED", "ARCHIVED"]).optional(),
})

const createSubjectReportSchema = z.object({
  reportCardId: z.string().uuid("Invalid report card ID"),
  subjectId: z.string().uuid("Invalid subject ID"),
  totalMarks: z.number().int().min(1, "Total marks must be positive"),
  obtainedMarks: z.number().int().min(0, "Obtained marks must be non-negative"),
  teacherComments: z.string().optional(),
})

const updateSubjectReportSchema = z.object({
  totalMarks: z.number().int().min(1).optional(),
  obtainedMarks: z.number().int().min(0).optional(),
  teacherComments: z.string().optional(),
})

const generateReportCardSchema = z.object({
  studentIds: z.array(z.string().uuid("Invalid student ID")).min(1, "At least one student is required"),
  academicYearId: z.string().uuid("Invalid academic year ID"),
  termId: z.string().uuid("Invalid term ID").optional(),
  schoolId: z.string().uuid("Invalid school ID"),
  includeSubjects: z.array(z.string().uuid("Invalid subject ID")).optional(),
})

// Define proper types for subject results
interface SubjectResultData {
  totalMarks: number
  obtainedMarks: number
  count: number
}

export const getReportCards = async (req: AuthRequest, res: Response) => {
  try {
    const page = Number.parseInt(req.query.page as string) || 1
    const limit = Number.parseInt(req.query.limit as string) || 10
    const skip = (page - 1) * limit
    const filter = getTenantFilter(req.user)

    const [reportCards, total] = await Promise.all([
      prisma.reportCard.findMany({
        where: filter,
        skip,
        take: limit,
        include: {
          student: {
            select: {
              name: true,
              surname: true,
              registrationNumber: true,
              class: { select: { name: true } },
              grade: { select: { name: true } },
            },
          },
          academicYear: { select: { name: true } },
          term: { select: { name: true } },
          _count: {
            select: {
              subjectReports: true,
            },
          },
        },
        orderBy: { createdAt: "desc" },
      }),
      prisma.reportCard.count({ where: filter }),
    ])

    logger.info("Report cards retrieved", { userId: req.user?.id, page, limit, total })
    res.status(200).json({
      message: "Report cards retrieved successfully",
      reportCards,
      pagination: { page, limit, total, pages: Math.ceil(total / limit) },
    })
  } catch (error) {
    handleError(res, error, "Failed to retrieve report cards")
  }
}

export const getReportCardById = async (req: AuthRequest, res: Response) => {
  const { id } = req.params
  try {
    const filter = getTenantFilter(req.user)

    const reportCard = await prisma.reportCard.findFirst({
      where: { id, ...filter },
      include: {
        student: {
          select: {
            id: true,
            name: true,
            surname: true,
            registrationNumber: true,
            imageUrl: true,
            class: { select: { name: true } },
            grade: { select: { name: true, level: true } },
            parent: {
              include: {
                user: { select: { name: true, surname: true, email: true, phone: true } },
              },
            },
          },
        },
        academicYear: { select: { name: true, startDate: true, endDate: true } },
        term: { select: { name: true, startDate: true, endDate: true } },
        subjectReports: {
          include: {
            subject: { select: { name: true, code: true } },
          },
          orderBy: { subject: { name: "asc" } },
        },
        school: {
          select: {
            name: true,
            address: true,
            logoUrl: true,
            phone: true,
            email: true,
          },
        },
      },
    })

    if (!reportCard) {
      logger.warn("Report card not found", { userId: req.user?.id, reportCardId: id })
      return res.status(404).json({ message: "Report card not found" })
    }

    logger.info("Report card retrieved", { userId: req.user?.id, reportCardId: id })
    res.status(200).json({
      message: "Report card retrieved successfully",
      reportCard,
    })
  } catch (error) {
    handleError(res, error, "Failed to retrieve report card")
  }
}

export const createReportCard = async (req: AuthRequest, res: Response) => {
  try {
    if (!["PRINCIPAL", "SCHOOL_ADMIN", "TEACHER"].includes(req.user?.role || "")) {
      return res.status(403).json({ message: "Access denied" })
    }

    const data = createReportCardSchema.parse(req.body)

    // Verify student exists and belongs to the school
    const student = await prisma.student.findFirst({
      where: {
        id: data.studentId,
        schoolId: data.schoolId,
      },
      include: {
        class: { select: { name: true } },
        grade: { select: { name: true } },
      },
    })

    if (!student) {
      return res.status(404).json({ message: "Student not found" })
    }

    // Check if report card already exists for this student, academic year, and term
    const existingReportCard = await prisma.reportCard.findFirst({
      where: {
        studentId: data.studentId,
        academicYearId: data.academicYearId,
        termId: data.termId,
      },
    })

    if (existingReportCard) {
      return res.status(400).json({ message: "Report card already exists for this period" })
    }

    const reportCard = await prisma.reportCard.create({
      data: {
        title: data.title,
        studentId: data.studentId,
        academicYearId: data.academicYearId,
        termId: data.termId,
        schoolId: data.schoolId,
        status: "DRAFT",
      },
      include: {
        student: {
          select: {
            name: true,
            surname: true,
            registrationNumber: true,
            class: { select: { name: true } },
            grade: { select: { name: true } },
          },
        },
        academicYear: { select: { name: true } },
        term: { select: { name: true } },
      },
    })

    logger.info("Report card created", {
      userId: req.user?.id,
      reportCardId: reportCard.id,
      studentId: data.studentId,
    })

    res.status(201).json({
      message: "Report card created successfully",
      reportCard,
    })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ message: "Validation error", errors: error.errors })
    }
    handleError(res, error, "Failed to create report card")
  }
}

export const updateReportCard = async (req: AuthRequest, res: Response) => {
  const { id } = req.params
  try {
    if (!["PRINCIPAL", "SCHOOL_ADMIN", "TEACHER"].includes(req.user?.role || "")) {
      return res.status(403).json({ message: "Access denied" })
    }

    const data = updateReportCardSchema.parse(req.body)
    const filter = getTenantFilter(req.user)

    const existingReportCard = await prisma.reportCard.findFirst({
      where: { id, ...filter },
    })

    if (!existingReportCard) {
      return res.status(404).json({ message: "Report card not found" })
    }

    // Check if report card is already approved and user is not principal
    if (existingReportCard.status === "APPROVED" && req.user?.role !== "PRINCIPAL") {
      return res.status(403).json({ message: "Cannot modify approved report card" })
    }

    const reportCard = await prisma.reportCard.update({
      where: { id },
      data: {
        ...(data.title && { title: data.title }),
        ...(data.overallGrade !== undefined && { overallGrade: data.overallGrade }),
        ...(data.overallGPA !== undefined && { overallGPA: data.overallGPA }),
        ...(data.totalMarks !== undefined && { totalMarks: data.totalMarks }),
        ...(data.obtainedMarks !== undefined && { obtainedMarks: data.obtainedMarks }),
        ...(data.percentage !== undefined && { percentage: data.percentage }),
        ...(data.position !== undefined && { position: data.position }),
        ...(data.totalStudents !== undefined && { totalStudents: data.totalStudents }),
        ...(data.teacherComments !== undefined && { teacherComments: data.teacherComments }),
        ...(data.principalComments !== undefined && { principalComments: data.principalComments }),
        ...(data.status && { status: data.status }),
        updatedAt: new Date(),
      },
      include: {
        student: {
          select: {
            name: true,
            surname: true,
            registrationNumber: true,
            class: { select: { name: true } },
            grade: { select: { name: true } },
          },
        },
        academicYear: { select: { name: true } },
        term: { select: { name: true } },
      },
    })

    logger.info("Report card updated", { userId: req.user?.id, reportCardId: id })
    res.status(200).json({
      message: "Report card updated successfully",
      reportCard,
    })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ message: "Validation error", errors: error.errors })
    }
    handleError(res, error, "Failed to update report card")
  }
}

export const deleteReportCard = async (req: AuthRequest, res: Response) => {
  const { id } = req.params
  try {
    if (!["PRINCIPAL", "SCHOOL_ADMIN"].includes(req.user?.role || "")) {
      return res.status(403).json({ message: "Access denied" })
    }

    const filter = getTenantFilter(req.user)

    const reportCard = await prisma.reportCard.findFirst({
      where: { id, ...filter },
    })

    if (!reportCard) {
      return res.status(404).json({ message: "Report card not found" })
    }

    // Check if report card is published
    if (reportCard.status === "PUBLISHED") {
      return res.status(400).json({ message: "Cannot delete published report card" })
    }

    await prisma.reportCard.delete({
      where: { id },
    })

    logger.info("Report card deleted", { userId: req.user?.id, reportCardId: id })
    res.status(200).json({ message: "Report card deleted successfully" })
  } catch (error) {
    handleError(res, error, "Failed to delete report card")
  }
}

export const approveReportCard = async (req: AuthRequest, res: Response) => {
  const { id } = req.params
  try {
    if (!["PRINCIPAL", "SCHOOL_ADMIN"].includes(req.user?.role || "")) {
      return res.status(403).json({ message: "Access denied" })
    }

    const filter = getTenantFilter(req.user)

    const reportCard = await prisma.reportCard.findFirst({
      where: { id, ...filter },
    })

    if (!reportCard) {
      return res.status(404).json({ message: "Report card not found" })
    }

    if (reportCard.status !== "GENERATED") {
      return res.status(400).json({ message: "Only generated report cards can be approved" })
    }

    const updatedReportCard = await prisma.reportCard.update({
      where: { id },
      data: {
        status: "APPROVED",
        approvedAt: new Date(),
      },
      include: {
        student: {
          select: {
            name: true,
            surname: true,
            registrationNumber: true,
            class: { select: { name: true } },
            grade: { select: { name: true } },
          },
        },
        academicYear: { select: { name: true } },
        term: { select: { name: true } },
      },
    })

    logger.info("Report card approved", { userId: req.user?.id, reportCardId: id })
    res.status(200).json({
      message: "Report card approved successfully",
      reportCard: updatedReportCard,
    })
  } catch (error) {
    handleError(res, error, "Failed to approve report card")
  }
}

export const publishReportCard = async (req: AuthRequest, res: Response) => {
  const { id } = req.params
  try {
    if (!["PRINCIPAL", "SCHOOL_ADMIN"].includes(req.user?.role || "")) {
      return res.status(403).json({ message: "Access denied" })
    }

    const filter = getTenantFilter(req.user)

    const reportCard = await prisma.reportCard.findFirst({
      where: { id, ...filter },
      include: {
        student: {
          include: {
            parent: {
              include: {
                user: { select: { id: true, name: true, email: true } },
              },
            },
          },
        },
      },
    })

    if (!reportCard) {
      return res.status(404).json({ message: "Report card not found" })
    }

    if (reportCard.status !== "APPROVED") {
      return res.status(400).json({ message: "Only approved report cards can be published" })
    }

    const updatedReportCard = await prisma.reportCard.update({
      where: { id },
      data: {
        status: "PUBLISHED",
        // publishedAt: new Date(),
      },
    })

    // Send notification to parent
    if (reportCard.student.parent) {
      await prisma.notification.create({
        data: {
          title: "Report Card Published",
          content: `Report card for ${reportCard.student.name} ${reportCard.student.surname} has been published`,
          type: "GENERAL",
          userId: reportCard.student.parent.user.id,
        },
      })
    }

    logger.info("Report card published", { userId: req.user?.id, reportCardId: id })
    res.status(200).json({
      message: "Report card published successfully",
      reportCard: updatedReportCard,
    })
  } catch (error) {
    handleError(res, error, "Failed to publish report card")
  }
}

export const createSubjectReport = async (req: AuthRequest, res: Response) => {
  try {
    if (!["PRINCIPAL", "SCHOOL_ADMIN", "TEACHER"].includes(req.user?.role || "")) {
      return res.status(403).json({ message: "Access denied" })
    }

    const data = createSubjectReportSchema.parse(req.body)

    // Verify report card exists and user has access
    const reportCard = await prisma.reportCard.findFirst({
      where: {
        id: data.reportCardId,
        ...getTenantFilter(req.user),
      },
    })

    if (!reportCard) {
      return res.status(404).json({ message: "Report card not found" })
    }

    // Check if subject report already exists
    const existingSubjectReport = await prisma.subjectReport.findFirst({
      where: {
        reportCardId: data.reportCardId,
        subjectId: data.subjectId,
      },
    })

    if (existingSubjectReport) {
      return res.status(400).json({ message: "Subject report already exists" })
    }

    // Calculate percentage and grade
    const percentage = (data.obtainedMarks / data.totalMarks) * 100
    const grade = getGradeFromPercentage(percentage)

    const subjectReport = await prisma.subjectReport.create({
      data: {
        reportCardId: data.reportCardId,
        subjectId: data.subjectId,
        totalMarks: data.totalMarks,
        obtainedMarks: data.obtainedMarks,
        percentage,
        grade,
        teacherComments: data.teacherComments,
      },
      include: {
        subject: { select: { name: true, code: true } },
        reportCard: {
          select: {
            title: true,
            student: { select: { name: true, surname: true } },
          },
        },
      },
    })

    logger.info("Subject report created", {
      userId: req.user?.id,
      subjectReportId: subjectReport.id,
      reportCardId: data.reportCardId,
    })

    res.status(201).json({
      message: "Subject report created successfully",
      subjectReport,
    })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ message: "Validation error", errors: error.errors })
    }
    handleError(res, error, "Failed to create subject report")
  }
}

export const updateSubjectReport = async (req: AuthRequest, res: Response) => {
  const { id } = req.params
  try {
    if (!["PRINCIPAL", "SCHOOL_ADMIN", "TEACHER"].includes(req.user?.role || "")) {
      return res.status(403).json({ message: "Access denied" })
    }

    const data = updateSubjectReportSchema.parse(req.body)

    const existingSubjectReport = await prisma.subjectReport.findFirst({
      where: {
        id,
        reportCard: getTenantFilter(req.user),
      },
    })

    if (!existingSubjectReport) {
      return res.status(404).json({ message: "Subject report not found" })
    }

    // Calculate new percentage and grade if marks are updated
    const updateData: any = { ...data }
    if (data.totalMarks && data.obtainedMarks) {
      updateData.percentage = (data.obtainedMarks / data.totalMarks) * 100
      updateData.grade = getGradeFromPercentage(updateData.percentage)
    }

    const subjectReport = await prisma.subjectReport.update({
      where: { id },
      data: updateData,
      include: {
        subject: { select: { name: true, code: true } },
        reportCard: {
          select: {
            title: true,
            student: { select: { name: true, surname: true } },
          },
        },
      },
    })

    logger.info("Subject report updated", { userId: req.user?.id, subjectReportId: id })
    res.status(200).json({
      message: "Subject report updated successfully",
      subjectReport,
    })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ message: "Validation error", errors: error.errors })
    }
    handleError(res, error, "Failed to update subject report")
  }
}

export const deleteSubjectReport = async (req: AuthRequest, res: Response) => {
  const { id } = req.params
  try {
    if (!["PRINCIPAL", "SCHOOL_ADMIN", "TEACHER"].includes(req.user?.role || "")) {
      return res.status(403).json({ message: "Access denied" })
    }

    const subjectReport = await prisma.subjectReport.findFirst({
      where: {
        id,
        reportCard: getTenantFilter(req.user),
      },
    })

    if (!subjectReport) {
      return res.status(404).json({ message: "Subject report not found" })
    }

    await prisma.subjectReport.delete({
      where: { id },
    })

    logger.info("Subject report deleted", { userId: req.user?.id, subjectReportId: id })
    res.status(200).json({ message: "Subject report deleted successfully" })
  } catch (error) {
    handleError(res, error, "Failed to delete subject report")
  }
}

export const generateReportCards = async (req: AuthRequest, res: Response) => {
  try {
    if (!["PRINCIPAL", "SCHOOL_ADMIN"].includes(req.user?.role || "")) {
      return res.status(403).json({ message: "Access denied" })
    }

    const data = generateReportCardSchema.parse(req.body)

    // Verify all students exist and belong to the school
    const students = await prisma.student.findMany({
      where: {
        id: { in: data.studentIds },
        schoolId: data.schoolId,
      },
      include: {
        class: { select: { name: true } },
        grade: { select: { name: true } },
      },
    })

    if (students.length !== data.studentIds.length) {
      return res.status(400).json({ message: "Some students not found" })
    }

    const reportCards = []

    for (const student of students) {
      // Check if report card already exists
      const existingReportCard = await prisma.reportCard.findFirst({
        where: {
          studentId: student.id,
          academicYearId: data.academicYearId,
          termId: data.termId,
        },
      })

      if (existingReportCard) {
        continue // Skip if already exists
      }

      // Get student's results for the period
      const results = await prisma.result.findMany({
        where: {
          studentId: student.id,
          OR: [
            {
              assignment: {
                createdAt: {
                  gte: new Date(new Date().getFullYear(), 0, 1), // Start of current year
                  lte: new Date(),
                },
              },
            },
            {
              exam: {
                createdAt: {
                  gte: new Date(new Date().getFullYear(), 0, 1),
                  lte: new Date(),
                },
              },
            },
          ],
        },
        include: {
          assignment: {
            include: {
              subject: { select: { id: true, name: true } },
            },
          },
          exam: {
            include: {
              examQuestions: {
                include: {
                  subject: { select: { id: true, name: true } },
                },
              },
            },
          },
        },
      })

      // Group results by subject
      const subjectResults = new Map<string, SubjectResultData>()

      for (const result of results) {
        let subjectId: string | null = null
        let subjectName: string | null = null

        if (result.assignment?.subject) {
          subjectId = result.assignment.subject.id
          subjectName = result.assignment.subject.name
        } else if (result.exam?.examQuestions?.[0]?.subject) {
          subjectId = result.exam.examQuestions[0].subject.id
          subjectName = result.exam.examQuestions[0].subject.name
        }

        if (subjectId && subjectName) {
          const existing = subjectResults.get(subjectId) || {
            totalMarks: 0,
            obtainedMarks: 0,
            count: 0,
          }

          subjectResults.set(subjectId, {
            totalMarks: existing.totalMarks + (result.maxScore || 100),
            obtainedMarks: existing.obtainedMarks + (result.score || 0),
            count: existing.count + 1,
          })
        }
      }

      // Calculate overall statistics
      let totalMarks = 0
      let obtainedMarks = 0

      for (const [subjectId, subjectData] of subjectResults) {
        totalMarks += subjectData.totalMarks
        obtainedMarks += subjectData.obtainedMarks
      }

      const percentage = totalMarks > 0 ? (obtainedMarks / totalMarks) * 100 : 0
      const overallGrade = getGradeFromPercentage(percentage)
      const overallGPA = getGPAFromPercentage(percentage)

      // Create report card
      const reportCard = await prisma.reportCard.create({
        data: {
          title: `Report Card - ${student.name} ${student.surname}`,
          studentId: student.id,
          academicYearId: data.academicYearId,
          termId: data.termId,
          schoolId: data.schoolId,
          overallGrade,
          overallGPA,
          totalMarks,
          obtainedMarks,
          percentage,
          status: "GENERATED",
        },
      })

      // Create subject reports
      for (const [subjectId, subjectData] of subjectResults) {
        const subjectPercentage = (subjectData.obtainedMarks / subjectData.totalMarks) * 100
        const subjectGrade = getGradeFromPercentage(subjectPercentage)

        await prisma.subjectReport.create({
          data: {
            reportCardId: reportCard.id,
            subjectId,
            totalMarks: subjectData.totalMarks,
            obtainedMarks: subjectData.obtainedMarks,
            percentage: subjectPercentage,
            grade: subjectGrade,
          },
        })
      }

      reportCards.push(reportCard)
    }

    logger.info("Report cards generated", {
      userId: req.user?.id,
      count: reportCards.length,
      academicYearId: data.academicYearId,
    })

    res.status(201).json({
      message: `${reportCards.length} report cards generated successfully`,
      reportCards,
    })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ message: "Validation error", errors: error.errors })
    }
    handleError(res, error, "Failed to generate report cards")
  }
}

export const getStudentReportCards = async (req: AuthRequest, res: Response) => {
  const { studentId } = req.params
  try {
    // Role-based access control
    if (req.user?.role === "PARENT") {
      const parent = await prisma.parent.findFirst({
        where: {
          id: req.user.id,
          children: { some: { id: studentId } },
        },
      })

      if (!parent) {
        return res.status(403).json({ message: "Access denied" })
      }
    } else if (req.user?.role === "TEACHER") {
      const student = await prisma.student.findFirst({
        where: {
          id: studentId,
          OR: [{ class: { supervisorId: req.user.id } }, { class: { lessons: { some: { teacherId: req.user.id } } } }],
        },
      })

      if (!student) {
        return res.status(403).json({ message: "Access denied" })
      }
    }

    const reportCards = await prisma.reportCard.findMany({
      where: {
        studentId,
        status: { in: ["PUBLISHED", "APPROVED"] },
        ...getTenantFilter(req.user),
      },
      include: {
        academicYear: { select: { name: true } },
        term: { select: { name: true } },
        _count: {
          select: {
            subjectReports: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
    })

    logger.info("Student report cards retrieved", {
      userId: req.user?.id,
      studentId,
      count: reportCards.length,
    })

    res.status(200).json({
      message: "Student report cards retrieved successfully",
      reportCards,
    })
  } catch (error) {
    handleError(res, error, "Failed to retrieve student report cards")
  }
}

// Helper functions
const getGradeFromPercentage = (percentage: number): string => {
  if (percentage >= 90) return "A+"
  if (percentage >= 80) return "A"
  if (percentage >= 70) return "B+"
  if (percentage >= 60) return "B"
  if (percentage >= 50) return "C+"
  if (percentage >= 40) return "C"
  if (percentage >= 30) return "D"
  return "F"
}

const getGPAFromPercentage = (percentage: number): number => {
  if (percentage >= 90) return 4.0
  if (percentage >= 80) return 3.5
  if (percentage >= 70) return 3.0
  if (percentage >= 60) return 2.5
  if (percentage >= 50) return 2.0
  if (percentage >= 40) return 1.5
  if (percentage >= 30) return 1.0
  return 0.0
}
