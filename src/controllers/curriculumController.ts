import type { Response } from "express"
import { z } from "zod"
import { prisma, type AuthRequest, handleError, logger, getTenantFilter } from "../utils/setup"

// Validation Schemas
const createCurriculumSchema = z.object({
  name: z.string().min(1, "Name is required"),
  description: z.string().optional(),
  version: z.string().default("1.0"),
  schoolId: z.string().uuid("Invalid school ID"),
})

const updateCurriculumSchema = z.object({
  name: z.string().min(1).optional(),
  description: z.string().optional(),
  version: z.string().optional(),
  isActive: z.boolean().optional(),
})

const createCurriculumSubjectSchema = z.object({
  curriculumId: z.string().uuid("Invalid curriculum ID"),
  subjectId: z.string().uuid("Invalid subject ID"),
  gradeId: z.string().uuid("Invalid grade ID"),
  hoursPerWeek: z.number().int().min(0).optional(),
  isCore: z.boolean().default(true),
  prerequisites: z.array(z.string().uuid()).optional(),
})

const createLearningObjectiveSchema = z.object({
  curriculumSubjectId: z.string().uuid("Invalid curriculum subject ID"),
  title: z.string().min(1, "Title is required"),
  description: z.string().min(1, "Description is required"),
  objectiveType: z.enum(["KNOWLEDGE", "SKILL", "ATTITUDE", "COMPETENCY"]),
  bloomsLevel: z.enum(["REMEMBER", "UNDERSTAND", "APPLY", "ANALYZE", "EVALUATE", "CREATE"]),
})

const updateProgressSchema = z.object({
  studentId: z.string().uuid("Invalid student ID"),
  learningObjectiveId: z.string().uuid("Invalid learning objective ID"),
  status: z.enum(["NOT_STARTED", "IN_PROGRESS", "COMPLETED", "MASTERED"]),
  masteryLevel: z.enum(["BEGINNER", "DEVELOPING", "PROFICIENT", "ADVANCED", "EXPERT"]),
  notes: z.string().optional(),
  assessmentScore: z.number().min(0).max(100).optional(),
})

export const getCurriculums = async (req: AuthRequest, res: Response) => {
  try {
    const page = Number.parseInt(req.query.page as string) || 1
    const limit = Number.parseInt(req.query.limit as string) || 10
    const skip = (page - 1) * limit
    const filter = getTenantFilter(req.user)

    const [curriculums, total] = await Promise.all([
      prisma.curriculum.findMany({
        where: filter,
        skip,
        take: limit,
        include: {
          _count: {
            select: {
              curriculumSubjects: true,
            },
          },
        },
        orderBy: { createdAt: "desc" },
      }),
      prisma.curriculum.count({ where: filter }),
    ])

    logger.info("Curriculums retrieved", { userId: req.user?.id, page, limit, total })
    res.status(200).json({
      message: "Curriculums retrieved successfully",
      curriculums,
      pagination: { page, limit, total, pages: Math.ceil(total / limit) },
    })
  } catch (error) {
    handleError(res, error, "Failed to retrieve curriculums")
  }
}

export const getCurriculumById = async (req: AuthRequest, res: Response) => {
  const { id } = req.params
  try {
    const filter = getTenantFilter(req.user)

    const curriculum = await prisma.curriculum.findFirst({
      where: { id, ...filter },
      include: {
        curriculumSubjects: {
          include: {
            subject: { select: { name: true, code: true } },
            grade: { select: { name: true, level: true } },
            learningObjectives: {
              include: {
                _count: {
                  select: {
                    studentProgress: true,
                  },
                },
              },
              orderBy: { createdAt: "asc" },
            },
          },
          orderBy: [{ grade: { level: "asc" } }, { subject: { name: "asc" } }],
        },
        _count: {
          select: {
            curriculumSubjects: true,
          },
        },
      },
    })

    if (!curriculum) {
      logger.warn("Curriculum not found", { userId: req.user?.id, curriculumId: id })
      return res.status(404).json({ message: "Curriculum not found" })
    }

    logger.info("Curriculum retrieved", { userId: req.user?.id, curriculumId: id })
    res.status(200).json({
      message: "Curriculum retrieved successfully",
      curriculum,
    })
  } catch (error) {
    handleError(res, error, "Failed to retrieve curriculum")
  }
}

