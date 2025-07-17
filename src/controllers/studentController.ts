import type { Response } from "express"
import { z } from "zod"
import { prisma, type AuthRequest, handleError, logger, getTenantFilter } from "../utils/setup"

// Validation Schemas
const createStudentSchema = z.object({
  registrationNumber: z.string().min(1, "Registration number is required"),
  name: z.string().min(1, "Name is required"),
  surname: z.string().min(1, "Surname is required"),
  address: z.string().optional(),
  imageUrl: z.string().url().optional(),
  bloodType: z.string().optional(),
  sex: z.enum(["MALE", "FEMALE", "OTHER"]).optional(),
  birthday: z.string().datetime().optional(),
  schoolId: z.string().uuid("Invalid school ID"),
  parentId: z.string().uuid("Invalid parent ID"),
  classId: z.string().uuid("Invalid class ID").optional(),
  gradeId: z.string().uuid("Invalid grade ID").optional(),
})

const updateStudentSchema = z.object({
  registrationNumber: z.string().min(1).optional(),
  name: z.string().min(1).optional(),
  surname: z.string().min(1).optional(),
  address: z.string().optional(),
  imageUrl: z.string().url().optional(),
  bloodType: z.string().optional(),
  sex: z.enum(["MALE", "FEMALE", "OTHER"]).optional(),
  birthday: z.string().datetime().optional(),
  classId: z.string().uuid().optional(),
  gradeId: z.string().uuid().optional(),
  verificationStatus: z.enum(["PENDING", "VERIFIED", "REJECTED"]).optional(),
})

