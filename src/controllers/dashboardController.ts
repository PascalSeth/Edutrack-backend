import type { Response } from "express"
import { prisma, type AuthRequest, handleError, logger, getTenantFilter } from "../utils/setup"

export const getSuperAdminDashboard = async (req: AuthRequest, res: Response) => {
  try {
    if (req.user?.role !== "SUPER_ADMIN") {
      return res.status(403).json({ message: "Access denied" })
    }

    const [
      totalSchools,
      verifiedSchools,
      pendingSchools,
      totalUsers,
      totalStudents,
      totalRevenue,
      recentSchools,
      schoolStats,
    ] = await Promise.all([
      prisma.school.count(),
      prisma.school.count({ where: { isVerified: true } }),
      prisma.school.count({ where: { registrationStatus: "PENDING" } }),
      prisma.user.count(),
      prisma.student.count(),
      prisma.payment.aggregate({
        where: { status: "COMPLETED" },
        _sum: { transactionFee: true },
      }),
      prisma.school.findMany({
        take: 5,
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          name: true,
          city: true,
          registrationStatus: true,
          createdAt: true,
        },
      }),
      prisma.school.groupBy({
        by: ["registrationStatus"],
        _count: { registrationStatus: true },
      }),
    ])

    const dashboard = {
      overview: {
        totalSchools,
        verifiedSchools,
        pendingSchools,
        totalUsers,
        totalStudents,
        totalRevenue: totalRevenue._sum.transactionFee || 0,
      },
      recentSchools,
      schoolStats: schoolStats.reduce(
        (acc, stat) => {
          acc[stat.registrationStatus] = stat._count.registrationStatus
          return acc
        },
        {} as Record<string, number>,
      ),
    }

    logger.info("Super admin dashboard retrieved", { userId: req.user?.id })
    res.status(200).json({
      message: "Super admin dashboard retrieved successfully",
      dashboard,
    })
  } catch (error) {
    handleError(res, error, "Failed to retrieve super admin dashboard")
  }
}

export const getSchoolAdminDashboard = async (req: AuthRequest, res: Response) => {
  try {
    if (req.user?.role !== "SCHOOL_ADMIN") {
      return res.status(403).json({ message: "Access denied" })
    }

    const filter = getTenantFilter(req.user)

    const [
      totalStudents,
      totalTeachers,
      totalParents,
      totalClasses,
      pendingPayments,
      completedPayments,
      recentEvents,
      attendanceRate,
    ] = await Promise.all([
      prisma.student.count({ where: filter }),
      prisma.teacher.count({ where: filter }),
      prisma.$queryRaw<{ count: number }[]>`
        SELECT COUNT(DISTINCT sp."parentId") as count
        FROM "StudentParent" sp
        JOIN "Student" s ON sp."studentId" = s.id
        WHERE s."schoolId" = ${req.user.schoolId}
      `,
      prisma.class.count({ where: filter }),
      prisma.payment.count({
        where: { ...filter, status: "PENDING" },
      }),
      prisma.payment.count({
        where: { ...filter, status: "COMPLETED" },
      }),
      prisma.event.findMany({
        where: {
          ...filter,
          startTime: { gte: new Date() },
        },
        take: 5,
        orderBy: { startTime: "asc" },
        select: {
          id: true,
          title: true,
          startTime: true,
          eventType: true,
        },
      }),
      prisma.$queryRaw`
        SELECT
          CASE
            WHEN COUNT(*) = 0 THEN 0
            ELSE ROUND(
              (COUNT(*) FILTER (WHERE present = true)::decimal / COUNT(*)) * 100, 2
            )
          END as attendance_rate
        FROM "Attendance" a
        JOIN "Student" s ON a."studentId" = s.id
        WHERE s."schoolId" = ${req.user.schoolId}
          AND a.date >= NOW() - INTERVAL '30 days'
      `,
    ])

    const dashboard = {
      overview: {
        totalStudents,
        totalTeachers,
        totalParents: (totalParents as any)[0]?.count || 0,
        totalClasses,
        pendingPayments,
        completedPayments,
        attendanceRate: (attendanceRate as any)[0]?.attendance_rate || 0,
      },
      recentEvents,
    }

    logger.info("School admin dashboard retrieved", {
      userId: req.user?.id,
      schoolId: req.user?.schoolId,
    })

    res.status(200).json({
      message: "School admin dashboard retrieved successfully",
      dashboard,
    })
  } catch (error) {
    handleError(res, error, "Failed to retrieve school admin dashboard")
  }
}

