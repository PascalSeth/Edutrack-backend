import type { Response } from "express"
import { z } from "zod"
import { prisma, type AuthRequest, handleError, logger, getTenantFilter } from "../utils/setup"

// Validation Schemas
const createSubjectSchema = z.object({
  name: z.string().min(1, "Name is required"),
  code: z.string().optional(),
  description: z.string().optional(),
  schoolId: z.string().uuid("Invalid school ID"),
})

const updateSubjectSchema = z.object({
  name: z.string().min(1).optional(),
  code: z.string().optional(),
  description: z.string().optional(),
})

export const getSubjects = async (req: AuthRequest, res: Response) => {
  try {
    const page = Number.parseInt(req.query.page as string) || 1
    const limit = Number.parseInt(req.query.limit as string) || 10
    const skip = (page - 1) * limit
    const filter = getTenantFilter(req.user)

    const [subjects, total] = await Promise.all([
      prisma.subject.findMany({
        where: filter,
        skip,
        take: limit,
        include: {
          teachers: {
            include: {
              user: { select: { name: true, surname: true } },
            },
          },
          _count: {
            select: {
              lessons: true,
              assignments: true,
              examQuestions: true,
            },
          },
        },
        orderBy: { name: "asc" },
      }),
      prisma.subject.count({ where: filter }),
    ])

    logger.info("Subjects retrieved", { userId: req.user?.id, page, limit, total })
    res.status(200).json({
      message: "Subjects retrieved successfully",
      subjects,
      pagination: { page, limit, total, pages: Math.ceil(total / limit) },
    })
  } catch (error) {
    handleError(res, error, "Failed to retrieve subjects")
  }
}

export const getSubjectById = async (req: AuthRequest, res: Response) => {
  const { id } = req.params
  try {
    const filter = getTenantFilter(req.user)

    const subject = await prisma.subject.findFirst({
      where: { id, ...filter },
      include: {
        teachers: {
          include: {
            user: { select: { name: true, surname: true, email: true } },
          },
        },
        lessons: {
          include: {
            class: { select: { name: true } },
            teacher: {
              include: {
                user: { select: { name: true, surname: true } },
              },
            },
          },
        },
        assignments: {
          select: {
            id: true,
            title: true,
            dueDate: true,
            class: { select: { name: true } },
          },
          orderBy: { dueDate: "desc" },
          take: 5,
        },
        _count: {
          select: {
            lessons: true,
            assignments: true,
            examQuestions: true,
          },
        },
      },
    })

    if (!subject) {
      logger.warn("Subject not found", { userId: req.user?.id, subjectId: id })
      return res.status(404).json({ message: "Subject not found" })
    }

    logger.info("Subject retrieved", { userId: req.user?.id, subjectId: id })
    res.status(200).json({
      message: "Subject retrieved successfully",
      subject,
    })
  } catch (error) {
    handleError(res, error, "Failed to retrieve subject")
  }
}

export const createSubject = async (req: AuthRequest, res: Response) => {
  try {
    const data = createSubjectSchema.parse(req.body)

    // Only principals and school admins can create subjects
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

    // Check if subject with same name already exists in school
    const existingSubject = await prisma.subject.findFirst({
      where: {
        name: data.name,
        schoolId: data.schoolId,
      },
    })

    if (existingSubject) {
      return res.status(409).json({ message: "Subject with this name already exists in the school" })
    }

    const subject = await prisma.subject.create({
      data: {
        name: data.name,
        code: data.code,
        description: data.description,
        schoolId: data.schoolId,
      },
    })

    logger.info("Subject created", {
      userId: req.user?.id,
      subjectId: subject.id,
      schoolId: data.schoolId,
    })

    res.status(201).json({
      message: "Subject created successfully",
      subject,
    })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ message: "Invalid input", errors: error.errors })
    }
    handleError(res, error, "Failed to create subject")
  }
}

export const updateSubject = async (req: AuthRequest, res: Response) => {
  const { id } = req.params
  try {
    const data = updateSubjectSchema.parse(req.body)

    // Only principals and school admins can update subjects
    if (!["PRINCIPAL", "SCHOOL_ADMIN", "SUPER_ADMIN"].includes(req.user?.role || "")) {
      return res.status(403).json({ message: "Access denied" })
    }

    const filter = getTenantFilter(req.user)
    const existingSubject = await prisma.subject.findFirst({
      where: { id, ...filter },
    })

    if (!existingSubject) {
      return res.status(404).json({ message: "Subject not found or access denied" })
    }

    // Check for name conflicts if name is being updated
    if (data.name && data.name !== existingSubject.name) {
      const conflictingSubject = await prisma.subject.findFirst({
        where: {
          name: data.name,
          schoolId: existingSubject.schoolId,
          id: { not: id },
        },
      })

      if (conflictingSubject) {
        return res.status(409).json({ message: "Subject with this name already exists in the school" })
      }
    }

    const subject = await prisma.subject.update({
      where: { id },
      data: {
        ...(data.name && { name: data.name }),
        ...(data.code !== undefined && { code: data.code }),
        ...(data.description !== undefined && { description: data.description }),
      },
    })

    logger.info("Subject updated", { userId: req.user?.id, subjectId: id })
    res.status(200).json({
      message: "Subject updated successfully",
      subject,
    })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ message: "Invalid input", errors: error.errors })
    }
    handleError(res, error, "Failed to update subject")
  }
}