export const getStudents = async (req: AuthRequest, res: Response) => {
  try {
    const page = Number.parseInt(req.query.page as string) || 1
    const limit = Number.parseInt(req.query.limit as string) || 10
    const skip = (page - 1) * limit

    let where: any = {}

    // Apply tenant filtering based on user role
    if (req.user?.role === "SUPER_ADMIN") {
      // Super admin sees all students
      where = {}
    } else if (req.user?.role === "PARENT") {
      // Parents see only their own children
      where = { parentId: req.user.id }
    } else if (req.user?.role === "TEACHER") {
      // Teachers see students in their classes or lessons
      where = getTeacherStudentFilter(req.user.id, req.user?.schoolId)
    } else if (req.user?.role === "PRINCIPAL" || req.user?.role === "SCHOOL_ADMIN") {
      // School admins and principals see students in their school
      where = getTenantFilter(req.user)
    }

    const [students, total] = await Promise.all([
      prisma.student.findMany({
        where,
        skip,
        take: limit,
        include: {
          school: {
            select: {
              id: true,
              name: true,
              city: true,
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
          class: {
            select: {
              id: true,
              name: true,
              grade: { select: { name: true, level: true } },
            },
          },
          grade: {
            select: {
              name: true,
              level: true,
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
        orderBy: [{ school: { name: "asc" } }, { name: "asc" }],
      }),
      prisma.student.count({ where }),
    ])

    logger.info("Students retrieved", {
      userId: req.user?.id,
      userRole: req.user?.role,
      page,
      limit,
      total,
    })

    res.status(200).json({
      message: "Students retrieved successfully",
      students,
      pagination: { page, limit, total, pages: Math.ceil(total / limit) },
    })
  } catch (error) {
    handleError(res, error, "Failed to retrieve students")
  }
}

export const getStudentById = async (req: AuthRequest, res: Response) => {
  const { id } = req.params
  try {
    let where: any = { id }

    // Apply access control based on user role
    if (req.user?.role === "PARENT") {
      where = { id, parentId: req.user.id }
    } else if (req.user?.role === "TEACHER") {
      where = {
        id,
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
      }
    } else if (req.user?.role === "PRINCIPAL" || req.user?.role === "SCHOOL_ADMIN") {
      where = { id, ...getTenantFilter(req.user) }
    }

    const student = await prisma.student.findFirst({
      where,
      include: {
        school: {
          select: {
            id: true,
            name: true,
            address: true,
            city: true,
            logoUrl: true,
          },
        },
        parent: {
          include: {
            user: {
              select: {
                id: true,
                name: true,
                surname: true,
                email: true,
                phone: true,
                address: true,
              },
            },
          },
        },
        class: {
          include: {
            grade: { select: { name: true, level: true } },
            supervisor: {
              include: {
                user: { select: { name: true, surname: true } },
              },
            },
            _count: { select: { students: true } },
          },
        },
        grade: {
          select: {
            name: true,
            level: true,
          },
        },
        attendances: {
          orderBy: { date: "desc" },
          take: 10,
          include: {
            lesson: {
              include: {
                subject: { select: { name: true } },
              },
            },
          },
        },
        results: {
          orderBy: { uploadedAt: "desc" },
          take: 10,
          include: {
            assignment: {
              select: {
                title: true,
                subject: { select: { name: true } },
              },
            },
            exam: {
              select: {
                title: true,
                examQuestions: {
                  select: {
                    subject: { select: { name: true } },
                  },
                },
              },
            },
          },
        },
        assignmentSubmissions: {
          orderBy: { submittedAt: "desc" },
          take: 5,
          include: {
            assignment: {
              select: {
                title: true,
                dueDate: true,
                subject: { select: { name: true } },
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
    })

    if (!student) {
      logger.warn("Student not found or access denied", {
        userId: req.user?.id,
        studentId: id,
        userRole: req.user?.role,
      })
      return res.status(404).json({ message: "Student not found" })
    }

    logger.info("Student retrieved", { userId: req.user?.id, studentId: id })
    res.status(200).json({ message: "Student retrieved successfully", student })
  } catch (error) {
    handleError(res, error, "Failed to retrieve student")
  }
}

export const createStudent = async (req: AuthRequest, res: Response) => {
  try {
    const data = createStudentSchema.parse(req.body)

    // Only super admin, principal, or school admin can create students
    if (!["SUPER_ADMIN", "PRINCIPAL", "SCHOOL_ADMIN"].includes(req.user?.role || "")) {
      return res.status(403).json({ message: "Access denied" })
    }

    // Verify school exists and user has access
    const school = await prisma.school.findFirst({
      where: {
        id: data.schoolId,
        ...(req.user?.role !== "SUPER_ADMIN" ? { id: req.user?.schoolId } : {}),
      },
    })

    if (!school) {
      return res.status(404).json({ message: "School not found or access denied" })
    }

    // Verify parent exists
    const parent = await prisma.parent.findUnique({ where: { id: data.parentId } })
    if (!parent) {
      return res.status(404).json({ message: "Parent not found" })
    }

    // Verify class and grade if provided
    if (data.classId) {
      const classRecord = await prisma.class.findFirst({
        where: {
          id: data.classId,
          schoolId: data.schoolId,
        },
        include: {
          _count: { select: { students: true } },
        },
      })
      if (!classRecord) {
        return res.status(404).json({ message: "Class not found in the specified school" })
      }
      if (classRecord._count.students >= classRecord.capacity) {
        return res.status(400).json({ message: "Class is at full capacity" })
      }
    }

    if (data.gradeId) {
      const grade = await prisma.grade.findFirst({
        where: {
          id: data.gradeId,
          schoolId: data.schoolId,
        },
      })
      if (!grade) {
        return res.status(404).json({ message: "Grade not found in the specified school" })
      }
    }

    // Check for duplicate registration number within the school
    const existingStudent = await prisma.student.findFirst({
      where: {
        registrationNumber: data.registrationNumber,
        schoolId: data.schoolId,
      },
    })

    if (existingStudent) {
      return res.status(409).json({
        message: "A student with this registration number already exists in this school",
      })
    }

    const student = await prisma.student.create({
      data: {
        registrationNumber: data.registrationNumber,
        name: data.name,
        surname: data.surname,
        address: data.address,
        imageUrl: data.imageUrl,
        bloodType: data.bloodType,
        sex: data.sex,
        birthday: data.birthday ? new Date(data.birthday) : undefined,
        schoolId: data.schoolId,
        parentId: data.parentId,
        classId: data.classId,
        gradeId: data.gradeId,
        verificationStatus: "PENDING",
      },
      include: {
        school: { select: { name: true } },
        parent: {
          include: {
            user: { select: { name: true, surname: true } },
          },
        },
        class: { select: { name: true } },
        grade: { select: { name: true } },
      },
    })

    // Notify parent about the new student record
    await prisma.notification.create({
      data: {
        userId: data.parentId,
        title: "Student Record Created",
        content: `A student record for ${data.name} ${data.surname} has been created at ${school.name}. Verification is pending.`,
        type: "GENERAL",
      },
    })

    logger.info("Student created", {
      userId: req.user?.id,
      studentId: student.id,
      schoolId: data.schoolId,
    })

    res.status(201).json({ message: "Student created successfully", student })
  } catch (error) {
    if (error instanceof z.ZodError) {
      logger.warn("Invalid input for student creation", { userId: req.user?.id, errors: error.errors })
      return res.status(400).json({ message: "Invalid input", errors: error.errors })
    }
    handleError(res, error, "Failed to create student")
  }
}

export const updateStudent = async (req: AuthRequest, res: Response) => {
  const { id } = req.params
  try {
    const data = updateStudentSchema.parse(req.body)

    let where: any = { id }

    // Apply access control based on user role
    if (req.user?.role === "PARENT") {
      where = { id, parentId: req.user.id }
      // Parents can't update verification status
      if (data.verificationStatus) {
        return res.status(403).json({ message: "Parents cannot update verification status" })
      }
    } else if (req.user?.role === "PRINCIPAL" || req.user?.role === "SCHOOL_ADMIN") {
      where = { id, ...getTenantFilter(req.user) }
    } else if (req.user?.role === "TEACHER") {
      // Teachers can only update students in their classes and can't change verification status
      where = {
        id,
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
      }
      if (data.verificationStatus) {
        return res.status(403).json({ message: "Teachers cannot update verification status" })
      }
    }

    // Get existing student to validate updates
    const existingStudent = await prisma.student.findFirst({ where })
    if (!existingStudent) {
      return res.status(404).json({ message: "Student not found or access denied" })
    }

    // Verify class and grade if being updated
    if (data.classId) {
      const classRecord = await prisma.class.findFirst({
        where: {
          id: data.classId,
          schoolId: existingStudent.schoolId,
        },
        include: {
          _count: { select: { students: true } },
        },
      })
      if (!classRecord) {
        return res.status(404).json({ message: "Class not found in the student's school" })
      }
      // Check capacity only if moving to a different class
      if (data.classId !== existingStudent.classId && classRecord._count.students >= classRecord.capacity) {
        return res.status(400).json({ message: "Class is at full capacity" })
      }
    }

    if (data.gradeId) {
      const grade = await prisma.grade.findFirst({
        where: {
          id: data.gradeId,
          schoolId: existingStudent.schoolId,
        },
      })
      if (!grade) {
        return res.status(404).json({ message: "Grade not found in the student's school" })
      }
    }

    // Check for duplicate registration number if being updated
    if (data.registrationNumber && data.registrationNumber !== existingStudent.registrationNumber) {
      const duplicateStudent = await prisma.student.findFirst({
        where: {
          registrationNumber: data.registrationNumber,
          schoolId: existingStudent.schoolId,
          id: { not: id },
        },
      })

      if (duplicateStudent) {
        return res.status(409).json({
          message: "A student with this registration number already exists in this school",
        })
      }
    }

    const student = await prisma.student.update({
      where: { id },
      data: {
        ...(data.registrationNumber && { registrationNumber: data.registrationNumber }),
        ...(data.name && { name: data.name }),
        ...(data.surname && { surname: data.surname }),
        ...(data.address !== undefined && { address: data.address }),
        ...(data.imageUrl !== undefined && { imageUrl: data.imageUrl }),
        ...(data.bloodType !== undefined && { bloodType: data.bloodType }),
        ...(data.sex && { sex: data.sex }),
        ...(data.birthday && { birthday: new Date(data.birthday) }),
        ...(data.classId !== undefined && { classId: data.classId }),
        ...(data.gradeId !== undefined && { gradeId: data.gradeId }),
        ...(data.verificationStatus && {
          verificationStatus: data.verificationStatus,
          ...(data.verificationStatus === "VERIFIED" && { verifiedAt: new Date() }),
        }),
      },
      include: {
        school: { select: { name: true } },
        parent: {
          include: {
            user: { select: { name: true, surname: true } },
          },
        },
        class: { select: { name: true } },
        grade: { select: { name: true } },
      },
    })

    // Notify parent if verification status changed
    if (data.verificationStatus && data.verificationStatus !== existingStudent.verificationStatus) {
      const statusMessage =
        data.verificationStatus === "VERIFIED"
          ? "verified and approved"
          : data.verificationStatus === "REJECTED"
            ? "rejected"
            : "pending review"

      await prisma.notification.create({
        data: {
          userId: existingStudent.parentId,
          title: "Student Verification Update",
          content: `The verification status for ${student.name} ${student.surname} has been ${statusMessage}.`,
          type: "APPROVAL",
        },
      })
    }

    logger.info("Student updated", { userId: req.user?.id, studentId: id })
    res.status(200).json({ message: "Student updated successfully", student })
  } catch (error) {
    if (error instanceof z.ZodError) {
      logger.warn("Invalid input for student update", { userId: req.user?.id, errors: error.errors })
      return res.status(400).json({ message: "Invalid input", errors: error.errors })
    }
    handleError(res, error, "Failed to update student")
  }
}

export const deleteStudent = async (req: AuthRequest, res: Response) => {
  const { id } = req.params
  try {
    // Only super admin, principal, or school admin can delete students
    if (!["SUPER_ADMIN", "PRINCIPAL", "SCHOOL_ADMIN"].includes(req.user?.role || "")) {
      return res.status(403).json({ message: "Access denied" })
    }

    let where: any = { id }

    // Apply tenant filtering for non-super admins
    if (req.user?.role !== "SUPER_ADMIN") {
      where = { id, ...getTenantFilter(req.user) }
    }

    // Check if student has associated records
    const student = await prisma.student.findFirst({
      where,
      include: {
        _count: {
          select: {
            attendances: true,
            results: true,
            assignmentSubmissions: true,
          },
        },
      },
    })

    if (!student) {
      return res.status(404).json({ message: "Student not found or access denied" })
    }

    const hasAssociatedData =
      student._count.attendances > 0 || student._count.results > 0 || student._count.assignmentSubmissions > 0

    if (hasAssociatedData) {
      return res.status(400).json({
        message: "Cannot delete student with associated attendance, results, or assignment submissions",
        associatedData: {
          attendances: student._count.attendances,
          results: student._count.results,
          assignmentSubmissions: student._count.assignmentSubmissions,
        },
      })
    }

    await prisma.student.delete({ where: { id } })

    logger.info("Student deleted", { userId: req.user?.id, studentId: id })
    res.status(200).json({ message: "Student deleted successfully" })
  } catch (error) {
    handleError(res, error, "Failed to delete student")
  }
}

// New endpoint to get students by school (for multi-tenant support)
export const getStudentsBySchool = async (req: AuthRequest, res: Response) => {
  try {
    if (!["PRINCIPAL", "SCHOOL_ADMIN", "SUPER_ADMIN"].includes(req.user?.role || "")) {
      return res.status(403).json({ message: "Access denied" })
    }

    const page = Number.parseInt(req.query.page as string) || 1
    const limit = Number.parseInt(req.query.limit as string) || 10
    const skip = (page - 1) * limit

    const schoolId = req.user?.role === "SUPER_ADMIN" ? (req.query.schoolId as string) : req.user?.schoolId

    if (!schoolId) {
      return res.status(400).json({ message: "School ID is required" })
    }

    const classId = req.query.classId as string
    const gradeId = req.query.gradeId as string
    const verificationStatus = req.query.verificationStatus as string

    const where: any = { schoolId }

    if (classId) where.classId = classId
    if (gradeId) where.gradeId = gradeId
    if (verificationStatus) where.verificationStatus = verificationStatus

    const [students, total] = await Promise.all([
      prisma.student.findMany({
        where,
        skip,
        take: limit,
        include: {
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
          class: {
            select: {
              name: true,
              grade: { select: { name: true } },
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
      }),
      prisma.student.count({ where }),
    ])

    logger.info("Students by school retrieved", {
      userId: req.user?.id,
      schoolId,
      page,
      limit,
      total,
    })

    res.status(200).json({
      message: "Students retrieved successfully",
      students,
      pagination: { page, limit, total, pages: Math.ceil(total / limit) },
    })
  } catch (error) {
    handleError(res, error, "Failed to retrieve students by school")
  }
}

async function getTeacherStudentFilter(teacherId: string, schoolId?: string) {
  return {
    schoolId,
    OR: [
      {
        class: { supervisorId: teacherId },
      },
      {
        class: {
          lessons: {
            some: { teacherId: teacherId },
          },
        },
      },
    ],
  }
}
