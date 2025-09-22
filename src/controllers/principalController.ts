import type { Response } from "express"
import { z } from "zod"
import {
  prisma,
  type AuthRequest,
  handleError,
  logger,
  getTenantFilter,
  hashPassword,
} from "../utils/setup"
import { sendPrincipalWelcomeEmail, generatePassword } from "../utils/emailService"

// Validation Schemas
const createPrincipalSchema = z.object({
  schoolId: z.string().uuid("Invalid school ID"),
  // Required fields for creating new user
  email: z.string().email("Invalid email address"),
  password: z.string().min(6, "Password must be at least 6 characters long").optional(),
  name: z.string().min(1, "Name is required"),
  surname: z.string().min(1, "Surname is required"),
  username: z.string().min(3, "Username must be at least 3 characters long"),

  // Optional principal-specific fields
  profileImageUrl: z.string().url().optional(),
  qualifications: z.string().optional(),
  bio: z.string().optional(),
})

const updatePrincipalSchema = z.object({
  profileImageUrl: z.string().url().optional(),
  qualifications: z.string().optional(),
  bio: z.string().optional(),
})

export const getPrincipals = async (req: AuthRequest, res: Response) => {
  try {
    const page = Number.parseInt(req.query.page as string) || 1
    const limit = Number.parseInt(req.query.limit as string) || 10
    const skip = (page - 1) * limit

    let where: any = {}

    // Apply tenant filtering based on user role
    if (req.user?.role === "SUPER_ADMIN") {
      // Super admin sees all principals, but can filter by schoolId if provided
      const schoolId = req.query.schoolId as string;
      if (schoolId) {
        where.schoolId = schoolId;
      }
    } else if (req.user?.role === "PRINCIPAL") {
      // Principals can only see their own record
      where = { id: req.user.id }
    } else if (req.user?.role === "SCHOOL_ADMIN") {
      // School admins see principals in their school
      where = getTenantFilter(req.user)
    }

    const [principals, total] = await Promise.all([
      prisma.principal.findMany({
        where,
        skip,
        take: limit,
        include: {
          user: {
            select: {
              id: true,
              email: true,
              name: true,
              surname: true,
              username: true,
              profileImageUrl: true,
            },
          },
          school: {
            select: {
              id: true,
              name: true,
            },
          },
          approval: {
            select: {
              status: true,
            },
          },
        },
        orderBy: { user: { name: "asc" } },
      }),
      prisma.principal.count({ where }),
    ])

    logger.info("Principals retrieved", {
      userId: req.user?.id,
      userRole: req.user?.role,
      page,
      limit,
      total,
    })

    res.status(200).json({
      message: "Principals retrieved successfully",
      principals,
      pagination: { page, limit, total, pages: Math.ceil(total / limit) },
    })
  } catch (error) {
    handleError(res, error, "Failed to retrieve principals")
  }
}

export const getPrincipalById = async (req: AuthRequest, res: Response) => {
  const { id } = req.params
  try {
    const principal = await prisma.principal.findUnique({
      where: { id },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            name: true,
            surname: true,
            username: true,
            profileImageUrl: true,
          },
        },
        school: {
          select: {
            id: true,
            name: true,
          },
        },
        approval: {
          select: {
            status: true,
          },
        },
      },
    })

    if (!principal) {
      logger.warn("Principal not found", { userId: req.user?.id, principalId: id })
      return res.status(404).json({ message: "Principal not found" })
    }

    logger.info("Principal retrieved", { userId: req.user?.id, principalId: id })
    res.status(200).json({ message: "Principal retrieved successfully", principal })
  } catch (error) {
    handleError(res, error, "Failed to retrieve principal")
  }
}

export const createPrincipal = async (req: AuthRequest, res: Response) => {
  try {
    const data = createPrincipalSchema.parse(req.body)
    const { email, password, name, surname, username, schoolId, profileImageUrl, ...principalDetails } = data

    // Verify school exists
    const school = await prisma.school.findUnique({ where: { id: schoolId } })
    if (!school) {
      throw new Error("School not found")
    }

    // Generate password if not provided
    const generatedPassword = password || generatePassword()
    const plainPassword = generatedPassword // Store for email

    // Create principal and user in a transaction
    const principal = await prisma.$transaction(async (tx) => {
      // Check if user with this email already exists
      const existingUserByEmail = await tx.user.findUnique({ where: { email } })
      if (existingUserByEmail) {
        throw new Error("User with this email already exists")
      }

      // Check if user with this username already exists
      const existingUserByUsername = await tx.user.findUnique({ where: { username } })
      if (existingUserByUsername) {
        throw new Error("User with this username already exists")
      }

      // Create new user with PRINCIPAL role
      const hashedPassword = await hashPassword(generatedPassword)
      const newUser = await tx.user.create({
        data: {
          email,
          passwordHash: hashedPassword,
          name,
          surname,
          username,
          role: "PRINCIPAL",
          profileImageUrl: profileImageUrl || null,
        },
      })

      // Create principal record
      const newPrincipal = await tx.principal.create({
        data: {
          id: newUser.id,
          schoolId: schoolId,
          qualifications: principalDetails.qualifications,
          bio: principalDetails.bio,
        },
        include: {
          user: {
            select: {
              id: true,
              email: true,
              name: true,
              surname: true,
              username: true,
              profileImageUrl: true,
            },
          },
          school: {
            select: {
              id: true,
              name: true,
            },
          },
        },
      })

      return newPrincipal
    })

    // Send welcome email
    try {
      await sendPrincipalWelcomeEmail(
        email,
        name,
        surname,
        school.name,
        plainPassword
      )
      logger.info("Welcome email sent to new principal", {
        principalEmail: email,
        schoolName: school.name,
      })
    } catch (emailError) {
      logger.error("Failed to send welcome email to principal", {
        principalEmail: email,
        error: emailError instanceof Error ? emailError.message : 'Unknown error',
      })
      // Don't fail the registration if email fails
    }

    logger.info("Principal created", { userId: req.user?.id, principalId: principal.id })
    res.status(201).json({
      message: "Principal created successfully",
      principal,
      ...(password ? {} : { generatedCredentials: { email, password: plainPassword } })
    })
  } catch (error) {
    if (error instanceof z.ZodError) {
      logger.warn("Invalid input for principal creation", { userId: req.user?.id, errors: error.errors })
      return res.status(400).json({ message: "Invalid input", errors: error.errors })
    }
    handleError(res, error, "Failed to create principal")
  }
}

