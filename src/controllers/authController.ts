import type { Response } from "express"
import { z } from "zod"
import bcrypt from "bcrypt"
import jwt from "jsonwebtoken"
import { prisma, type AuthRequest, handleError, logger, createNotification } from "../utils/setup"
import { UserRole } from "@prisma/client"

// Define JWT payload interface to match token structure
interface JwtPayload {
  id: string
  role: UserRole
  schoolId?: string
  tenantId?: string
}

// Enhanced validation schemas
const registerSchema = z.object({
  email: z.string().email("Invalid email").min(1, "Email is required"),
  username: z.string().min(3, "Username must be at least 3 characters"),
  password: z.string().min(8, "Password must be at least 8 characters"),
  name: z.string().min(1, "Name is required"),
  surname: z.string().min(1, "Surname is required"),
  role: z.enum(["SUPER_ADMIN", "SCHOOL_ADMIN", "PRINCIPAL", "TEACHER", "PARENT"], { message: "Invalid role" }),
  phone: z.string().optional(),
  address: z.string().optional(),
  // Make schoolId optional but validate it based on role
  schoolId: z.string().uuid("Invalid school ID").optional(),
  qualifications: z.string().optional(),
  bio: z.string().optional(),
  childDetails: z
    .array(
      z.object({
        name: z.string(),
        surname: z.string(),
        studentId: z.string().optional(),
        class: z.string().optional(),
      }),
    )
    .optional(),
}).refine(
  (data) => {
    // SUPER_ADMIN doesn't need schoolId, all others do
    if (data.role === "SUPER_ADMIN") {
      return true; // No schoolId validation needed for SUPER_ADMIN
    }
    return data.schoolId !== undefined; // All other roles require schoolId
  },
  {
    message: "School ID is required for all roles except SUPER_ADMIN",
    path: ["schoolId"],
  }
)

const loginSchema = z.object({
  email: z.string().email("Invalid email").min(1, "Email is required"),
  password: z.string().min(1, "Password is required"),
})

const refreshTokenSchema = z.object({
  refreshToken: z.string().min(1, "Refresh token is required"),
})

const requestPasswordResetSchema = z.object({
  email: z.string().email("Invalid email").min(1, "Email is required"),
})

const resetPasswordSchema = z.object({
  token: z.string().min(1, "Reset token is required"),
  newPassword: z.string().min(8, "Password must be at least 8 characters"),
})

const generateTokens = (user: JwtPayload) => {
  const accessToken = jwt.sign(
    {
      id: user.id,
      role: user.role,
      ...(user.schoolId ? { schoolId: user.schoolId } : {}),
      ...(user.tenantId ? { tenantId: user.tenantId } : {}),
    },
    process.env.JWT_SECRET!,
    { expiresIn: "15m" },
  )

  const refreshToken = jwt.sign(
    {
      id: user.id,
      role: user.role,
      ...(user.schoolId ? { schoolId: user.schoolId } : {}),
      ...(user.tenantId ? { tenantId: user.tenantId } : {}),
    },
    process.env.JWT_REFRESH_SECRET!,
    { expiresIn: "7d" },
  )

  return { accessToken, refreshToken }
}