export const getPrincipalDashboard = async (req: AuthRequest, res: Response) => {
  try {
    if (req.user?.role !== "PRINCIPAL") {
      return res.status(403).json({ message: "Access denied" })
    }

    const filter = getTenantFilter(req.user)

    const [
      totalStudents,
      totalTeachers,
      totalClasses,
      pendingApprovals,
      recentAssignments,
      upcomingEvents,
      attendanceSummary,
      academicPerformance,
    ] = await Promise.all([
      prisma.student.count({ where: filter }),
      prisma.teacher.count({ where: filter }),
      prisma.class.count({ where: filter }),
      prisma.approval.count({
        where: {
          status: "PENDING",
          OR: [
            { teacher: { schoolId: req.user.schoolId } },
            { assignment: { schoolId: req.user.schoolId } },
            { examQuestion: { schoolId: req.user.schoolId } },
          ],
        },
      }),
      prisma.assignment.findMany({
        where: {
          ...filter,
          createdAt: {
            gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
          },
        },
        take: 5,
        orderBy: { createdAt: "desc" },
        include: {
          teacher: {
            include: { user: { select: { name: true, surname: true } } },
          },
          subject: { select: { name: true } },
        },
      }),
      prisma.event.findMany({
        where: {
          ...filter,
          startTime: { gte: new Date() },
        },
        take: 5,
        orderBy: { startTime: "asc" },
        select: {
          id: true,
          title: true,
          startTime: true,
          eventType: true,
        },
      }),
      prisma.$queryRaw`
        SELECT
          COUNT(*) as total_records,
          COUNT(*) FILTER (WHERE present = true) as present_count,
          CASE
            WHEN COUNT(*) = 0 THEN 0
            ELSE ROUND(
              (COUNT(*) FILTER (WHERE present = true)::decimal / COUNT(*)) * 100, 2
            )
          END as attendance_rate
        FROM "Attendance" a
        JOIN "Student" s ON a."studentId" = s.id
        WHERE s."schoolId" = ${req.user.schoolId}
          AND a.date >= NOW() - INTERVAL '30 days'
      `,
      prisma.$queryRaw`
        SELECT 
          AVG(r.percentage) as average_performance,
          COUNT(r.id) as total_results
        FROM "Result" r
        JOIN "Student" s ON r."studentId" = s.id
        WHERE s."schoolId" = ${req.user.schoolId}
          AND r."uploadedAt" >= NOW() - INTERVAL '30 days'
      `,
    ])

    const dashboard = {
      overview: {
        totalStudents,
        totalTeachers,
        totalClasses,
        pendingApprovals,
        attendanceRate: (attendanceSummary as any)[0]?.attendance_rate || 0,
        averagePerformance: (academicPerformance as any)[0]?.average_performance || 0,
      },
      recentAssignments,
      upcomingEvents,
    }

    logger.info("Principal dashboard retrieved", {
      userId: req.user?.id,
      schoolId: req.user?.schoolId,
    })

    res.status(200).json({
      message: "Principal dashboard retrieved successfully",
      dashboard,
    })
  } catch (error) {
    handleError(res, error, "Failed to retrieve principal dashboard")
  }
}

export const getTeacherDashboard = async (req: AuthRequest, res: Response) => {
  try {
    if (req.user?.role !== "TEACHER") {
      return res.status(403).json({ message: "Access denied" })
    }

    const [myClasses, mySubjects, myAssignments, pendingSubmissions, recentAttendance, upcomingLessons] =
      await Promise.all([
        prisma.class.findMany({
          where: { supervisorId: req.user.id },
          include: {
            grade: { select: { name: true } },
            _count: { select: { students: true } },
          },
        }),
        prisma.subject.findMany({
          where: {
            teachers: { some: { id: req.user.id } },
          },
          include: {
            _count: {
              select: {
                assignments: true,
                lessons: true,
              },
            },
          },
        }),
        prisma.assignment.findMany({
          where: { teacherId: req.user.id },
          take: 5,
          orderBy: { createdAt: "desc" },
          include: {
            subject: { select: { name: true } },
            class: { select: { name: true } },
            _count: { select: { submissions: true } },
          },
        }),
        prisma.assignment.count({
          where: {
            teacherId: req.user.id,
            dueDate: { gte: new Date() },
            submissions: { none: {} },
          },
        }),
        prisma.attendance.findMany({
          where: {
            recordedById: req.user.id,
            date: {
              gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
            },
          },
          include: {
            student: { select: { name: true, surname: true } },
            lesson: {
              include: {
                subject: { select: { name: true } },
                class: { select: { name: true } },
              },
            },
          },
          orderBy: { date: "desc" },
          take: 10,
        }),
        // Get upcoming lessons with timetable information
        prisma.lesson.findMany({
          where: { teacherId: req.user.id },
          include: {
            subject: { select: { name: true } },
            class: { select: { name: true } },
          },
        }),
      ])

    // Get timetable slots for upcoming lessons
    const upcomingTimetableSlots = await prisma.timetableSlot.findMany({
      where: {
        lesson: {
          teacherId: req.user.id,
        },
        startTime: {
          gte: new Date().toISOString(),
          lte: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
        },
      },
      include: {
        lesson: {
          include: {
            subject: { select: { name: true } },
            class: { select: { name: true } },
          },
        },
      },
      orderBy: { startTime: "asc" },
      take: 5,
    })

    const dashboard = {
      overview: {
        totalClasses: myClasses.length,
        totalSubjects: mySubjects.length,
        totalAssignments: myAssignments.length,
        pendingSubmissions,
      },
      myClasses,
      mySubjects,
      recentAssignments: myAssignments,
      recentAttendance,
      upcomingLessons: upcomingTimetableSlots,
    }

    logger.info("Teacher dashboard retrieved", { userId: req.user?.id })
    res.status(200).json({
      message: "Teacher dashboard retrieved successfully",
      dashboard,
    })
  } catch (error) {
    handleError(res, error, "Failed to retrieve teacher dashboard")
  }
}