export const createCurriculum = async (req: AuthRequest, res: Response) => {
  try {
    const data = createCurriculumSchema.parse(req.body)

    // Only principals and school admins can create curriculums
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

    // Check if curriculum with same name and version exists
    const existingCurriculum = await prisma.curriculum.findFirst({
      where: {
        name: data.name,
        version: data.version,
        schoolId: data.schoolId,
      },
    })

    if (existingCurriculum) {
      return res.status(409).json({ message: "Curriculum with this name and version already exists" })
    }

    const curriculum = await prisma.curriculum.create({
      data: {
        name: data.name,
        description: data.description,
        version: data.version,
        schoolId: data.schoolId,
      },
    })

    logger.info("Curriculum created", {
      userId: req.user?.id,
      curriculumId: curriculum.id,
      schoolId: data.schoolId,
    })

    res.status(201).json({
      message: "Curriculum created successfully",
      curriculum,
    })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ message: "Invalid input", errors: error.errors })
    }
    handleError(res, error, "Failed to create curriculum")
  }
}

export const updateCurriculum = async (req: AuthRequest, res: Response) => {
  const { id } = req.params
  try {
    const data = updateCurriculumSchema.parse(req.body)

    // Only principals and school admins can update curriculums
    if (!["PRINCIPAL", "SCHOOL_ADMIN", "SUPER_ADMIN"].includes(req.user?.role || "")) {
      return res.status(403).json({ message: "Access denied" })
    }

    const filter = getTenantFilter(req.user)
    const existingCurriculum = await prisma.curriculum.findFirst({
      where: { id, ...filter },
    })

    if (!existingCurriculum) {
      return res.status(404).json({ message: "Curriculum not found or access denied" })
    }

    // Check for name and version conflicts if being updated
    if (data.name || data.version) {
      const conflictingCurriculum = await prisma.curriculum.findFirst({
        where: {
          name: data.name || existingCurriculum.name,
          version: data.version || existingCurriculum.version,
          schoolId: existingCurriculum.schoolId,
          id: { not: id },
        },
      })

      if (conflictingCurriculum) {
        return res.status(409).json({ message: "Curriculum with this name and version already exists" })
      }
    }

    const curriculum = await prisma.curriculum.update({
      where: { id },
      data: {
        ...(data.name && { name: data.name }),
        ...(data.description !== undefined && { description: data.description }),
        ...(data.version && { version: data.version }),
        ...(data.isActive !== undefined && { isActive: data.isActive }),
      },
    })

    logger.info("Curriculum updated", { userId: req.user?.id, curriculumId: id })
    res.status(200).json({
      message: "Curriculum updated successfully",
      curriculum,
    })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ message: "Invalid input", errors: error.errors })
    }
    handleError(res, error, "Failed to update curriculum")
  }
}

export const deleteCurriculum = async (req: AuthRequest, res: Response) => {
  const { id } = req.params
  try {
    // Only principals and school admins can delete curriculums
    if (!["PRINCIPAL", "SCHOOL_ADMIN", "SUPER_ADMIN"].includes(req.user?.role || "")) {
      return res.status(403).json({ message: "Access denied" })
    }

    const filter = getTenantFilter(req.user)
    const curriculum = await prisma.curriculum.findFirst({
      where: { id, ...filter },
      include: {
        _count: {
          select: {
            curriculumSubjects: true,
          },
        },
      },
    })

    if (!curriculum) {
      return res.status(404).json({ message: "Curriculum not found or access denied" })
    }

    // Check if curriculum has subjects
    if (curriculum._count.curriculumSubjects > 0) {
      return res.status(400).json({
        message: "Cannot delete curriculum with existing subjects. Please remove all subjects first.",
      })
    }

    await prisma.curriculum.delete({ where: { id } })

    logger.info("Curriculum deleted", { userId: req.user?.id, curriculumId: id })
    res.status(200).json({ message: "Curriculum deleted successfully" })
  } catch (error) {
    handleError(res, error, "Failed to delete curriculum")
  }
}