export const deleteSubject = async (req: AuthRequest, res: Response) => {
  const { id } = req.params
  try {
    // Only principals and school admins can delete subjects
    if (!["PRINCIPAL", "SCHOOL_ADMIN", "SUPER_ADMIN"].includes(req.user?.role || "")) {
      return res.status(403).json({ message: "Access denied" })
    }

    const filter = getTenantFilter(req.user)
    const subject = await prisma.subject.findFirst({
      where: { id, ...filter },
      include: {
        _count: {
          select: {
            lessons: true,
            assignments: true,
            examQuestions: true,
          },
        },
      },
    })

    if (!subject) {
      return res.status(404).json({ message: "Subject not found or access denied" })
    }

    // Check if subject has associated data
    const hasAssociatedData =
      subject._count.lessons > 0 || subject._count.assignments > 0 || subject._count.examQuestions > 0

    if (hasAssociatedData) {
      return res.status(400).json({
        message: "Cannot delete subject with associated lessons, assignments, or exam questions",
      })
    }

    await prisma.subject.delete({ where: { id } })

    logger.info("Subject deleted", { userId: req.user?.id, subjectId: id })
    res.status(200).json({ message: "Subject deleted successfully" })
  } catch (error) {
    handleError(res, error, "Failed to delete subject")
  }
}

export const assignTeacherToSubject = async (req: AuthRequest, res: Response) => {
  const { id } = req.params
  const { teacherId } = req.body

  try {
    // Only principals and school admins can assign teachers
    if (!["PRINCIPAL", "SCHOOL_ADMIN", "SUPER_ADMIN"].includes(req.user?.role || "")) {
      return res.status(403).json({ message: "Access denied" })
    }

    if (!teacherId) {
      return res.status(400).json({ message: "Teacher ID is required" })
    }

    const filter = getTenantFilter(req.user)

    // Verify subject and teacher exist and belong to same school
    const [subject, teacher] = await Promise.all([
      prisma.subject.findFirst({
        where: { id, ...filter },
      }),
      prisma.teacher.findFirst({
        where: {
          id: teacherId,
          ...filter,
        },
      }),
    ])

    if (!subject) {
      return res.status(404).json({ message: "Subject not found or access denied" })
    }
    if (!teacher) {
      return res.status(404).json({ message: "Teacher not found or access denied" })
    }

    // Check if teacher is already assigned to this subject
    const existingAssignment = await prisma.subject.findFirst({
      where: {
        id,
        teachers: {
          some: { id: teacherId },
        },
      },
    })

    if (existingAssignment) {
      return res.status(409).json({ message: "Teacher is already assigned to this subject" })
    }

    // Assign teacher to subject
    await prisma.subject.update({
      where: { id },
      data: {
        teachers: {
          connect: { id: teacherId },
        },
      },
    })

    logger.info("Teacher assigned to subject", {
      userId: req.user?.id,
      subjectId: id,
      teacherId: teacherId,
    })

    res.status(200).json({
      message: "Teacher assigned to subject successfully",
    })
  } catch (error) {
    handleError(res, error, "Failed to assign teacher to subject")
  }
}

export const removeTeacherFromSubject = async (req: AuthRequest, res: Response) => {
  const { id } = req.params
  const { teacherId } = req.body

  try {
    // Only principals and school admins can remove teachers
    if (!["PRINCIPAL", "SCHOOL_ADMIN", "SUPER_ADMIN"].includes(req.user?.role || "")) {
      return res.status(403).json({ message: "Access denied" })
    }

    if (!teacherId) {
      return res.status(400).json({ message: "Teacher ID is required" })
    }

    const filter = getTenantFilter(req.user)
    const subject = await prisma.subject.findFirst({
      where: { id, ...filter },
    })

    if (!subject) {
      return res.status(404).json({ message: "Subject not found or access denied" })
    }

    // Remove teacher from subject
    await prisma.subject.update({
      where: { id },
      data: {
        teachers: {
          disconnect: { id: teacherId },
        },
      },
    })

    logger.info("Teacher removed from subject", {
      userId: req.user?.id,
      subjectId: id,
      teacherId: teacherId,
    })

    res.status(200).json({
      message: "Teacher removed from subject successfully",
    })
  } catch (error) {
    handleError(res, error, "Failed to remove teacher from subject")
  }
}