export const register = async (req: AuthRequest, res: Response) => {
  try {
    const data = registerSchema.parse(req.body)

    // Check if user already exists
    const existingUser = await prisma.user.findFirst({
      where: {
        OR: [{ email: data.email }, { username: data.username }],
      },
    })

    if (existingUser) {
      logger.warn("Registration failed: Email or username already exists", {
        email: data.email,
        username: data.username,
      })
      return res.status(409).json({ message: "Email or username already exists" })
    }

    // Validate school exists if schoolId provided (not needed for SUPER_ADMIN)
    let school = null
    if (data.schoolId) {
      school = await prisma.school.findUnique({
        where: { id: data.schoolId },
      })
      if (!school) {
        return res.status(400).json({ message: "School not found" })
      }
      if (!school.isVerified) {
        return res.status(400).json({ message: "School is not verified" })
      }
    }

    const passwordHash = await bcrypt.hash(data.password, 12)

    const user = await prisma.$transaction(async (tx) => {
      // Create user
      const newUser = await tx.user.create({
        data: {
          email: data.email,
          username: data.username,
          passwordHash,
          name: data.name,
          surname: data.surname,
          role: data.role,
          phone: data.phone,
          address: data.address,
        },
      })

      // Create role-specific records
      switch (data.role) {
        case "SUPER_ADMIN":
          // SUPER_ADMIN doesn't need any additional role-specific records
          // and doesn't need to be tied to a specific school
          break

        case "SCHOOL_ADMIN":
          if (!data.schoolId) throw new Error("schoolId is required for School Admin")
          await tx.schoolAdmin.create({
            data: {
              id: newUser.id,
              schoolId: data.schoolId,
            },
          })
          break

        case "PRINCIPAL":
          if (!data.schoolId) throw new Error("schoolId is required for Principal")
          const principalRecord = await tx.principal.create({
            data: {
              id: newUser.id,
              schoolId: data.schoolId,
              qualifications: data.qualifications,
              bio: data.bio,
            },
          })

          await tx.approval.create({
            data: {
              principalId: principalRecord.id,
              status: "PENDING",
            },
          })
          break

        case "TEACHER":
          if (!data.schoolId) throw new Error("schoolId is required for Teacher")
          const teacherRecord = await tx.teacher.create({
            data: {
              id: newUser.id,
              schoolId: data.schoolId,
              qualifications: data.qualifications,
              bio: data.bio,
              approvalStatus: "PENDING",
            },
          })

          await tx.approval.create({
            data: {
              teacherId: teacherRecord.id,
              status: "PENDING",
            },
          })
          break

        case "PARENT":
          if (!data.schoolId) throw new Error("schoolId is required for Parent")
          await tx.parent.create({
            data: {
              id: newUser.id,
              schoolId: data.schoolId,
              verificationStatus: "PENDING",
            },
          })
          break
      }

      return newUser
    })

    // Generate tokens with school context (SUPER_ADMIN won't have school context)
    let tokenPayload: JwtPayload = { id: user.id, role: user.role }
    if (school) {
      tokenPayload = {
        ...tokenPayload,
        schoolId: school.id,
        tenantId: school.tenantId,
      }
    }

    const { accessToken, refreshToken } = generateTokens(tokenPayload)

    // Store refresh token
    await prisma.deviceToken.create({
      data: {
        token: refreshToken,
        deviceType: "WEB",
        userId: user.id,
      },
    })

    // Send welcome notification
    const welcomeMessage = data.role === "SUPER_ADMIN" 
      ? "Welcome to EduTrack! Your Super Admin account has been created successfully."
      : `Welcome ${user.name}! Your account has been created successfully. ${
          ["PRINCIPAL", "TEACHER", "PARENT"].includes(user.role)
            ? "Your account is pending approval from the school administration."
            : ""
        }`

    await createNotification(
      user.id,
      "Welcome to EduTrack!",
      welcomeMessage,
      "GENERAL",
    )

    logger.info("User registered", {
      userId: user.id,
      role: user.role,
      schoolId: data.schoolId,
      isSuperAdmin: user.role === "SUPER_ADMIN",
    })

    res.status(201).json({
      message: "User registered successfully",
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
        needsApproval: ["PRINCIPAL", "TEACHER", "PARENT"].includes(user.role),
        isSuperAdmin: user.role === "SUPER_ADMIN",
      },
      accessToken,
      refreshToken,
    })
  } catch (error) {
    if (error instanceof z.ZodError) {
      logger.warn("Invalid input for registration", { errors: error.errors })
      return res.status(400).json({ message: "Invalid input", errors: error.errors })
    }
    handleError(res, error, "Failed to register user")
  }
}

