import type { Response } from "express"
import { prisma, type AuthRequest, handleError, logger, calculateAge } from "../../utils/setup"
import { UserRole } from "@prisma/client"

/**
 * @route GET /mobile/parent/children
 * @description Get a list of children associated with the logged-in parent, including their basic info.
 * @access Private (Parent only)
 */
export const getParentChildren = async (req: AuthRequest, res: Response) => {
  try {
    if (req.user?.role !== UserRole.PARENT) {
      return res.status(403).json({ message: "Access denied. Only parents can view their children." })
    }

    const children = await prisma.student.findMany({
      where: { parentId: req.user.id },
      select: {
        id: true,
        name: true,
        surname: true,
        birthday: true,
        imageUrl: true,
        registrationNumber: true,
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
          },
        },
        grade: {
          select: {
            id: true,
            name: true,
            level: true,
          },
        },
      },
      orderBy: [{ school: { name: "asc" } }, { name: "asc" }],
    })

    const childrenWithAge = children.map((child) => ({
      id: child.id,
      name: child.name,
      surname: child.surname,
      birthday: child.birthday,
      age: calculateAge(child.birthday), // Calculate age from DOB
      imageUrl: child.imageUrl,
      registrationNumber: child.registrationNumber,
      school: child.school,
      class: child.class,
      grade: child.grade,
    }))

    logger.info("Children list retrieved for parent", { userId: req.user.id, childrenCount: childrenWithAge.length })
    res.status(200).json({
      message: "Children list retrieved successfully",
      children: childrenWithAge,
    })
  } catch (error) {
    handleError(res, error, "Failed to retrieve children list")
  }
}
