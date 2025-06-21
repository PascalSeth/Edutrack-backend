import type { Response } from "express"
import { z } from "zod"
import { prisma, type AuthRequest, handleError, logger, getTenantFilter } from "../utils/setup"

// Parent-specific endpoints for multi-school children management
export const getParentChildren = async (req: AuthRequest, res: Response) => {
  try {
    if (req.user?.role !== "PARENT") {
      return res.status(403).json({ message: "Access denied" })
    }

    const children = await prisma.student.findMany({
      where: { parentId: req.user.id },
      include: {
        school: {
          select: {
            id: true,
            name: true,
            city: true,
            logoUrl: true,
          },
        },
        class: {
          select: {
            id: true,
            name: true,
            grade: { select: { name: true, level: true } },
          },
        },
        _count: {
          select: {
            attendances: true,
            results: true,
            assignmentSubmissions: true,
          },
        },
      },
      orderBy: { name: "asc" },
    })

    // Group children by school
    const childrenBySchool = children.reduce(
      (acc, child) => {
        const schoolId = child.school.id
        if (!acc[schoolId]) {
          acc[schoolId] = {
            school: child.school,
            children: [],
          }
        }
        acc[schoolId].children.push(child)
        return acc
      },
      {} as Record<string, any>,
    )

    logger.info("Parent children retrieved", {
      userId: req.user?.id,
      childrenCount: children.length,
      schoolsCount: Object.keys(childrenBySchool).length,
    })

    res.status(200).json({
      message: "Children retrieved successfully",
      children,
      childrenBySchool: Object.values(childrenBySchool),
      summary: {
        totalChildren: children.length,
        schoolsCount: Object.keys(childrenBySchool).length,
      },
    })
  } catch (error) {
    handleError(res, error, "Failed to retrieve parent children")
  }
}

export const getParentSchools = async (req: AuthRequest, res: Response) => {
  try {
    if (req.user?.role !== "PARENT") {
      return res.status(403).json({ message: "Access denied" })
    }

    const schools = await prisma.school.findMany({
      where: {
        students: {
          some: { parentId: req.user.id },
        },
      },
      include: {
        students: {
          where: { parentId: req.user.id },
          select: {
            id: true,
            name: true,
            surname: true,
            registrationNumber: true,
            class: { select: { name: true } },
            grade: { select: { name: true } },
          },
        },
        _count: {
          select: {
            students: true,
            teachers: true,
            classes: true,
          },
        },
      },
    })

    logger.info("Parent schools retrieved", {
      userId: req.user?.id,
      schoolsCount: schools.length,
    })

    res.status(200).json({
      message: "Schools retrieved successfully",
      schools,
    })
  } catch (error) {
    handleError(res, error, "Failed to retrieve parent schools")
  }
}

// Teacher-specific endpoints for their classes and subjects
export const getTeacherClasses = async (req: AuthRequest, res: Response) => {
  try {
    if (req.user?.role !== "TEACHER") {
      return res.status(403).json({ message: "Access denied" })
    }

    const classes = await prisma.class.findMany({
      where: {
        OR: [
          { supervisorId: req.user.id },
          {
            lessons: {
              some: { teacherId: req.user.id },
            },
          },
        ],
      },
      include: {
        grade: { select: { name: true, level: true } },
        school: { select: { name: true } },
        students: {
          select: {
            id: true,
            name: true,
            surname: true,
            registrationNumber: true,
          },
        },
        lessons: {
          where: { teacherId: req.user.id },
          include: {
            subject: { select: { name: true } },
          },
        },
        _count: {
          select: {
            students: true,
            assignments: true,
          },
        },
      },
      orderBy: { name: "asc" },
    })

    logger.info("Teacher classes retrieved", {
      userId: req.user?.id,
      classesCount: classes.length,
    })

    res.status(200).json({
      message: "Teacher classes retrieved successfully",
      classes,
    })
  } catch (error) {
    handleError(res, error, "Failed to retrieve teacher classes")
  }
}