// Curriculum Subject Management
export const createCurriculumSubject = async (req: AuthRequest, res: Response) => {
  try {
    const data = createCurriculumSubjectSchema.parse(req.body)

    // Only principals and school admins can create curriculum subjects
    if (!["PRINCIPAL", "SCHOOL_ADMIN", "SUPER_ADMIN"].includes(req.user?.role || "")) {
      return res.status(403).json({ message: "Access denied" })
    }

    // Verify curriculum, subject, and grade
    const [curriculum, subject, grade] = await Promise.all([
      prisma.curriculum.findFirst({
        where: {
          id: data.curriculumId,
          ...getTenantFilter(req.user),
        },
      }),
      prisma.subject.findFirst({
        where: {
          id: data.subjectId,
          ...getTenantFilter(req.user),
        },
      }),
      prisma.grade.findFirst({
        where: {
          id: data.gradeId,
          ...getTenantFilter(req.user),
        },
      }),
    ])

    if (!curriculum) {
      return res.status(404).json({ message: "Curriculum not found or access denied" })
    }
    if (!subject) {
      return res.status(404).json({ message: "Subject not found or access denied" })
    }
    if (!grade) {
      return res.status(404).json({ message: "Grade not found or access denied" })
    }

    // Check if curriculum subject already exists
    const existingCurriculumSubject = await prisma.curriculumSubject.findFirst({
      where: {
        curriculumId: data.curriculumId,
        subjectId: data.subjectId,
        gradeId: data.gradeId,
      },
    })

    if (existingCurriculumSubject) {
      return res.status(409).json({ message: "Subject already exists in this curriculum for this grade" })
    }

    const curriculumSubject = await prisma.curriculumSubject.create({
      data: {
        curriculumId: data.curriculumId,
        subjectId: data.subjectId,
        gradeId: data.gradeId,
        hoursPerWeek: data.hoursPerWeek,
        isCore: data.isCore,
        prerequisites: data.prerequisites || [],
      },
      include: {
        subject: { select: { name: true, code: true } },
        grade: { select: { name: true, level: true } },
      },
    })

    logger.info("Curriculum subject created", {
      userId: req.user?.id,
      curriculumSubjectId: curriculumSubject.id,
      curriculumId: data.curriculumId,
    })

    res.status(201).json({
      message: "Curriculum subject created successfully",
      curriculumSubject,
    })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ message: "Invalid input", errors: error.errors })
    }
    handleError(res, error, "Failed to create curriculum subject")
  }
}

// Learning Objective Management
export const createLearningObjective = async (req: AuthRequest, res: Response) => {
  try {
    const data = createLearningObjectiveSchema.parse(req.body)

    // Only principals, school admins, and teachers can create learning objectives
    if (!["PRINCIPAL", "SCHOOL_ADMIN", "TEACHER", "SUPER_ADMIN"].includes(req.user?.role || "")) {
      return res.status(403).json({ message: "Access denied" })
    }

    // Verify curriculum subject exists and user has access
    const curriculumSubject = await prisma.curriculumSubject.findFirst({
      where: {
        id: data.curriculumSubjectId,
        curriculum: getTenantFilter(req.user),
      },
      include: {
        curriculum: { select: { name: true } },
        subject: { select: { name: true } },
        grade: { select: { name: true } },
      },
    })

    if (!curriculumSubject) {
      return res.status(404).json({ message: "Curriculum subject not found or access denied" })
    }

    const learningObjective = await prisma.learningObjective.create({
      data: {
        curriculumSubjectId: data.curriculumSubjectId,
        title: data.title,
        description: data.description,
        objectiveType: data.objectiveType,
        bloomsLevel: data.bloomsLevel,
      },
    })

    logger.info("Learning objective created", {
      userId: req.user?.id,
      learningObjectiveId: learningObjective.id,
      curriculumSubjectId: data.curriculumSubjectId,
    })

    res.status(201).json({
      message: "Learning objective created successfully",
      learningObjective: {
        ...learningObjective,
        curriculumSubject,
      },
    })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ message: "Invalid input", errors: error.errors })
    }
    handleError(res, error, "Failed to create learning objective")
  }
}

export const getLearningObjectives = async (req: AuthRequest, res: Response) => {
  const { curriculumSubjectId } = req.params
  try {
    // Verify curriculum subject exists and user has access
    const curriculumSubject = await prisma.curriculumSubject.findFirst({
      where: {
        id: curriculumSubjectId,
        curriculum: getTenantFilter(req.user),
      },
      include: {
        curriculum: { select: { name: true } },
        subject: { select: { name: true } },
        grade: { select: { name: true } },
      },
    })

    if (!curriculumSubject) {
      return res.status(404).json({ message: "Curriculum subject not found or access denied" })
    }

    const learningObjectives = await prisma.learningObjective.findMany({
      where: { curriculumSubjectId },
      include: {
        _count: {
          select: {
            studentProgress: true,
          },
        },
      },
      orderBy: { createdAt: "asc" },
    })

    logger.info("Learning objectives retrieved", { userId: req.user?.id, curriculumSubjectId })
    res.status(200).json({
      message: "Learning objectives retrieved successfully",
      curriculumSubject,
      learningObjectives,
    })
  } catch (error) {
    handleError(res, error, "Failed to retrieve learning objectives")
  }
}

