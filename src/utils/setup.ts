import { Prisma, PrismaClient } from "@prisma/client"
import winston from "winston"
import type { Request, Response, NextFunction } from "express"
import jwt from "jsonwebtoken"
import bcrypt from "bcrypt"

// Prisma Client with multi-tenant support
export const prisma = new PrismaClient()

// Logger
export const logger = winston.createLogger({
  level: "info",
  format: winston.format.combine(winston.format.timestamp(), winston.format.json()),
  transports: [
    new winston.transports.File({ filename: "error.log", level: "error" }),
    new winston.transports.File({ filename: "combined.log" }),
  ],
})

if (process.env.NODE_ENV !== "production") {
  logger.add(new winston.transports.Console({ format: winston.format.simple() }))
}

// Password hashing utility
export const hashPassword = async (password: string): Promise<string> => {
  const saltRounds = 12
  return await bcrypt.hash(password, saltRounds)
}

// Password verification utility
export const verifyPassword = async (password: string, hashedPassword: string): Promise<boolean> => {
  return await bcrypt.compare(password, hashedPassword)
}

// Enhanced Authentication Middleware with multi-tenant support
export interface AuthRequest extends Request {
  user?: {
    id: string
    role: string
    schoolId?: string
    tenantId?: string
  }
}

// Update the global declaration to avoid conflicts
declare global {
  namespace Express {
    namespace Multer {
      interface File {
        fieldname: string
        originalname: string
        encoding: string
        mimetype: string
        size: number
        destination: string
        filename: string
        path: string
        buffer: Buffer
      }
    }
    // Extend the Request interface to ensure compatibility
    interface Request {
      user?: {
        id: string
        role: string
        schoolId?: string
        tenantId?: string
      }
    }
  }
}

export const authMiddleware =
  (requiredRoles: string[]) => async (req: AuthRequest, res: Response, next: NextFunction) => {
    const token = req.headers.authorization?.split(" ")[1]
    if (!token) {
      logger.warn("No token provided", { path: req.path })
      return res.status(401).json({ message: "No token provided" })
    }

    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET!) as {
        id: string
        role: string
        schoolId?: string
        tenantId?: string
      }

      if (requiredRoles.length && !requiredRoles.includes(decoded.role)) {
        logger.warn("Insufficient permissions", {
          userId: decoded.id,
          role: decoded.role,
          path: req.path,
        })
        return res.status(403).json({ message: "Insufficient permissions" })
      }

      // Get user's school context for multi-tenancy (except for SUPER_ADMIN and PARENT)
      if (decoded.role !== "SUPER_ADMIN") {
        const user = await prisma.user.findUnique({
          where: { id: decoded.id },
          include: {
            schoolAdmin: { include: { school: true } },
            principal: { include: { school: true } },
            teacher: { include: { school: true } },
            parent: true, // Parent doesn't have a single school
          },
        })

        if (user) {
          let school
          if (user.schoolAdmin) school = user.schoolAdmin.school
          else if (user.principal) school = user.principal.school
          else if (user.teacher) school = user.teacher.school
          // Parents don't have a single school context

          if (school) {
            decoded.schoolId = school.id
            decoded.tenantId = school.tenantId
          }
        }
      }

      req.user = decoded
      next()
    } catch (error) {
      logger.error("Invalid token", { error, path: req.path })
      return res.status(401).json({ message: "Invalid token" })
    }
  }

// Enhanced multi-tenant data filter
export const getTenantFilter = (user: AuthRequest["user"]) => {
  if (!user || user.role === "SUPER_ADMIN") {
    return {} // Super admin can access all data
  }

  // For school-based roles, filter by their school
  if (user.schoolId && ["SCHOOL_ADMIN", "PRINCIPAL", "TEACHER"].includes(user.role)) {
    return { schoolId: user.schoolId }
  }

  // Parents don't have a single school filter since they can have children in multiple schools
  // Parent filtering is handled at the query level in individual controllers
  return {}
}

// Get schools where parent has children (for parent multi-tenant filtering)
export const getParentSchoolIds = async (parentId: string): Promise<string[]> => {
  const students = await prisma.student.findMany({
    where: { parentId },
    select: { schoolId: true },
    distinct: ["schoolId"],
  })
  return students.map((s) => s.schoolId)
}

// Enhanced tenant filter for parent-specific queries
export const getParentTenantFilter = async (parentId: string) => {
  const schoolIds = await getParentSchoolIds(parentId)
  return {
    schoolId: { in: schoolIds },
  }
}