export const login = async (req: AuthRequest, res: Response) => {
  try {
    const data = loginSchema.parse(req.body)

    const user = await prisma.user.findUnique({
      where: { email: data.email },
      include: {
        schoolAdmin: { include: { school: true } },
        principal: { include: { school: true, approval: true } },
        teacher: { include: { school: true, approval: true } },
        parent: { include: { school: true } },
      },
    })

    if (!user) {
      logger.warn("Login failed: User not found", { email: data.email })
      return res.status(401).json({ message: "Invalid credentials" })
    }

    if (!user.isActive) {
      logger.warn("Login failed: User account is inactive", { email: data.email })
      return res.status(401).json({ message: "Account is inactive" })
    }

    const isValidPassword = await bcrypt.compare(data.password, user.passwordHash)
    if (!isValidPassword) {
      logger.warn("Login failed: Invalid password", { email: data.email })
      return res.status(401).json({ message: "Invalid credentials" })
    }

    // Check approval status for roles that require it
    let approvalStatus = null
    let school = null

    // SUPER_ADMIN doesn't have school associations
    if (user.role === "SUPER_ADMIN") {
      school = null
      approvalStatus = "APPROVED" // SUPER_ADMIN is automatically approved
    } else if (user.principal) {
      school = user.principal.school
      approvalStatus = user.principal.approval?.status || "PENDING"
    } else if (user.teacher) {
      school = user.teacher.school
      approvalStatus = user.teacher.approval?.status || "PENDING"
    } else if (user.parent) {
      school = user.parent.school
      approvalStatus = user.parent.verificationStatus
    } else if (user.schoolAdmin) {
      school = user.schoolAdmin.school
    }

    // Check if school is verified (except for super admin)
    if (school && !school.isVerified && user.role !== "SUPER_ADMIN") {
      return res.status(403).json({
        message: "School is not verified. Please contact support.",
      })
    }

    // Generate tokens with school context (SUPER_ADMIN won't have school context)
    let tokenPayload: JwtPayload = { id: user.id, role: user.role }
    if (school) {
      tokenPayload = {
        ...tokenPayload,
        schoolId: school.id,
        tenantId: school.tenantId,
      }
    }

    const { accessToken, refreshToken } = generateTokens(tokenPayload)

    // Store refresh token
    await prisma.deviceToken.create({
      data: {
        token: refreshToken,
        deviceType: "WEB",
        userId: user.id,
      },
    })

    // Update last login
    await prisma.user.update({
      where: { id: user.id },
      data: { lastLogin: new Date() },
    })

    logger.info("User logged in", {
      userId: user.id,
      role: user.role,
      schoolId: school?.id,
      isSuperAdmin: user.role === "SUPER_ADMIN",
    })

    res.status(200).json({
      message: "Login successful",
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        surname: user.surname,
        role: user.role,
        schoolId: school?.id,
        schoolName: school?.name,
        approvalStatus,
        profileImageUrl: user.profileImageUrl,
        isSuperAdmin: user.role === "SUPER_ADMIN",
      },
      accessToken,
      refreshToken,
    })
  } catch (error) {
    if (error instanceof z.ZodError) {
      logger.warn("Invalid input for login", { errors: error.errors })
      return res.status(400).json({ message: "Invalid input", errors: error.errors })
    }
    handleError(res, error, "Failed to login")
  }
}

export const refreshToken = async (req: AuthRequest, res: Response) => {
  try {
    const data = refreshTokenSchema.parse(req.body)

    let decoded: JwtPayload
    try {
      decoded = jwt.verify(data.refreshToken, process.env.JWT_REFRESH_SECRET!) as JwtPayload
    } catch (error) {
      logger.warn("Invalid refresh token", { refreshToken: data.refreshToken })
      return res.status(401).json({ message: "Invalid refresh token" })
    }

    // Verify token exists in database
    const storedToken = await prisma.deviceToken.findUnique({
      where: { token: data.refreshToken },
    })
    if (!storedToken || !storedToken.isActive) {
      logger.warn("Refresh token not found or inactive", { refreshToken: data.refreshToken })
      return res.status(401).json({ message: "Invalid refresh token" })
    }

    // Verify user still exists and is active
    const user = await prisma.user.findUnique({
      where: { id: decoded.id },
      include: {
        schoolAdmin: { include: { school: true } },
        principal: { include: { school: true } },
        teacher: { include: { school: true } },
        parent: { include: { school: true } },
      },
    })

    if (!user || !user.isActive) {
      logger.warn("User not found or inactive for refresh token", { userId: decoded.id })
      return res.status(401).json({ message: "User not found" })
    }

    // Update school context if needed (SUPER_ADMIN won't have school context)
    let school = null
    if (user.role !== "SUPER_ADMIN") {
      if (user.schoolAdmin) school = user.schoolAdmin.school
      else if (user.principal) school = user.principal.school
      else if (user.teacher) school = user.teacher.school
      else if (user.parent) school = user.parent.school
    }

    let tokenPayload: JwtPayload = { id: user.id, role: user.role }
    if (school) {
      tokenPayload = {
        ...tokenPayload,
        schoolId: school.id,
        tenantId: school.tenantId,
      }
    }

    const accessToken = jwt.sign(tokenPayload, process.env.JWT_SECRET!, {
      expiresIn: "15m",
    })

    // Update token last used
    await prisma.deviceToken.update({
      where: { token: data.refreshToken },
      data: { lastUsed: new Date() },
    })

    logger.info("Access token refreshed", { 
      userId: user.id,
      isSuperAdmin: user.role === "SUPER_ADMIN"
    })
    res.status(200).json({
      message: "Token refreshed successfully",
      accessToken,
    })
  } catch (error) {
    if (error instanceof z.ZodError) {
      logger.warn("Invalid input for token refresh", { errors: error.errors })
      return res.status(400).json({ message: "Invalid input", errors: error.errors })
    }
    handleError(res, error, "Failed to refresh token")
  }
}