// Student Progress Management
export const updateStudentProgress = async (req: AuthRequest, res: Response) => {
  try {
    const data = updateProgressSchema.parse(req.body)

    // Only teachers, principals, and school admins can update progress
    if (!["TEACHER", "PRINCIPAL", "SCHOOL_ADMIN", "SUPER_ADMIN"].includes(req.user?.role || "")) {
      return res.status(403).json({ message: "Access denied" })
    }

    // Verify student and learning objective exist and user has access
    const [student, learningObjective] = await Promise.all([
      prisma.student.findFirst({
        where: {
          id: data.studentId,
          ...getTenantFilter(req.user),
        },
      }),
      prisma.learningObjective.findFirst({
        where: {
          id: data.learningObjectiveId,
          curriculumSubject: {
            curriculum: getTenantFilter(req.user),
          },
        },
        include: {
          curriculumSubject: {
            include: {
              subject: { select: { name: true } },
              grade: { select: { name: true } },
            },
          },
        },
      }),
    ])

    if (!student) {
      return res.status(404).json({ message: "Student not found or access denied" })
    }
    if (!learningObjective) {
      return res.status(404).json({ message: "Learning objective not found or access denied" })
    }

    const progress = await prisma.curriculumProgress.upsert({
      where: {
        studentId_learningObjectiveId: {
          studentId: data.studentId,
          learningObjectiveId: data.learningObjectiveId,
        },
      },
      update: {
        status: data.status,
        masteryLevel: data.masteryLevel,
        notes: data.notes,
        assessmentScore: data.assessmentScore,
        assessmentDate: data.assessmentScore ? new Date() : undefined,
        completedAt: data.status === "COMPLETED" || data.status === "MASTERED" ? new Date() : undefined,
      },
      create: {
        studentId: data.studentId,
        learningObjectiveId: data.learningObjectiveId,
        status: data.status,
        masteryLevel: data.masteryLevel,
        notes: data.notes,
        assessmentScore: data.assessmentScore,
        assessmentDate: data.assessmentScore ? new Date() : undefined,
        completedAt: data.status === "COMPLETED" || data.status === "MASTERED" ? new Date() : undefined,
      },
      include: {
        student: {
          select: {
            name: true,
            surname: true,
            registrationNumber: true,
          },
        },
        learningObjective: {
          select: {
            title: true,
            description: true,
            objectiveType: true,
            bloomsLevel: true,
          },
        },
      },
    })

    logger.info("Student progress updated", {
      userId: req.user?.id,
      studentId: data.studentId,
      learningObjectiveId: data.learningObjectiveId,
    })

    res.status(200).json({
      message: "Student progress updated successfully",
      progress,
    })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ message: "Invalid input", errors: error.errors })
    }
    handleError(res, error, "Failed to update student progress")
  }
}