export const getTeacherSubjects = async (req: AuthRequest, res: Response) => {
  try {
    if (req.user?.role !== "TEACHER") {
      return res.status(403).json({ message: "Access denied" })
    }

    const subjects = await prisma.subject.findMany({
      where: {
        teachers: {
          some: { id: req.user.id },
        },
      },
      include: {
        school: { select: { name: true } },
        lessons: {
          where: { teacherId: req.user.id },
          include: {
            class: { select: { name: true } },
          },
        },
        assignments: {
          where: { teacherId: req.user.id },
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
      orderBy: { name: "asc" },
    })

    logger.info("Teacher subjects retrieved", {
      userId: req.user?.id,
      subjectsCount: subjects.length,
    })

    res.status(200).json({
      message: "Teacher subjects retrieved successfully",
      subjects,
    })
  } catch (error) {
    handleError(res, error, "Failed to retrieve teacher subjects")
  }
}

export const getTeacherStudents = async (req: AuthRequest, res: Response) => {
  try {
    if (req.user?.role !== "TEACHER") {
      return res.status(403).json({ message: "Access denied" })
    }

    // Get students from classes the teacher supervises or teaches
    const students = await prisma.student.findMany({
      where: {
        OR: [
          {
            class: { supervisorId: req.user.id },
          },
          {
            class: {
              lessons: {
                some: { teacherId: req.user.id },
              },
            },
          },
        ],
      },
      include: {
        class: {
          select: {
            name: true,
            grade: { select: { name: true } },
          },
        },
        parent: {
          include: {
            user: {
              select: {
                name: true,
                surname: true,
                email: true,
                phone: true,
              },
            },
          },
        },
        _count: {
          select: {
            attendances: true,
            results: true,
            assignmentSubmissions: true,
          },
        },
      },
      orderBy: [{ class: { name: "asc" } }, { name: "asc" }],
    })

    // Group students by class
    const studentsByClass = students.reduce(
      (acc, student) => {
        const className = student.class?.name || "No Class"
        if (!acc[className]) {
          acc[className] = []
        }
        acc[className].push(student)
        return acc
      },
      {} as Record<string, any[]>,
    )

    logger.info("Teacher students retrieved", {
      userId: req.user?.id,
      studentsCount: students.length,
      classesCount: Object.keys(studentsByClass).length,
    })

    res.status(200).json({
      message: "Teacher students retrieved successfully",
      students,
      studentsByClass,
      summary: {
        totalStudents: students.length,
        classesCount: Object.keys(studentsByClass).length,
      },
    })
  } catch (error) {
    handleError(res, error, "Failed to retrieve teacher students")
  }
}

// Principal-specific endpoints for school management
export const getPrincipalSchoolOverview = async (req: AuthRequest, res: Response) => {
  try {
    if (req.user?.role !== "PRINCIPAL") {
      return res.status(403).json({ message: "Access denied" })
    }

    const filter = getTenantFilter(req.user)

    const [school, grades, classes, subjects, teachers, students, pendingApprovals, recentActivities] =
      await Promise.all([
        prisma.school.findUnique({
          where: { id: req.user.schoolId },
          include: {
            subscription: true,
            _count: {
              select: {
                students: true,
                teachers: true,
                classes: true,
                grades: true,
                subjects: true,
              },
            },
          },
        }),
        prisma.grade.findMany({
          where: filter,
          include: {
            _count: {
              select: {
                classes: true,
                students: true,
              },
            },
          },
          orderBy: { level: "asc" },
        }),
        prisma.class.findMany({
          where: filter,
          include: {
            grade: { select: { name: true } },
            supervisor: {
              include: {
                user: { select: { name: true, surname: true } },
              },
            },
            _count: {
              select: {
                students: true,
                lessons: true,
              },
            },
          },
          orderBy: { name: "asc" },
        }),
        prisma.subject.findMany({
          where: filter,
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
              },
            },
          },
          orderBy: { name: "asc" },
        }),
        prisma.teacher.findMany({
          where: filter,
          include: {
            user: {
              select: {
                name: true,
                surname: true,
                email: true,
                profileImageUrl: true,
              },
            },
            approval: true,
            subjects: {
              select: { name: true },
            },
            supervisedClasses: {
              select: { name: true },
            },
          },
          orderBy: { user: { name: "asc" } },
        }),
        prisma.student.count({ where: filter }),
        prisma.approval.findMany({
          where: {
            status: "PENDING",
            OR: [
              { teacher: { schoolId: req.user.schoolId } },
              { assignment: { schoolId: req.user.schoolId } },
              { examQuestion: { schoolId: req.user.schoolId } },
            ],
          },
          include: {
            teacher: {
              include: {
                user: { select: { name: true, surname: true } },
              },
            },
            assignment: {
              select: { title: true },
            },
            examQuestion: {
              select: { title: true },
            },
          },
          orderBy: { createdAt: "desc" },
        }),
        // Recent activities (assignments, events, etc.)
        prisma.assignment.findMany({
          where: {
            ...filter,
            createdAt: {
              gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
            },
          },
          include: {
            teacher: {
              include: {
                user: { select: { name: true, surname: true } },
              },
            },
            subject: { select: { name: true } },
            class: { select: { name: true } },
          },
          orderBy: { createdAt: "desc" },
          take: 10,
        }),
      ])

    const overview = {
      school,
      structure: {
        grades,
        classes,
        subjects,
      },
      staff: {
        teachers,
        totalTeachers: teachers.length,
        approvedTeachers: teachers.filter((t) => t.approval?.status === "APPROVED").length,
        pendingTeachers: teachers.filter((t) => t.approval?.status === "PENDING").length,
      },
      students: {
        totalStudents: students,
      },
      pendingApprovals,
      recentActivities,
    }

    logger.info("Principal school overview retrieved", {
      userId: req.user?.id,
      schoolId: req.user?.schoolId,
    })

    res.status(200).json({
      message: "Principal school overview retrieved successfully",
      overview,
    })
  } catch (error) {
    handleError(res, error, "Failed to retrieve principal school overview")
  }
}

