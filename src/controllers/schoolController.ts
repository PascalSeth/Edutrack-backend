import type { Response, Express } from "express"
import { z } from "zod"
import {
  prisma,
  type AuthRequest,
  handleError,
  logger,
  getTenantFilter,
  getPagination,
  createPaginationResult,
  getParentSchoolIds, // Declare the variable here
} from "../utils/setup"
import { supabase } from "../config/supabase"

// Validation Schemas
const registerSchoolSchema = z.object({
  name: z.string().min(1, "School name is required"),
  address: z.string().min(1, "Address is required"),
  city: z.string().min(1, "City is required"),
  state: z.string().min(1, "State is required"),
  country: z.string().min(1, "Country is required"),
  postalCode: z.string().optional(),
  phone: z.string().optional(),
  email: z.string().email("Invalid email").optional(),
  website: z.string().url("Invalid URL").optional(),
  schoolType: z
    .enum(["PRIMARY", "SECONDARY", "MONTESSORI", "INTERNATIONAL", "TECHNICAL", "UNIVERSITY", "OTHER"])
    .optional(),
  missionStatement: z.string().optional(),
  virtualTourUrl: z.string().url("Invalid URL").optional(),
  adminUserId: z.string().uuid("Invalid user ID").optional(),
})

const updateSchoolSchema = z.object({
  name: z.string().min(1).optional(),
  address: z.string().min(1).optional(),
  city: z.string().min(1).optional(),
  state: z.string().min(1).optional(),
  country: z.string().optional(),
  postalCode: z.string().optional(),
  phone: z.string().optional(),
  email: z.string().email().optional(),
  website: z.string().url().optional(),
  schoolType: z
    .enum(["PRIMARY", "SECONDARY", "MONTESSORI", "INTERNATIONAL", "TECHNICAL", "UNIVERSITY", "OTHER"])
    .optional(),
  missionStatement: z.string().optional(),
  virtualTourUrl: z.string().url().optional(),
  welcomeMessage: z.string().optional(),
  brandColors: z
    .object({
      primary: z.string(),
      secondary: z.string(),
      accent: z.string(),
    })
    .optional(),
})

const verifySchoolSchema = z.object({
  status: z.enum(["APPROVED", "REJECTED"]),
  comments: z.string().optional(),
})

export const getSchools = async (req: AuthRequest, res: Response) => {
  try {
    const { page, limit, skip } = getPagination({
      page: Number.parseInt(req.query.page as string),
      limit: Number.parseInt(req.query.limit as string),
    })

    const status = req.query.status as string
    const schoolType = req.query.schoolType as string

    let where: any = {}

    // Apply role-based filtering
    if (req.user?.role === "SUPER_ADMIN") {
      // Super admin sees all schools
      where = {
        ...(status && { registrationStatus: status as any }),
        ...(schoolType && { schoolType: schoolType as any }),
      }
    } else if (req.user?.role === "PARENT") {
      // Parents see only schools where their children are enrolled
      const schoolIds = await getParentSchoolIds(req.user.id)
      where = {
        id: { in: schoolIds },
        ...(status && { registrationStatus: status as any }),
        ...(schoolType && { schoolType: schoolType as any }),
      }
    } else {
      // School-based roles see only their school
      const filter = getTenantFilter(req.user)
      where = {
        ...filter,
        ...(status && { registrationStatus: status as any }),
        ...(schoolType && { schoolType: schoolType as any }),
      }
    }

    const [schools, total] = await Promise.all([
      prisma.school.findMany({
        where,
        skip,
        take: limit,
        select: {
          id: true,
          name: true,
          address: true,
          city: true,
          state: true,
          country: true,
          logoUrl: true,
          schoolType: true,
          registrationStatus: true,
          isVerified: true,
          createdAt: true,
          _count: {
            select: {
              students: true,
              teachers: true,
            },
          },
        },
        orderBy: { createdAt: "desc" },
      }),
      prisma.school.count({ where }),
    ])

    logger.info("Schools retrieved", {
      userId: req.user?.id,
      userRole: req.user?.role,
      page,
      limit,
      total,
    })

    res.status(200).json({
      message: "Schools retrieved successfully",
      schools,
      pagination: createPaginationResult(page, limit, total),
    })
  } catch (error) {
    handleError(res, error, "Failed to retrieve schools")
  }
}