// Enhanced tenant filter for teacher-specific student queries
export const getTeacherStudentFilter = (teacherId: string, schoolId?: string) => {
  const baseFilter: any = {
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

  if (schoolId) {
    baseFilter.schoolId = schoolId
  }

  return baseFilter
}

// Enhanced tenant filter for teacher-specific parent queries
export const getTeacherParentFilter = (teacherId: string, schoolId?: string) => {
  const baseFilter: any = {
    children: {
      some: {
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
      },
    },
  }

  if (schoolId) {
    baseFilter.children.some.schoolId = schoolId
  }

  return baseFilter
}

// Enhanced tenant filter for teacher-specific queries
export const getTeacherTenantFilter = (teacherId: string, schoolId?: string) => {
  const baseFilter: any = {
    OR: [
      { supervisorId: teacherId },
      {
        lessons: {
          some: { teacherId: teacherId },
        },
      },
    ],
  }

  if (schoolId) {
    baseFilter.schoolId = schoolId
  }

  return baseFilter
}

// Error Handler
export const handleError = (res: Response, error: unknown, defaultMessage: string) => {
  logger.error(defaultMessage, { error })

  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    if (error.code === "P2025") {
      return res.status(404).json({ message: "Resource not found" })
    }
    if (error.code === "P2002") {
      return res.status(409).json({ message: "Unique constraint violation" })
    }
    if (error.code === "P2003") {
      return res.status(400).json({ message: "Foreign key constraint violation" })
    }
  }

  if (error instanceof Error) {
    return res.status(400).json({ message: error.message })
  }

  return res.status(500).json({ message: defaultMessage })
}

// Pagination helper
export interface PaginationOptions {
  page?: number
  limit?: number
}

export interface PaginationResult {
  page: number
  limit: number
  total: number
  pages: number
}

export const getPagination = (options: PaginationOptions) => {
  const page = Math.max(1, options.page || 1)
  const limit = Math.min(100, Math.max(1, options.limit || 10))
  const skip = (page - 1) * limit

  return { page, limit, skip }
}

export const createPaginationResult = (page: number, limit: number, total: number): PaginationResult => ({
  page,
  limit,
  total,
  pages: Math.ceil(total / limit),
})

// Notification helper
export const createNotification = async (userId: string, title: string, content: string, type: string, data?: any) => {
  try {
    await prisma.notification.create({
      data: {
        userId,
        title,
        content,
        type: type as any,
        data,
      },
    })
  } catch (error) {
    logger.error("Failed to create notification", { error, userId, title })
  }
}

// Revenue calculation helper
export const calculateTransactionFee = (amount: number, feePercentage = 0.025): number => {
  return Math.round(amount * feePercentage * 100) / 100 // Round to 2 decimal places
}

// Multi-tenant validation helpers
export const validateSchoolAccess = async (userId: string, schoolId: string, userRole: string): Promise<boolean> => {
  if (userRole === "SUPER_ADMIN") return true

  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: {
      schoolAdmin: true,
      principal: true,
      teacher: true,
      parent: {
        include: {
          children: { select: { schoolId: true } },
        },
      },
    },
  })

  if (!user) return false

  switch (userRole) {
    case "SCHOOL_ADMIN":
      return user.schoolAdmin?.schoolId === schoolId
    case "PRINCIPAL":
      return user.principal?.schoolId === schoolId
    case "TEACHER":
      return user.teacher?.schoolId === schoolId
    case "PARENT":
      return user.parent?.children.some((child) => child.schoolId === schoolId) || false
    default:
      return false
  }
}

export const validateStudentAccess = async (userId: string, studentId: string, userRole: string): Promise<boolean> => {
  if (userRole === "SUPER_ADMIN") return true

  const student = await prisma.student.findUnique({
    where: { id: studentId },
    include: {
      school: true,
      class: {
        include: {
          supervisor: true,
          lessons: {
            include: { teacher: true },
          },
        },
      },
    },
  })

  if (!student) return false

  switch (userRole) {
    case "PARENT":
      return student.parentId === userId
    case "TEACHER":
      // Teacher can access if they supervise the class or teach lessons in the class
      return (
        student.class?.supervisorId === userId ||
        student.class?.lessons.some((lesson) => lesson.teacherId === userId) ||
        false
      )
    case "PRINCIPAL":
    case "SCHOOL_ADMIN":
      return await validateSchoolAccess(userId, student.schoolId, userRole)
    default:
      return false
  }
}
export const calculateAge = (birthDate: Date | null | undefined): number | null => {
  if (!birthDate) {
    return null
  }
  const today = new Date()
  let age = today.getFullYear() - birthDate.getFullYear()
  const m = today.getMonth() - birthDate.getMonth()
  if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) {
    age--
  }
  return age
}