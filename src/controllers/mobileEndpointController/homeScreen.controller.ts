import type { Response } from "express"
import { prisma, type AuthRequest, handleError, logger, calculateAge } from "../../utils/setup"
import { UserRole } from "@prisma/client"

/**
 * @route GET /mobile/parent/home
 * @description Get home screen data for the logged-in parent, including their profile and children's summaries.
 * @access Private (Parent only)
 */
export const getHomeScreenData = async (req: AuthRequest, res: Response) => {
  try {
    if (req.user?.role !== UserRole.PARENT) {
      return res.status(403).json({ message: "Access denied. Only parents can view home screen data." })
    }

    const parentUser = await prisma.user.findUnique({
      where: { id: req.user.id },
      select: {
        id: true,
        name: true,
        surname: true,
        email: true,
        profileImageUrl: true,
        role: true,
      },
    })

    if (!parentUser) {
      logger.warn("Parent user not found for home screen", { userId: req.user.id })
      return res.status(404).json({ message: "Parent profile not found." })
    }

    const children = await prisma.student.findMany({
      where: { parentId: req.user.id },
      select: {
        id: true,
        name: true,
        surname: true,
        birthday: true,
        imageUrl: true,
        school: {
          select: {
            id: true,
            name: true,
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

    const childrenDataPromises = children.map(async (child) => {
      const age = calculateAge(child.birthday)

      // --- Attendance Summary (last 30 days) ---
      const thirtyDaysAgo = new Date()
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)

      const attendanceSummary = await prisma.attendance.groupBy({
        by: ["present"],
        where: {
          studentId: child.id,
          date: {
            gte: thirtyDaysAgo,
            lte: new Date(),
          },
        },
        _count: { present: true },
      })

      const totalAttendanceDays = attendanceSummary.reduce((sum, record) => sum + record._count.present, 0)
      const presentDays = attendanceSummary.find((s) => s.present)?._count.present || 0
      const absentDays = totalAttendanceDays - presentDays // Calculate absent days based on total and present
      const attendanceRate = totalAttendanceDays > 0 ? ((presentDays / totalAttendanceDays) * 100).toFixed(2) : "0.00"

      // --- Assignment Summary ---
      const totalAssignments = await prisma.assignment.count({
        where: {
          OR: [
            { classId: child.class?.id }, // Corrected: Access id from the nested 'class' object
            { assignmentType: "CLASS_WIDE", schoolId: child.school?.id }, // Corrected: Access id from the nested 'school' object
          ],
        },
      })

      const submittedAssignments = await prisma.assignmentSubmission.count({
        where: {
          studentId: child.id,
          assignment: {
            OR: [
              { classId: child.class?.id }, // Corrected: Access id from the nested 'class' object
              { assignmentType: "CLASS_WIDE", schoolId: child.school?.id }, // Corrected: Access id from the nested 'school' object
            ],
          },
        },
      })

      const percentageCompleted =
        totalAssignments > 0 ? ((submittedAssignments / totalAssignments) * 100).toFixed(2) : "0.00"

      // --- Fee Information ---
      let feeStatus = {
        status: "Up-to-date" as string,
        outstandingAmount: 0,
        lastPaymentDate: null as string | null,
      }

      try {
        // Get current academic year for the child's school
        const currentAcademicYear = await prisma.academicYear.findFirst({
          where: {
            schoolId: child.school?.id,
            isActive: true
          }
        })

        if (currentAcademicYear) {
          // Get fee structures for this academic year and school
          const feeStructures = await prisma.feeStructure.findMany({
            where: {
              schoolId: child.school?.id,
              academicYearId: currentAcademicYear.id
            },
            include: {
              feeBreakdownItems: {
                include: {
                  studentOverrides: {
                    where: { studentId: child.id }
                  }
                }
              },
              payments: {
                where: {
                  parentId: req.user!.id,
                  status: "COMPLETED"
                },
                orderBy: { paymentDate: 'desc' },
                take: 1
              }
            }
          })

          if (feeStructures.length > 0) {
            // Calculate total outstanding amount for this student
            let totalOutstanding = 0
            let lastPaymentDate = null

            for (const feeStructure of feeStructures) {
              for (const item of feeStructure.feeBreakdownItems) {
                const override = item.studentOverrides[0]
                const amount = override?.isExempt ? 0 :
                              (override?.overrideAmount ? Number(override.overrideAmount) : Number(item.amount))

                // For recurring items, check if paid for current period
                if (item.isRecurring && item.frequency) {
                  // Simplified: assume monthly items need payment if no recent payment
                  const recentPayment = feeStructure.payments[0]
                  if (!recentPayment || new Date(recentPayment.paymentDate).getMonth() !== new Date().getMonth()) {
                    totalOutstanding += amount
                  }
                } else {
                  // One-time fees - check if paid
                  const hasPayment = feeStructure.payments.some(p =>
                    p.feeStructureId === feeStructure.id
                  )
                  if (!hasPayment) {
                    totalOutstanding += amount
                  }
                }
              }

              // Track last payment date
              if (feeStructure.payments[0]?.paymentDate) {
                const paymentDate = new Date(feeStructure.payments[0].paymentDate)
                if (!lastPaymentDate || paymentDate > lastPaymentDate) {
                  lastPaymentDate = paymentDate
                }
              }
            }

            feeStatus = {
              status: totalOutstanding > 0 ? "Outstanding" : "Up-to-date",
              outstandingAmount: totalOutstanding,
              lastPaymentDate: lastPaymentDate?.toISOString() || null
            }
          }
        }
      } catch (feeError) {
        logger.warn("Error calculating fee status", { studentId: child.id, error: feeError })
        // Keep default fee status on error
      }

      return {
        id: child.id,
        name: child.name,
        surname: child.surname,
        age,
        imageUrl: child.imageUrl,
        school: child.school,
        class: child.class,
        grade: child.grade,
        attendanceSummary: {
          totalDays: totalAttendanceDays,
          presentDays,
          absentDays,
          attendanceRate: Number.parseFloat(attendanceRate),
        },
        assignmentSummary: {
          totalAssignments,
          submittedAssignments,
          percentageCompleted: Number.parseFloat(percentageCompleted),
        },
        feeStatus,
      }
    })

    const childrenData = await Promise.all(childrenDataPromises)

    logger.info("Home screen data retrieved for parent", { userId: req.user.id, childrenCount: childrenData.length })
    res.status(200).json({
      message: "Home screen data retrieved successfully",
      parentProfile: parentUser,
      childrenData,
    })
  } catch (error) {
    handleError(res, error, "Failed to retrieve home screen data")
  }
}