export const getSchoolById = async (req: AuthRequest, res: Response) => {
  const { id } = req.params
  try {
    const filter = getTenantFilter(req.user)

    // For non-super admins, ensure they can only access their own school
    const where = req.user?.role === "SUPER_ADMIN" ? { id } : { id, ...filter }

    const school = await prisma.school.findUnique({
      where,
      include: {
        schoolAdmin: true,
        principals: {
          include: {
            user: {
              select: { id: true, name: true, surname: true, email: true },
            },
          },
        },
        subscription: true,
        _count: {
          select: {
            students: true,
            teachers: true,
            classes: true,
            grades: true,
          },
        },
      },
    })

    if (!school) {
      logger.warn("School not found or access denied", {
        userId: req.user?.id,
        schoolId: id,
        userRole: req.user?.role,
      })
      return res.status(404).json({ message: "School not found" })
    }

    logger.info("School retrieved", { userId: req.user?.id, schoolId: id })
    res.status(200).json({ message: "School retrieved successfully", school })
  } catch (error) {
    handleError(res, error, "Failed to retrieve school")
  }
}

export const registerSchool = async (req: AuthRequest, res: Response) => {
  try {
    const data = registerSchoolSchema.parse(req.body)

    // Check if school with same name already exists
    const existingSchool = await prisma.school.findFirst({
      where: {
        name: data.name,
        city: data.city,
        state: data.state,
      },
    })

    if (existingSchool) {
      return res.status(409).json({
        message: "A school with this name already exists in this location",
      })
    }

    const school = await prisma.$transaction(async (tx) => {
      // Create school
      const newSchool = await tx.school.create({
        data: {
          name: data.name,
          address: data.address,
          city: data.city,
          state: data.state,
          country: data.country,
          postalCode: data.postalCode,
          phone: data.phone,
          email: data.email,
          website: data.website,
          schoolType: data.schoolType,
          missionStatement: data.missionStatement,
          virtualTourUrl: data.virtualTourUrl,
          registrationStatus: "PENDING",
        },
      })

      // If admin user is provided, create school admin relationship
      if (data.adminUserId) {
        const user = await tx.user.findUnique({
          where: { id: data.adminUserId },
        })

        if (!user) {
          throw new Error("Admin user not found")
        }

        // Update user role to SCHOOL_ADMIN if not already
        // IF ADMIN IS SUPERADMIN DO NOT CHANGE ROLE
        if (user.role !== "SCHOOL_ADMIN" && user.role !== "SUPER_ADMIN") {
          await tx.user.update({
            where: { id: data.adminUserId },
            data: { role: "SCHOOL_ADMIN" },
          })
        }
        // Create school admin record
        await tx.schoolAdmin.create({
          data: {
            id: data.adminUserId,
            schoolId: newSchool.id,
          },
        })
      }

      return newSchool
    })

    logger.info("School registered", {
      userId: req.user?.id,
      schoolId: school.id,
      schoolName: school.name,
    })

    res.status(201).json({
      message: "School registered successfully. Awaiting verification.",
      school: {
        id: school.id,
        name: school.name,
        registrationStatus: school.registrationStatus,
      },
    })
  } catch (error) {
    if (error instanceof z.ZodError) {
      logger.warn("Invalid input for school registration", {
        userId: req.user?.id,
        errors: error.errors,
      })
      return res.status(400).json({ message: "Invalid input", errors: error.errors })
    }
    handleError(res, error, "Failed to register school")
  }
}

export const updateSchool = async (req: AuthRequest, res: Response) => {
  const { id } = req.params
  try {
    const data = updateSchoolSchema.parse(req.body)
    const filter = getTenantFilter(req.user)

    // Ensure user can only update their own school (unless super admin)
    const where = req.user?.role === "SUPER_ADMIN" ? { id } : { id, ...filter }

    const school = await prisma.school.update({
      where,
      data: {
        ...data,
        updatedAt: new Date(),
      },
    })

    logger.info("School updated", {
      userId: req.user?.id,
      schoolId: id,
      updatedFields: Object.keys(data),
    })

    res.status(200).json({
      message: "School updated successfully",
      school,
    })
  } catch (error) {
    if (error instanceof z.ZodError) {
      logger.warn("Invalid input for school update", {
        userId: req.user?.id,
        errors: error.errors,
      })
      return res.status(400).json({ message: "Invalid input", errors: error.errors })
    }
    handleError(res, error, "Failed to update school")
  }
}