export const getParentDashboard = async (req: AuthRequest, res: Response) => {
  try {
    if (req.user?.role !== "PARENT") {
      return res.status(403).json({ message: "Access denied" })
    }

    const [children, recentNotifications, upcomingEvents, pendingPayments, recentResults] = await Promise.all([
      // Get all children across different schools
      prisma.student.findMany({
        where: {
          parents: {
            some: { parentId: req.user.id }
          }
        },
        include: {
          school: { select: { id: true, name: true } },
          class: { select: { name: true } },
          grade: { select: { name: true } },
        },
      }),
      prisma.notification.findMany({
        where: { userId: req.user.id },
        take: 5,
        orderBy: { createdAt: "desc" },
      }),
      // Get events from all schools where children are enrolled
      prisma.event.findMany({
        where: {
          startTime: { gte: new Date() },
          school: {
            students: {
              some: {
                parents: {
                  some: { parentId: req.user.id }
                }
              }
            },
          },
        },
        take: 5,
        orderBy: { startTime: "asc" },
        include: {
          school: { select: { name: true } },
        },
      }),
      prisma.payment.findMany({
        where: {
          parentId: req.user.id,
          status: "PENDING",
        },
        include: {
          feeStructure: { select: { name: true, amount: true } },
          school: { select: { name: true } },
        },
      }),
      // Get recent results for all children
      prisma.result.findMany({
        where: {
          student: {
            parents: {
              some: { parentId: req.user.id }
            }
          }
        },
        take: 10,
        orderBy: { uploadedAt: "desc" },
        include: {
          student: { select: { name: true, surname: true } },
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
                take: 1,
              },
            },
          },
        },
      }),
    ])

    // Get attendance summary for each child
    const childrenWithAttendance = await Promise.all(
      children.map(async (child) => {
        const attendanceSummary = await prisma.$queryRaw`
          SELECT
            COUNT(*) as total_days,
            COUNT(*) FILTER (WHERE present = true) as present_days,
            CASE
              WHEN COUNT(*) = 0 THEN 0
              ELSE ROUND(
                (COUNT(*) FILTER (WHERE present = true)::decimal / COUNT(*)) * 100, 2
              )
            END as attendance_rate
          FROM "Attendance"
          WHERE "studentId" = ${child.id}
            AND date >= NOW() - INTERVAL '30 days'
        `

        return {
          ...child,
          attendanceSummary: (attendanceSummary as any)[0] || {
            total_days: 0,
            present_days: 0,
            attendance_rate: 0,
          },
        }
      }),
    )

    const dashboard = {
      overview: {
        totalChildren: children.length,
        schoolsCount: new Set(children.map((child) => child.schoolId)).size,
        pendingPaymentsCount: pendingPayments.length,
        unreadNotifications: recentNotifications.filter((n) => !n.isRead).length,
      },
      children: childrenWithAttendance,
      recentNotifications,
      upcomingEvents,
      pendingPayments,
      recentResults,
    }

    logger.info("Parent dashboard retrieved", {
      userId: req.user?.id,
      childrenCount: children.length,
    })

    res.status(200).json({
      message: "Parent dashboard retrieved successfully",
      dashboard,
    })
  } catch (error) {
    handleError(res, error, "Failed to retrieve parent dashboard")
  }
}
