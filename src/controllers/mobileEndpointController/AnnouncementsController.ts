// import type { Request, Response } from "express"
// import { PrismaClient } from "@prisma/client"

// const prisma = new PrismaClient()

// export const getAnnouncements = async (req: Request, res: Response) => {
//   try {
//     const { schoolId, type, limit = 10, offset = 0 } = req.query

//     if (!schoolId) {
//       return res.status(400).json({ message: "School ID is required." })
//     }

//     const whereClause: any = {
//       schoolId: schoolId as string,
//       publishedAt: {
//         lte: new Date(), // Only show announcements that are published
//       },
//     }

//     if (type) {
//       whereClause.type = String(type).toUpperCase() // Assuming AnnouncementType enum
//     }

//     const announcements = await prisma.announcement.findMany({
//       where: whereClause,
//       select: {
//         id: true,
//         title: true,
//         content: true,
//         priority: true,
//         publishedAt: true,
//         expiresAt: true,
//         createdAt: true,
//         updatedAt: true,
//         // author: {
//         //   select: {
//         //     name: true,
//         //     surname: true,
//         //   },
//         // },
//       },
//       orderBy: {
//         publishedAt: "desc",
//       },
//       take: Number.parseInt(limit as string, 10),
//       skip: Number.parseInt(offset as string, 10),
//     })

//     const formattedAnnouncements = announcements.map((announcement) => ({
//       id: announcement.id,
//       title: announcement.title,
//       content: announcement.content,
//       priority: announcement.priority,
//       publishedAt: announcement.publishedAt,
//       expiresAt: announcement.expiresAt,
//       author: announcement.title ? `${announcement.title}` : "Unknown",
//       createdAt: announcement.createdAt,
//       updatedAt: announcement.updatedAt,
//     }))

//     res.status(200).json({
//       message: "Announcements fetched successfully",
//       data: formattedAnnouncements,
//     })
//   } catch (error: unknown) {
//     console.error("Error fetching announcements:", error)
//     res.status(500).json({ message: "Failed to fetch announcements.", error: (error as Error).message })
//   }
// }