export const verifySchool = async (req: AuthRequest, res: Response) => {
  const { id } = req.params
  try {
    // Only super admins can verify schools
    if (req.user?.role !== "SUPER_ADMIN") {
      return res.status(403).json({
        message: "Only super administrators can verify schools",
      })
    }

    const data = verifySchoolSchema.parse(req.body)

    // Include schoolAdmin relation in the query
    const school = await prisma.school.update({
      where: { id },
      data: {
        registrationStatus: data.status,
        isVerified: data.status === "APPROVED",
        verifiedAt: data.status === "APPROVED" ? new Date() : null,
        updatedAt: new Date(),
      },
      include: {
        schoolAdmin: true, // Include schoolAdmin to access it in the response
      },
    })

    // Create notification for school admin if one exists
    if (school.schoolAdmin) {
      const notificationTitle =
        data.status === "APPROVED" ? "School Verification Approved" : "School Verification Rejected"

      const notificationContent =
        data.status === "APPROVED"
          ? "Congratulations! Your school has been verified and is now active on EduTrack."
          : `Your school verification was rejected. ${data.comments || "Please contact support for more information."}`

      await prisma.notification.create({
        data: {
          userId: school.schoolAdmin.id,
          title: notificationTitle,
          content: notificationContent,
          type: "APPROVAL",
        },
      })
    }

    logger.info("School verification updated", {
      userId: req.user?.id,
      schoolId: id,
      status: data.status,
      comments: data.comments,
    })

    res.status(200).json({
      message: `School ${data.status.toLowerCase()} successfully`,
      school: {
        id: school.id,
        name: school.name,
        registrationStatus: school.registrationStatus,
        isVerified: school.isVerified,
      },
    })
  } catch (error) {
    if (error instanceof z.ZodError) {
      logger.warn("Invalid input for school verification", {
        userId: req.user?.id,
        errors: error.errors,
      })
      return res.status(400).json({ message: "Invalid input", errors: error.errors })
    }
    handleError(res, error, "Failed to verify school")
  }
}

export const uploadSchoolLogo = async (req: AuthRequest, res: Response) => {
  const { id } = req.params
  try {
    if (!req.file) {
      return res.status(400).json({ message: "No file uploaded" })
    }

    const filter = getTenantFilter(req.user)
    const where = req.user?.role === "SUPER_ADMIN" ? { id } : { id, ...filter }

    // Verify school exists and user has access
    const school = await prisma.school.findUnique({ where })
    if (!school) {
      return res.status(404).json({ message: "School not found" })
    }

    // Upload logo directly to Supabase
    const { data: logoData, error: uploadError } = await supabase.storage
      .from("school-documents")
      .upload(`/logos/${req.file.originalname}-${Date.now()}`, req.file.buffer, {
        cacheControl: "2592000",
        contentType: req.file.mimetype,
      })

    if (uploadError) {
      throw new Error(uploadError.message)
    }

    // Get public URL
    const { data: urlData } = supabase.storage.from("school-documents").getPublicUrl(logoData.path)

    // Update school with new logo URL
    const updatedSchool = await prisma.school.update({
      where: { id },
      data: {
        logoUrl: urlData.publicUrl,
        updatedAt: new Date(),
      },
    })

    // Save file record to database
    await prisma.fileStorage.create({
      data: {
        fileName: logoData.path.split("/").pop() || req.file.originalname,
        originalName: req.file.originalname,
        fileSize: req.file.size,
        mimeType: req.file.mimetype,
        fileUrl: urlData.publicUrl,
        bucketName: "school-documents",
        uploadedById: req.user!.id,
        schoolId: school.id,
        fileCategory: "SCHOOL_LOGO",
      },
    })

    logger.info("School logo uploaded", {
      userId: req.user?.id,
      schoolId: id,
      logoUrl: urlData.publicUrl,
    })

    res.status(200).json({
      message: "School logo uploaded successfully",
      logoUrl: urlData.publicUrl,
      school: updatedSchool,
    })
  } catch (error) {
    handleError(res, error, "Failed to upload school logo")
  }
}

