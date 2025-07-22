import type { Response } from "express"
import { prisma, type AuthRequest, handleError, logger, calculateAge } from "../../utils/setup"

export const getParentProfile = async (req: AuthRequest, res: Response) => {
  try {
    if (req.user?.role !== "PARENT") {
      return res.status(403).json({ message: "Access denied. Only parents can access this profile." })
    }

    const parentUser = await prisma.user.findUnique({
      where: { id: req.user.id },
      select: {
        id: true,
        name: true,
        surname: true,
        email: true,
        phone: true,
        address: true,
        profileImageUrl: true,
        createdAt: true,
        // Assuming 'birthday' is on a related 'Parent' model linked to User
        parent: {
          select: {
            birthday: true,
          },
        },
      },
    })

    if (!parentUser) {
      logger.warn("Parent user not found for onboarding profile", { userId: req.user.id })
      return res.status(404).json({ message: "Parent profile not found." })
    }

    // Access birthday from the included parent relation, if it exists
    const age = calculateAge(parentUser.parent?.birthday)

    logger.info("Parent onboarding profile retrieved", { userId: req.user.id })
    res.status(200).json({
      message: "Parent profile retrieved successfully",
      profile: {
        ...parentUser,
        // Flatten the birthday and age into the main profile object for convenience
        birthday: parentUser.parent?.birthday,
        age,
      },
    })
  } catch (error) {
    handleError(res, error, "Failed to retrieve parent onboarding profile")
  }
}