// Student verification endpoints
const addChildSchema = z.object({
  studentId: z.string().uuid("Invalid student ID"),
  verificationCode: z.string().optional(),
})

export const addChildToParent = async (req: AuthRequest, res: Response) => {
  try {
    if (req.user?.role !== "PARENT") {
      return res.status(403).json({ message: "Access denied" })
    }

    const data = addChildSchema.parse(req.body)

    // Find the student
    const student = await prisma.student.findUnique({
      where: { id: data.studentId },
      include: {
        school: { select: { name: true } },
        parent: {
          include: {
            user: { select: { name: true, surname: true } },
          },
        },
      },
    })

    if (!student) {
      return res.status(404).json({ message: "Student not found" })
    }

    // Check if student already has a parent
    if (student.parentId) {
      return res.status(400).json({
        message: "Student already has a parent assigned",
        currentParent: student.parent?.user,
      })
    }

    // Update student with parent ID
    const updatedStudent = await prisma.student.update({
      where: { id: data.studentId },
      data: {
        parentId: req.user.id,
        verificationStatus: "PENDING",
      },
      include: {
        school: { select: { name: true } },
        class: { select: { name: true } },
        grade: { select: { name: true } },
      },
    })

    // Create notification for school admin/principal
    await prisma.notification.create({
      data: {
        userId: req.user.id,
        title: "Child Added Successfully",
        content: `You have successfully added ${student.name} ${student.surname} from ${student.school.name} as your child. Verification is pending.`,
        type: "GENERAL",
      },
    })

    logger.info("Child added to parent", {
      userId: req.user?.id,
      studentId: data.studentId,
      schoolId: student.schoolId,
    })

    res.status(200).json({
      message: "Child added successfully",
      student: updatedStudent,
    })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ message: "Invalid input", errors: error.errors })
    }
    handleError(res, error, "Failed to add child to parent")
  }
}

export const verifyParentChild = async (req: AuthRequest, res: Response) => {
  const { studentId } = req.params
  try {
    if (!["PRINCIPAL", "SCHOOL_ADMIN"].includes(req.user?.role || "")) {
      return res.status(403).json({ message: "Access denied" })
    }

    const filter = getTenantFilter(req.user)
    const student = await prisma.student.findFirst({
      where: {
        id: studentId,
        ...filter,
      },
      include: {
        parent: {
          include: {
            user: { select: { name: true, surname: true, email: true } },
          },
        },
      },
    })

    if (!student) {
      return res.status(404).json({ message: "Student not found or access denied" })
    }

    const updatedStudent = await prisma.student.update({
      where: { id: studentId },
      data: {
        verificationStatus: "VERIFIED",
        verifiedAt: new Date(),
      },
    })

    // Notify parent
    await prisma.notification.create({
      data: {
        userId: student.parentId,
        title: "Child Verification Approved",
        content: `Your relationship with ${student.name} ${student.surname} has been verified and approved.`,
        type: "APPROVAL",
      },
    })

    logger.info("Parent-child relationship verified", {
      userId: req.user?.id,
      studentId: studentId,
      parentId: student.parentId,
    })

    res.status(200).json({
      message: "Parent-child relationship verified successfully",
      student: updatedStudent,
    })
  } catch (error) {
    handleError(res, error, "Failed to verify parent-child relationship")
  }
}