export const uploadAccreditationDocuments = async (req: AuthRequest, res: Response) => {
  const { id } = req.params
  try {
    if (!req.files || !Array.isArray(req.files) || req.files.length === 0) {
      return res.status(400).json({ message: "No files uploaded" })
    }

    const filter = getTenantFilter(req.user)
    const where = req.user?.role === "SUPER_ADMIN" ? { id } : { id, ...filter }

    // Verify school exists and user has access
    const school = await prisma.school.findUnique({ where })
    if (!school) {
      return res.status(404).json({ message: "School not found" })
    }

    // Upload all documents
    const uploadPromises = req.files.map(async (file: Express.Multer.File, index: number) => {
      const { data: docData, error: uploadError } = await supabase.storage
        .from("school-documents")
        .upload(`/accreditation/${school.id}/document-${index + 1}-${Date.now()}-${file.originalname}`, file.buffer, {
          cacheControl: "2592000",
          contentType: file.mimetype,
        })

      if (uploadError) {
        throw new Error(uploadError.message)
      }

      // Get public URL
      const { data: urlData } = supabase.storage.from("school-documents").getPublicUrl(docData.path)

      // Save file record to database
      await prisma.fileStorage.create({
        data: {
          fileName: docData.path.split("/").pop() || file.originalname,
          originalName: file.originalname,
          fileSize: file.size,
          mimeType: file.mimetype,
          fileUrl: urlData.publicUrl,
          bucketName: "school-documents",
          uploadedById: req.user!.id,
          schoolId: school.id,
          fileCategory: "ACCREDITATION",
        },
      })

      return urlData.publicUrl
    })

    const documentUrls = await Promise.all(uploadPromises)

    // Update school with accreditation documents
    const updatedSchool = await prisma.school.update({
      where: { id },
      data: {
        accreditationDocuments: [...school.accreditationDocuments, ...documentUrls],
        updatedAt: new Date(),
      },
    })

    logger.info("Accreditation documents uploaded", {
      userId: req.user?.id,
      schoolId: id,
      documentCount: documentUrls.length,
    })

    res.status(200).json({
      message: "Accreditation documents uploaded successfully",
      documentUrls,
      school: updatedSchool,
    })
  } catch (error) {
    handleError(res, error, "Failed to upload accreditation documents")
  }
}

export const deleteSchool = async (req: AuthRequest, res: Response) => {
  const { id } = req.params
  try {
    // Only super admins can delete schools
    if (req.user?.role !== "SUPER_ADMIN") {
      return res.status(403).json({
        message: "Only super administrators can delete schools",
      })
    }

    // Get school data before deletion for cleanup
    const school = await prisma.school.findUnique({
      where: { id },
      select: {
        logoUrl: true,
        accreditationDocuments: true,
      },
    })

    if (!school) {
      return res.status(404).json({ message: "School not found" })
    }

    // Delete school (cascade will handle related records)
    await prisma.school.delete({ where: { id } })

    // TODO: Clean up files from Supabase storage
    // This would involve deleting logo and accreditation documents

    logger.info("School deleted", {
      userId: req.user?.id,
      schoolId: id,
    })

    res.status(200).json({ message: "School deleted successfully" })
  } catch (error) {
    handleError(res, error, "Failed to delete school")
  }
}

export const getSchoolStats = async (req: AuthRequest, res: Response) => {
  const { id } = req.params
  try {
    const filter = getTenantFilter(req.user)
    const where = req.user?.role === "SUPER_ADMIN" ? { id } : { id, ...filter }

    const school = await prisma.school.findUnique({
      where,
      include: {
        _count: {
          select: {
            students: true,
            teachers: true,
            classes: true,
            grades: true,
            subjects: true,
            events: true,
            announcements: true,
            payments: true,
          },
        },
      },
    })

    if (!school) {
      return res.status(404).json({ message: "School not found" })
    }

    // Get parent count separately through students
    const parentCount = await prisma.parent.count({
      where: {
        children: {
          some: {
            schoolId: id,
          },
        },
      },
    })

    // Get additional stats
    const [totalRevenue, pendingPayments, recentActivity] = await Promise.all([
      prisma.payment.aggregate({
        where: {
          schoolId: id,
          status: "COMPLETED",
        },
        _sum: { amount: true },
      }),
      prisma.payment.count({
        where: {
          schoolId: id,
          status: "PENDING",
        },
      }),
      prisma.notification.count({
        where: {
          user: {
            OR: [
              { teacher: { schoolId: id } },
              {
                parent: {
                  children: {
                    some: {
                      schoolId: id,
                    },
                  },
                },
              },
              { principal: { schoolId: id } },
              { schoolAdmin: { schoolId: id } },
            ],
          },
          createdAt: {
            gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000), // Last 7 days
          },
        },
      }),
    ])

    const stats = {
      school: {
        id: school.id,
        name: school.name,
        registrationStatus: school.registrationStatus,
        isVerified: school.isVerified,
      },
      counts: {
        ...school._count,
        parents: parentCount, // Add parent count separately
      },
      financial: {
        totalRevenue: totalRevenue._sum.amount || 0,
        pendingPayments,
      },
      activity: {
        recentNotifications: recentActivity,
      },
    }

    logger.info("School stats retrieved", {
      userId: req.user?.id,
      schoolId: id,
    })

    res.status(200).json({
      message: "School statistics retrieved successfully",
      stats,
    })
  } catch (error) {
    handleError(res, error, "Failed to retrieve school statistics")
  }
}