export const getStudentProgress = async (req: AuthRequest, res: Response) => {
  const { studentId } = req.params
  const { curriculumId } = req.query

  try {
    const filter = getTenantFilter(req.user)

    // Verify student exists and user has access
    const student = await prisma.student.findFirst({
      where: {
        id: studentId,
        ...filter,
      },
      include: {
        class: { select: { name: true } },
        grade: { select: { name: true, level: true } },
      },
    })

    if (!student) {
      return res.status(404).json({ message: "Student not found or access denied" })
    }

    // Build progress query
    const progressWhere: any = {
      studentId,
      learningObjective: {
        curriculumSubject: {
          curriculum: {
            ...filter,
            ...(curriculumId && { id: curriculumId as string }),
          },
        },
      },
    }

    const progress = await prisma.curriculumProgress.findMany({
      where: progressWhere,
      include: {
        learningObjective: {
          include: {
            curriculumSubject: {
              include: {
                curriculum: { select: { name: true, version: true } },
                subject: { select: { name: true, code: true } },
                grade: { select: { name: true } },
              },
            },
          },
        },
      },
      orderBy: [
        { learningObjective: { curriculumSubject: { subject: { name: "asc" } } } },
        { learningObjective: { createdAt: "asc" } },
      ],
    })

    // Calculate progress statistics
    const stats = {
      total: progress.length,
      notStarted: progress.filter((p) => p.status === "NOT_STARTED").length,
      inProgress: progress.filter((p) => p.status === "IN_PROGRESS").length,
      completed: progress.filter((p) => p.status === "COMPLETED").length,
      mastered: progress.filter((p) => p.status === "MASTERED").length,
      averageScore:
        progress.filter((p) => p.assessmentScore !== null).reduce((sum, p) => sum + (p.assessmentScore || 0), 0) /
          progress.filter((p) => p.assessmentScore !== null).length || 0,
    }

    logger.info("Student progress retrieved", { userId: req.user?.id, studentId })
    res.status(200).json({
      message: "Student progress retrieved successfully",
      student: {
        id: student.id,
        name: `${student.name} ${student.surname}`,
        registrationNumber: student.registrationNumber,
        class: student.class?.name,
        grade: student.grade?.name,
      },
      progress,
      statistics: stats,
    })
  } catch (error) {
    handleError(res, error, "Failed to retrieve student progress")
  }
}

export const getCurriculumProgress = async (req: AuthRequest, res: Response) => {
  const { curriculumId } = req.params
  const { gradeId, subjectId } = req.query

  try {
    const filter = getTenantFilter(req.user)

    // Verify curriculum exists and user has access
    const curriculum = await prisma.curriculum.findFirst({
      where: {
        id: curriculumId,
        ...filter,
      },
    })

    if (!curriculum) {
      return res.status(404).json({ message: "Curriculum not found or access denied" })
    }

    // Build progress query
    const progressWhere: any = {
      learningObjective: {
        curriculumSubject: {
          curriculumId,
          ...(gradeId && { gradeId: gradeId as string }),
          ...(subjectId && { subjectId: subjectId as string }),
        },
      },
      student: filter,
    }

    const progress = await prisma.curriculumProgress.findMany({
      where: progressWhere,
      include: {
        student: {
          select: {
            id: true,
            name: true,
            surname: true,
            registrationNumber: true,
            class: { select: { name: true } },
            grade: { select: { name: true } },
          },
        },
        learningObjective: {
          include: {
            curriculumSubject: {
              include: {
                subject: { select: { name: true, code: true } },
                grade: { select: { name: true } },
              },
            },
          },
        },
      },
      orderBy: [
        { student: { name: "asc" } },
        { learningObjective: { curriculumSubject: { subject: { name: "asc" } } } },
      ],
    })

    // Group progress by student
    const studentProgress = progress.reduce((acc, p) => {
      const studentId = p.student.id
      if (!acc[studentId]) {
        acc[studentId] = {
          student: p.student,
          objectives: [],
          stats: {
            total: 0,
            notStarted: 0,
            inProgress: 0,
            completed: 0,
            mastered: 0,
            averageScore: 0,
          },
        }
      }
      acc[studentId].objectives.push(p)
      return acc
    }, {} as any)

    // Calculate statistics for each student
    Object.values(studentProgress).forEach((sp: any) => {
      sp.stats.total = sp.objectives.length
      sp.stats.notStarted = sp.objectives.filter((o: any) => o.status === "NOT_STARTED").length
      sp.stats.inProgress = sp.objectives.filter((o: any) => o.status === "IN_PROGRESS").length
      sp.stats.completed = sp.objectives.filter((o: any) => o.status === "COMPLETED").length
      sp.stats.mastered = sp.objectives.filter((o: any) => o.status === "MASTERED").length
      const scoresWithValues = sp.objectives.filter((o: any) => o.assessmentScore !== null)
      sp.stats.averageScore =
        scoresWithValues.length > 0
          ? scoresWithValues.reduce((sum: number, o: any) => sum + o.assessmentScore, 0) / scoresWithValues.length
          : 0
    })

    logger.info("Curriculum progress retrieved", { userId: req.user?.id, curriculumId })
    res.status(200).json({
      message: "Curriculum progress retrieved successfully",
      curriculum: {
        id: curriculum.id,
        name: curriculum.name,
        version: curriculum.version,
      },
      studentProgress: Object.values(studentProgress),
    })
  } catch (error) {
    handleError(res, error, "Failed to retrieve curriculum progress")
  }
}