export const updatePrincipal = async (req: AuthRequest, res: Response) => {
  const { id } = req.params
  try {
    const data = updatePrincipalSchema.parse(req.body)

    // Update principal and user profileImageUrl in a transaction
    const principal = await prisma.$transaction(async (tx) => {
      const updatedPrincipal = await tx.principal.update({
        where: { id },
        data: {
          qualifications: data.qualifications,
          bio: data.bio,
        },
        include: {
          user: {
            select: {
              id: true,
              email: true,
              name: true,
              surname: true,
              username: true,
              profileImageUrl: true,
            },
          },
          school: {
            select: {
              id: true,
              name: true,
            },
          },
        },
      })

      // Update user's profileImageUrl if provided
      if (data.profileImageUrl) {
        await tx.user.update({
          where: { id },
          data: { profileImageUrl: data.profileImageUrl },
        })
      }

      return updatedPrincipal
    })

    logger.info("Principal updated", { userId: req.user?.id, principalId: id })
    res.status(200).json({ message: "Principal updated successfully", principal })
  } catch (error) {
    if (error instanceof z.ZodError) {
      logger.warn("Invalid input for principal update", { userId: req.user?.id, errors: error.errors })
      return res.status(400).json({ message: "Invalid input", errors: error.errors })
    }
    handleError(res, error, "Failed to update principal")
  }
}

export const deletePrincipal = async (req: AuthRequest, res: Response) => {
  const { id } = req.params
  try {
    // Delete principal record (this will also handle cascading deletes based on schema)
    await prisma.principal.delete({ where: { id } })

    logger.info("Principal deleted", { userId: req.user?.id, principalId: id })
    res.status(200).json({ message: "Principal deleted successfully" })
  } catch (error) {
    handleError(res, error, "Failed to delete principal")
  }
}

const verifyPrincipalSchema = z.object({
  status: z.enum(["APPROVED", "REJECTED"]).describe("The verification status of the principal"),
  comments: z.string().optional().describe("Optional comments for the verification status"),
})

export const verifyPrincipal = async (req: AuthRequest, res: Response) => {
  const { id } = req.params
  try {
    // Only school admins and super admins can verify principals
    if (!["SCHOOL_ADMIN", "SUPER_ADMIN"].includes(req.user?.role || "")) {
      return res.status(403).json({
        message: "Only school administrators can verify principals",
      })
    }

    const data = verifyPrincipalSchema.parse(req.body)

    // For non-super admins, ensure they can only verify principals in their school
    let where: any = { id }
    if (req.user?.role !== "SUPER_ADMIN") {
      where = { ...where, schoolId: req.user?.schoolId }
    }

    const principal = await prisma.principal.findUnique({
      where,
      include: { user: true, approval: true },
    })

    if (!principal) {
      return res.status(404).json({ message: "Principal not found" })
    }

    // Update principal approval status
    if (principal.approval) {
      await prisma.approval.update({
        where: { principalId: principal.id },
        data: {
          status: data.status,
          approvedAt: data.status === "APPROVED" ? new Date() : null,
          rejectedAt: data.status === "REJECTED" ? new Date() : null,
          comments: data.comments,
        },
      })
    }

    // Create notification for principal
    const notificationTitle =
      data.status === "APPROVED" ? "Principal Verification Approved" : "Principal Verification Rejected"

    const notificationContent =
      data.status === "APPROVED"
        ? "Congratulations! Your principal account has been verified and is now active."
        : `Your principal verification was rejected. ${data.comments || "Please contact your school administration for more information."}`

    await prisma.notification.create({
      data: {
        userId: principal.id,
        title: notificationTitle,
        content: notificationContent,
        type: "APPROVAL",
      },
    })

    logger.info("Principal verification updated", {
      userId: req.user?.id,
      principalId: id,
      status: data.status,
      comments: data.comments,
    })

    res.status(200).json({
      message: `Principal ${data.status.toLowerCase()} successfully`,
      principal: {
        id: principal.id,
        user: {
          name: principal.user.name,
          surname: principal.user.surname,
          email: principal.user.email,
        },
        approvalStatus: data.status,
      },
    })
  } catch (error) {
    if (error instanceof z.ZodError) {
      logger.warn("Invalid input for principal verification", {
        userId: req.user?.id,
        errors: error.errors,
      })
      return res.status(400).json({ message: "Invalid input", errors: error.errors })
    }
    handleError(res, error, "Failed to verify principal")
  }
}