export const logout = async (req: AuthRequest, res: Response) => {
  try {
    const refreshToken = req.body.refreshToken
    if (!refreshToken) {
      logger.warn("No refresh token provided for logout", { userId: req.user?.id })
      return res.status(400).json({ message: "Refresh token required" })
    }

    // Deactivate the refresh token
    await prisma.deviceToken.updateMany({
      where: {
        token: refreshToken,
        userId: req.user?.id,
      },
      data: { isActive: false },
    })

    logger.info("User logged out", { userId: req.user?.id })
    res.status(200).json({ message: "Logout successful" })
  } catch (error) {
    handleError(res, error, "Failed to logout")
  }
}

export const requestPasswordReset = async (req: AuthRequest, res: Response) => {
  try {
    const data = requestPasswordResetSchema.parse(req.body)

    const user = await prisma.user.findUnique({ where: { email: data.email } })
    if (!user) {
      logger.warn("Password reset requested for non-existent email", { email: data.email })
      return res.status(200).json({
        message: "If the email exists, a reset link will be sent",
      })
    }

    const resetToken = jwt.sign({ id: user.id, email: user.email }, process.env.JWT_RESET_SECRET!, { expiresIn: "1h" })

    logger.info("Password reset token generated", {
      userId: user.id,
      email: user.email,
    })

    res.status(200).json({
      message: "Password reset token generated",
      resetToken, // Remove in production
    })
  } catch (error) {
    if (error instanceof z.ZodError) {
      logger.warn("Invalid input for password reset request", { errors: error.errors })
      return res.status(400).json({ message: "Invalid input", errors: error.errors })
    }
    handleError(res, error, "Failed to request password reset")
  }
}

export const resetPassword = async (req: AuthRequest, res: Response) => {
  try {
    const data = resetPasswordSchema.parse(req.body)

    let decoded: { id: string; email: string }
    try {
      decoded = jwt.verify(data.token, process.env.JWT_RESET_SECRET!) as any
    } catch (error) {
      logger.warn("Invalid reset token", { token: data.token })
      return res.status(401).json({ message: "Invalid or expired reset token" })
    }

    const user = await prisma.user.findUnique({
      where: {
        id: decoded.id,
        email: decoded.email,
      },
    })

    if (!user) {
      logger.warn("User not found for password reset", { userId: decoded.id })
      return res.status(404).json({ message: "User not found" })
    }

    const passwordHash = await bcrypt.hash(data.newPassword, 12)

    await prisma.$transaction(async (tx) => {
      await tx.user.update({
        where: { id: user.id },
        data: { passwordHash },
      })

      await tx.deviceToken.updateMany({
        where: { userId: user.id },
        data: { isActive: false },
      })
    })

    await createNotification(
      user.id,
      "Password Reset Successful",
      "Your password has been reset successfully. If you did not request this change, please contact support immediately.",
      "GENERAL",
    )

    logger.info("Password reset successful", { userId: user.id })
    res.status(200).json({ message: "Password reset successfully" })
  } catch (error) {
    if (error instanceof z.ZodError) {
      logger.warn("Invalid input for password reset", { errors: error.errors })
      return res.status(400).json({ message: "Invalid input", errors: error.errors })
    }
    handleError(res, error, "Failed to reset password")
  }
}