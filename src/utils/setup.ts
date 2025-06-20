import { Prisma, PrismaClient } from "@prisma/client"
import winston from "winston"
import type { Request, Response, NextFunction } from "express"
import jwt from "jsonwebtoken"

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

// Enhanced Authentication Middleware with multi-tenant support
export interface AuthRequest extends Request {
  user?: {
    id: string
    role: string
    schoolId?: string
    tenantId?: string
  }
  // Remove the conflicting file/files properties - they're already defined in Express.Request
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
  (requiredRoles: string[]) => 
  async (req: AuthRequest, res: Response, next: NextFunction) => {
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

      // Get user's school context for multi-tenancy
      if (decoded.role !== "SUPER_ADMIN") {
        const user = await prisma.user.findUnique({
          where: { id: decoded.id },
          include: {
            schoolAdmin: { include: { school: true } },
            principal: { include: { school: true } },
            teacher: { include: { school: true } },
            parent: { include: { school: true } },
          },
        })

        if (user) {
          let school
          if (user.schoolAdmin) school = user.schoolAdmin.school
          else if (user.principal) school = user.principal.school
          else if (user.teacher) school = user.teacher.school
          else if (user.parent) school = user.parent.school

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

// Multi-tenant data filter
export const getTenantFilter = (user: AuthRequest["user"]) => {
  if (!user || user.role === "SUPER_ADMIN") {
    return {} // Super admin can access all data
  }

  if (user.schoolId) {
    return { schoolId: user.schoolId }
  }

  return {}
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