// Class assignment endpoints
export const assignStudentToClass = async (req: AuthRequest, res: Response) => {
  const { studentId } = req.params
  const { classId } = req.body

  try {
    if (!["PRINCIPAL", "SCHOOL_ADMIN"].includes(req.user?.role || "")) {
      return res.status(403).json({ message: "Access denied" })
    }

    const filter = getTenantFilter(req.user)

    // Verify student and class belong to the same school
    const [student, classRecord] = await Promise.all([
      prisma.student.findFirst({
        where: { id: studentId, ...filter },
      }),
      prisma.class.findFirst({
        where: { id: classId, ...filter },
        include: {
          grade: { select: { name: true } },
          _count: { select: { students: true } },
        },
      }),
    ])

    if (!student) {
      return res.status(404).json({ message: "Student not found or access denied" })
    }
    if (!classRecord) {
      return res.status(404).json({ message: "Class not found or access denied" })
    }

    // Check class capacity
    if (classRecord._count.students >= classRecord.capacity) {
      return res.status(400).json({ message: "Class is at full capacity" })
    }

    const updatedStudent = await prisma.student.update({
      where: { id: studentId },
      data: {
        classId: classId,
        gradeId: classRecord.gradeId,
      },
      include: {
        class: {
          select: {
            name: true,
            grade: { select: { name: true } },
          },
        },
      },
    })

    logger.info("Student assigned to class", {
      userId: req.user?.id,
      studentId: studentId,
      classId: classId,
    })

    res.status(200).json({
      message: "Student assigned to class successfully",
      student: updatedStudent,
    })
  } catch (error) {
    handleError(res, error, "Failed to assign student to class")
  }
}

export const getUnassignedStudents = async (req: AuthRequest, res: Response) => {
  try {
    if (!["PRINCIPAL", "SCHOOL_ADMIN"].includes(req.user?.role || "")) {
      return res.status(403).json({ message: "Access denied" })
    }

    const filter = getTenantFilter(req.user)

    const unassignedStudents = await prisma.student.findMany({
      where: {
        ...filter,
        classId: null,
      },
      include: {
        parent: {
          include: {
            user: { select: { name: true, surname: true, email: true } },
          },
        },
      },
      orderBy: { name: "asc" },
    })

    logger.info("Unassigned students retrieved", {
      userId: req.user?.id,
      count: unassignedStudents.length,
    })

    res.status(200).json({
      message: "Unassigned students retrieved successfully",
      students: unassignedStudents,
      count: unassignedStudents.length,
    })
  } catch (error) {
    handleError(res, error, "Failed to retrieve unassigned students")
  }
}

// Multi-tenant search endpoints
export const searchAcrossSchools = async (req: AuthRequest, res: Response) => {
  try {
    if (req.user?.role !== "PARENT") {
      return res.status(403).json({ message: "Access denied" })
    }

    const { query, type } = req.query as { query: string; type: string }

    if (!query || query.length < 2) {
      return res.status(400).json({ message: "Search query must be at least 2 characters" })
    }

    const results: any = {}

    // Get schools where parent has children
    const parentSchools = await prisma.school.findMany({
      where: {
        students: {
          some: { parentId: req.user.id },
        },
      },
      select: { id: true },
    })

    const schoolIds = parentSchools.map((s) => s.id)

    if (type === "assignments" || !type) {
      results.assignments = await prisma.assignment.findMany({
        where: {
          schoolId: { in: schoolIds },
          OR: [
            { title: { contains: query, mode: "insensitive" } },
            { description: { contains: query, mode: "insensitive" } },
          ],
        },
        include: {
          school: { select: { name: true } },
          subject: { select: { name: true } },
          class: { select: { name: true } },
          teacher: {
            include: {
              user: { select: { name: true, surname: true } },
            },
          },
        },
        take: 10,
      })
    }

    if (type === "events" || !type) {
      results.events = await prisma.event.findMany({
        where: {
          schoolId: { in: schoolIds },
          OR: [
            { title: { contains: query, mode: "insensitive" } },
            { description: { contains: query, mode: "insensitive" } },
          ],
        },
        include: {
          school: { select: { name: true } },
          class: { select: { name: true } },
        },
        take: 10,
      })
    }

    if (type === "announcements" || !type) {
      results.announcements = await prisma.announcement.findMany({
        where: {
          schoolId: { in: schoolIds },
          OR: [
            { title: { contains: query, mode: "insensitive" } },
            { content: { contains: query, mode: "insensitive" } },
          ],
        },
        include: {
          school: { select: { name: true } },
          class: { select: { name: true } },
        },
        take: 10,
      })
    }

    logger.info("Multi-school search performed", {
      userId: req.user?.id,
      query: query,
      type: type,
      schoolsCount: schoolIds.length,
    })

    res.status(200).json({
      message: "Search completed successfully",
      query,
      results,
    })
  } catch (error) {
    handleError(res, error, "Failed to perform search")
  }
}
