"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getParentEngagementAnalytics = exports.getClassAnalytics = exports.getStudentAnalytics = exports.getSchoolAnalytics = void 0;
const zod_1 = require("zod");
const setup_1 = require("../utils/setup");
// Validation Schemas
const analyticsQuerySchema = zod_1.z.object({
    startDate: zod_1.z.string().datetime().optional(),
    endDate: zod_1.z.string().datetime().optional(),
    studentId: zod_1.z.string().uuid().optional(),
    classId: zod_1.z.string().uuid().optional(),
    subjectId: zod_1.z.string().uuid().optional(),
});
const getSchoolAnalytics = async (req, res) => {
    try {
        // Only principals and school admins can view school analytics
        if (!["PRINCIPAL", "SCHOOL_ADMIN", "SUPER_ADMIN"].includes(req.user?.role || "")) {
            return res.status(403).json({ message: "Access denied" });
        }
        const filter = (0, setup_1.getTenantFilter)(req.user);
        const schoolId = req.user?.schoolId;
        // Get basic counts
        const [totalStudents, totalTeachers, totalParents, totalClasses, activeAssignments, completedPayments, pendingPayments, recentEvents,] = await Promise.all([
            setup_1.prisma.student.count({ where: filter }),
            setup_1.prisma.teacher.count({ where: filter }),
            // Updated parent count for multi-school support
            setup_1.prisma.parent.count({
                where: {
                    children: {
                        some: { schoolId: req.user?.schoolId },
                    },
                },
            }),
            setup_1.prisma.class.count({ where: filter }),
            setup_1.prisma.assignment.count({
                where: {
                    ...filter,
                    dueDate: { gte: new Date() },
                },
            }),
            setup_1.prisma.payment.count({
                where: {
                    ...filter,
                    status: "COMPLETED",
                },
            }),
            setup_1.prisma.payment.count({
                where: {
                    ...filter,
                    status: "PENDING",
                },
            }),
            setup_1.prisma.event.count({
                where: {
                    ...filter,
                    startTime: {
                        gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), // Last 30 days
                        lte: new Date(),
                    },
                },
            }),
        ]);
        // Get financial analytics
        const [totalRevenue, monthlyRevenue] = await Promise.all([
            setup_1.prisma.payment.aggregate({
                where: {
                    schoolId: req.user?.schoolId,
                    status: "COMPLETED",
                },
                _sum: { amount: true },
            }),
            setup_1.prisma.$queryRaw `
        SELECT 
          DATE_TRUNC('month', "paymentDate") as month,
          SUM(amount) as revenue,
          COUNT(*) as payment_count
        FROM "Payment"
        WHERE "schoolId" = ${schoolId}
          AND status = 'COMPLETED'
          AND "paymentDate" >= NOW() - INTERVAL '12 months'
        GROUP BY DATE_TRUNC('month', "paymentDate")
        ORDER BY month DESC
      `,
        ]);
        // Get attendance analytics
        const attendanceStats = await setup_1.prisma.$queryRaw `
      SELECT 
        COUNT(*) as total_records,
        COUNT(*) FILTER (WHERE present = true) as present_count,
        COUNT(*) FILTER (WHERE present = false) as absent_count,
        ROUND(
          (COUNT(*) FILTER (WHERE present = true)::decimal / COUNT(*)) * 100, 2
        ) as attendance_rate
      FROM "Attendance" a
      JOIN "Student" s ON a."studentId" = s.id
      WHERE s."schoolId" = ${schoolId}
        AND a.date >= NOW() - INTERVAL '30 days'
    `;
        // Get grade distribution
        const gradeDistribution = await setup_1.prisma.$queryRaw `
      SELECT 
        r.grade,
        COUNT(*) as count
      FROM "Result" r
      JOIN "Student" s ON r."studentId" = s.id
      WHERE s."schoolId" = ${schoolId}
        AND r.grade IS NOT NULL
        AND r."uploadedAt" >= NOW() - INTERVAL '3 months'
      GROUP BY r.grade
      ORDER BY r.grade
    `;
        const analytics = {
            overview: {
                totalStudents,
                totalTeachers,
                totalParents,
                totalClasses,
                activeAssignments,
                recentEvents,
            },
            financial: {
                totalRevenue: totalRevenue._sum.amount || 0,
                completedPayments,
                pendingPayments,
                monthlyRevenue,
            },
            attendance: attendanceStats[0] || {
                total_records: 0,
                present_count: 0,
                absent_count: 0,
                attendance_rate: 0,
            },
            academic: {
                gradeDistribution,
            },
        };
        setup_1.logger.info("School analytics retrieved", {
            userId: req.user?.id,
            schoolId: req.user?.schoolId,
        });
        res.status(200).json({
            message: "School analytics retrieved successfully",
            analytics,
        });
    }
    catch (error) {
        (0, setup_1.handleError)(res, error, "Failed to retrieve school analytics");
    }
};
exports.getSchoolAnalytics = getSchoolAnalytics;
const getStudentAnalytics = async (req, res) => {
    const { studentId } = req.params;
    try {
        const data = analyticsQuerySchema.parse(req.query);
        // Verify access to student with enhanced multi-tenant support
        let student;
        if (req.user?.role === "PARENT") {
            student = await setup_1.prisma.student.findFirst({
                where: { id: studentId, parentId: req.user.id },
            });
        }
        else if (req.user?.role === "TEACHER") {
            student = await setup_1.prisma.student.findFirst({
                where: {
                    id: studentId,
                    OR: [
                        {
                            class: { supervisorId: req.user.id },
                        },
                        {
                            class: {
                                lessons: {
                                    some: { teacherId: req.user.id },
                                },
                            },
                        },
                    ],
                },
            });
        }
        else {
            student = await setup_1.prisma.student.findFirst({
                where: {
                    id: studentId,
                    ...(0, setup_1.getTenantFilter)(req.user),
                },
            });
        }
        if (!student) {
            return res.status(404).json({ message: "Student not found or access denied" });
        }
        const dateFilter = data.startDate && data.endDate
            ? {
                createdAt: {
                    gte: new Date(data.startDate),
                    lte: new Date(data.endDate),
                },
            }
            : {};
        // Get academic performance
        const [totalAssignments, submittedAssignments, averageScore, recentResults, attendanceRate, subjectPerformance] = await Promise.all([
            // Total assignments for student's class
            setup_1.prisma.assignment.count({
                where: {
                    OR: [{ classId: student.classId }, { assignmentType: "CLASS_WIDE", schoolId: student.schoolId }],
                    ...dateFilter,
                },
            }),
            // Submitted assignments
            setup_1.prisma.assignmentSubmission.count({
                where: {
                    studentId: studentId,
                    assignment: dateFilter.createdAt
                        ? {
                            createdAt: dateFilter.createdAt,
                        }
                        : {},
                },
            }),
            // Average score
            setup_1.prisma.result.aggregate({
                where: {
                    studentId: studentId,
                    ...dateFilter,
                },
                _avg: { percentage: true },
            }),
            // Recent results (last 10)
            setup_1.prisma.result.findMany({
                where: {
                    studentId: studentId,
                    ...dateFilter,
                },
                include: {
                    assignment: {
                        select: { title: true, subject: { select: { name: true } } },
                    },
                    exam: {
                        select: { title: true, examQuestion: { select: { subject: { select: { name: true } } } } },
                    },
                },
                orderBy: { uploadedAt: "desc" },
                take: 10,
            }),
            // Attendance rate
            setup_1.prisma.$queryRaw `
        SELECT 
          COUNT(*) as total_days,
          COUNT(*) FILTER (WHERE present = true) as present_days,
          ROUND(
            (COUNT(*) FILTER (WHERE present = true)::decimal / COUNT(*)) * 100, 2
          ) as attendance_rate
        FROM "Attendance"
        WHERE "studentId" = ${studentId}
          ${data.startDate && data.endDate
                ? `AND date >= '${data.startDate}' AND date <= '${data.endDate}'`
                : "AND date >= NOW() - INTERVAL '30 days'"}
      `,
            // Subject-wise performance
            setup_1.prisma.$queryRaw `
        SELECT 
          s.name as subject_name,
          COUNT(r.id) as total_results,
          AVG(r.percentage) as average_percentage,
          MAX(r.percentage) as best_score,
          MIN(r.percentage) as lowest_score
        FROM "Result" r
        LEFT JOIN "Assignment" a ON r."assignmentId" = a.id
        LEFT JOIN "Exam" e ON r."examId" = e.id
        LEFT JOIN "ExamQuestion" eq ON e."examQuestionId" = eq.id
        LEFT JOIN "Subject" s ON (a."subjectId" = s.id OR eq."subjectId" = s.id)
        WHERE r."studentId" = ${studentId}
          AND s.name IS NOT NULL
          ${data.startDate && data.endDate
                ? `AND r."uploadedAt" >= '${data.startDate}' AND r."uploadedAt" <= '${data.endDate}'`
                : ""}
        GROUP BY s.name
        ORDER BY average_percentage DESC
      `,
        ]);
        const analytics = {
            student: {
                id: student.id,
                name: student.name,
                surname: student.surname,
                registrationNumber: student.registrationNumber,
            },
            academic: {
                totalAssignments,
                submittedAssignments,
                submissionRate: totalAssignments > 0 ? ((submittedAssignments / totalAssignments) * 100).toFixed(2) : "0.00",
                averageScore: averageScore._avg.percentage?.toFixed(2) || "0.00",
                recentResults,
                subjectPerformance,
            },
            attendance: attendanceRate[0] || {
                total_days: 0,
                present_days: 0,
                attendance_rate: 0,
            },
        };
        setup_1.logger.info("Student analytics retrieved", {
            userId: req.user?.id,
            studentId: studentId,
            dateRange: data.startDate && data.endDate ? `${data.startDate} to ${data.endDate}` : "default",
        });
        res.status(200).json({
            message: "Student analytics retrieved successfully",
            analytics,
        });
    }
    catch (error) {
        if (error instanceof zod_1.z.ZodError) {
            return res.status(400).json({ message: "Invalid query parameters", errors: error.errors });
        }
        (0, setup_1.handleError)(res, error, "Failed to retrieve student analytics");
    }
};
exports.getStudentAnalytics = getStudentAnalytics;
const getClassAnalytics = async (req, res) => {
    const { classId } = req.params;
    try {
        const data = analyticsQuerySchema.parse(req.query);
        // Verify access to class with enhanced multi-tenant support
        let classRecord;
        if (req.user?.role === "TEACHER") {
            classRecord = await setup_1.prisma.class.findFirst({
                where: {
                    id: classId,
                    OR: [
                        { supervisorId: req.user.id },
                        {
                            lessons: {
                                some: { teacherId: req.user.id },
                            },
                        },
                    ],
                },
                include: {
                    students: { select: { id: true } },
                    grade: { select: { name: true, level: true } },
                },
            });
        }
        else {
            classRecord = await setup_1.prisma.class.findFirst({
                where: {
                    id: classId,
                    ...(0, setup_1.getTenantFilter)(req.user),
                },
                include: {
                    students: { select: { id: true } },
                    grade: { select: { name: true, level: true } },
                },
            });
        }
        if (!classRecord) {
            return res.status(404).json({ message: "Class not found or access denied" });
        }
        const studentIds = classRecord.students.map((s) => s.id);
        const dateFilter = data.startDate && data.endDate
            ? {
                date: {
                    gte: new Date(data.startDate),
                    lte: new Date(data.endDate),
                },
            }
            : {
                date: {
                    gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), // Last 30 days
                },
            };
        // Get class performance analytics
        const [attendanceStats, academicPerformance, assignmentStats, topPerformers, strugglingStudents] = await Promise.all([
            // Attendance statistics
            setup_1.prisma.$queryRaw `
        SELECT 
          COUNT(*) as total_records,
          COUNT(*) FILTER (WHERE present = true) as present_count,
          COUNT(*) FILTER (WHERE present = false) as absent_count,
          ROUND(
            (COUNT(*) FILTER (WHERE present = true)::decimal / COUNT(*)) * 100, 2
          ) as attendance_rate
        FROM "Attendance"
        WHERE "studentId" = ANY(${studentIds})
          AND date >= ${dateFilter.date.gte}
          ${dateFilter.date.lte ? `AND date <= ${dateFilter.date.lte}` : ""}
      `,
            // Academic performance
            setup_1.prisma.$queryRaw `
        SELECT 
          AVG(r.percentage) as class_average,
          MAX(r.percentage) as highest_score,
          MIN(r.percentage) as lowest_score,
          COUNT(r.id) as total_results
        FROM "Result" r
        WHERE r."studentId" = ANY(${studentIds})
          AND r."uploadedAt" >= ${dateFilter.date.gte}
          ${dateFilter.date.lte ? `AND r."uploadedAt" <= ${dateFilter.date.lte}` : ""}
      `,
            // Assignment submission statistics
            setup_1.prisma.$queryRaw `
        SELECT 
          COUNT(DISTINCT a.id) as total_assignments,
          COUNT(sub.id) as total_submissions,
          ROUND(
            (COUNT(sub.id)::decimal / (COUNT(DISTINCT a.id) * ${studentIds.length})) * 100, 2
          ) as submission_rate
        FROM "Assignment" a
        LEFT JOIN "AssignmentSubmission" sub ON a.id = sub."assignmentId" 
          AND sub."studentId" = ANY(${studentIds})
        WHERE a."classId" = ${classId}
          AND a."createdAt" >= ${dateFilter.date.gte}
          ${dateFilter.date.lte ? `AND a."createdAt" <= ${dateFilter.date.lte}` : ""}
      `,
            // Top 5 performers
            setup_1.prisma.$queryRaw `
        SELECT 
          s.id,
          s.name,
          s.surname,
          AVG(r.percentage) as average_score,
          COUNT(r.id) as result_count
        FROM "Student" s
        JOIN "Result" r ON s.id = r."studentId"
        WHERE s.id = ANY(${studentIds})
          AND r."uploadedAt" >= ${dateFilter.date.gte}
          ${dateFilter.date.lte ? `AND r."uploadedAt" <= ${dateFilter.date.lte}` : ""}
        GROUP BY s.id, s.name, s.surname
        HAVING COUNT(r.id) >= 3
        ORDER BY average_score DESC
        LIMIT 5
      `,
            // Students who might need help (low attendance or performance)
            setup_1.prisma.$queryRaw `
        SELECT DISTINCT
          s.id,
          s.name,
          s.surname,
          COALESCE(AVG(r.percentage), 0) as average_score,
          COALESCE(
            (COUNT(att) FILTER (WHERE att.present = true)::decimal / NULLIF(COUNT(att), 0)) * 100, 
            0
          ) as attendance_rate
        FROM "Student" s
        LEFT JOIN "Result" r ON s.id = r."studentId" 
          AND r."uploadedAt" >= ${dateFilter.date.gte}
          ${dateFilter.date.lte ? `AND r."uploadedAt" <= ${dateFilter.date.lte}` : ""}
        LEFT JOIN "Attendance" att ON s.id = att."studentId"
          AND att.date >= ${dateFilter.date.gte}
          ${dateFilter.date.lte ? `AND att.date <= ${dateFilter.date.lte}` : ""}
        WHERE s.id = ANY(${studentIds})
        GROUP BY s.id, s.name, s.surname
        HAVING 
          COALESCE(AVG(r.percentage), 0) < 60 
          OR COALESCE(
            (COUNT(att) FILTER (WHERE att.present = true)::decimal / NULLIF(COUNT(att), 0)) * 100, 
            100
          ) < 80
        ORDER BY average_score ASC, attendance_rate ASC
        LIMIT 10
      `,
        ]);
        const analytics = {
            class: {
                id: classRecord.id,
                name: classRecord.name,
                grade: classRecord.grade,
                totalStudents: studentIds.length,
            },
            attendance: attendanceStats[0] || {
                total_records: 0,
                present_count: 0,
                absent_count: 0,
                attendance_rate: 0,
            },
            academic: academicPerformance[0] || {
                class_average: 0,
                highest_score: 0,
                lowest_score: 0,
                total_results: 0,
            },
            assignments: assignmentStats[0] || {
                total_assignments: 0,
                total_submissions: 0,
                submission_rate: 0,
            },
            insights: {
                topPerformers,
                strugglingStudents,
            },
        };
        setup_1.logger.info("Class analytics retrieved", {
            userId: req.user?.id,
            classId: classId,
            studentCount: studentIds.length,
            dateRange: data.startDate && data.endDate ? `${data.startDate} to ${data.endDate}` : "last 30 days",
        });
        res.status(200).json({
            message: "Class analytics retrieved successfully",
            analytics,
        });
    }
    catch (error) {
        if (error instanceof zod_1.z.ZodError) {
            return res.status(400).json({ message: "Invalid query parameters", errors: error.errors });
        }
        (0, setup_1.handleError)(res, error, "Failed to retrieve class analytics");
    }
};
exports.getClassAnalytics = getClassAnalytics;
const getParentEngagementAnalytics = async (req, res) => {
    try {
        // Only principals and school admins can view engagement analytics
        if (!["PRINCIPAL", "SCHOOL_ADMIN", "SUPER_ADMIN"].includes(req.user?.role || "")) {
            return res.status(403).json({ message: "Access denied" });
        }
        const schoolId = req.user?.schoolId;
        // Get parent engagement metrics with updated multi-school support
        const [totalParents, activeParents, messageStats, eventParticipation, paymentStats, appUsageStats] = await Promise.all([
            // Total parents with children in this school
            setup_1.prisma.parent.count({
                where: {
                    children: {
                        some: { schoolId: req.user?.schoolId },
                    },
                },
            }),
            // Active parents (logged in within last 30 days) with children in this school
            setup_1.prisma.parent.count({
                where: {
                    children: {
                        some: { schoolId: req.user?.schoolId },
                    },
                    user: {
                        lastLogin: {
                            gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
                        },
                    },
                },
            }),
            // Message statistics
            setup_1.prisma.$queryRaw `
        SELECT 
          COUNT(*) as total_messages,
          COUNT(DISTINCT "senderId") as active_senders,
          AVG(
            EXTRACT(EPOCH FROM ("readAt" - "sentAt")) / 3600
          ) as avg_response_time_hours
        FROM "Message" m
        JOIN "User" u ON m."senderId" = u.id
        JOIN "Parent" p ON u.id = p.id
        WHERE EXISTS (
          SELECT 1 FROM "Student" s 
          WHERE s."parentId" = p.id 
          AND s."schoolId" = ${schoolId}
        )
        AND m."sentAt" >= NOW() - INTERVAL '30 days'
      `,
            // Event participation
            setup_1.prisma.$queryRaw `
        SELECT 
          COUNT(DISTINCT e.id) as total_events,
          COUNT(rsvp.id) as total_rsvps,
          COUNT(rsvp.id) FILTER (WHERE rsvp.response = 'ATTENDING') as attending_count
        FROM "Event" e
        LEFT JOIN "EventRSVP" rsvp ON e.id = rsvp."eventId"
        LEFT JOIN "User" u ON rsvp."userId" = u.id
        LEFT JOIN "Parent" p ON u.id = p.id
        WHERE e."schoolId" = ${schoolId}
          AND e."startTime" >= NOW() - INTERVAL '90 days'
          AND e."rsvpRequired" = true
          AND EXISTS (
            SELECT 1 FROM "Student" s 
            WHERE s."parentId" = p.id 
            AND s."schoolId" = ${schoolId}
          )
      `,
            // Payment statistics
            setup_1.prisma.$queryRaw `
        SELECT 
          COUNT(*) as total_payments,
          COUNT(*) FILTER (WHERE status = 'COMPLETED') as completed_payments,
          COUNT(*) FILTER (WHERE status = 'PENDING') as pending_payments,
          AVG(
            EXTRACT(EPOCH FROM ("paymentDate" - "createdAt")) / 86400
          ) as avg_payment_time_days
        FROM "Payment" p
        WHERE p."schoolId" = ${schoolId}
          AND p."createdAt" >= NOW() - INTERVAL '90 days'
      `,
            // App usage (based on notifications read)
            setup_1.prisma.$queryRaw `
        SELECT 
          COUNT(DISTINCT n."userId") as active_users,
          COUNT(*) as total_notifications,
          COUNT(*) FILTER (WHERE n."isRead" = true) as read_notifications,
          ROUND(
            (COUNT(*) FILTER (WHERE n."isRead" = true)::decimal / COUNT(*)) * 100, 2
          ) as read_rate
        FROM "Notification" n
        JOIN "User" u ON n."userId" = u.id
        JOIN "Parent" p ON u.id = p.id
        WHERE EXISTS (
          SELECT 1 FROM "Student" s 
          WHERE s."parentId" = p.id 
          AND s."schoolId" = ${schoolId}
        )
        AND n."createdAt" >= NOW() - INTERVAL '30 days'
      `,
        ]);
        const analytics = {
            overview: {
                totalParents,
                activeParents,
                engagementRate: totalParents > 0 ? ((activeParents / totalParents) * 100).toFixed(2) : "0.00",
            },
            communication: messageStats[0] || {
                total_messages: 0,
                active_senders: 0,
                avg_response_time_hours: 0,
            },
            events: eventParticipation[0] || {
                total_events: 0,
                total_rsvps: 0,
                attending_count: 0,
            },
            payments: paymentStats[0] || {
                total_payments: 0,
                completed_payments: 0,
                pending_payments: 0,
                avg_payment_time_days: 0,
            },
            appUsage: appUsageStats[0] || {
                active_users: 0,
                total_notifications: 0,
                read_notifications: 0,
                read_rate: 0,
            },
        };
        setup_1.logger.info("Parent engagement analytics retrieved", {
            userId: req.user?.id,
            schoolId: req.user?.schoolId,
        });
        res.status(200).json({
            message: "Parent engagement analytics retrieved successfully",
            analytics,
        });
    }
    catch (error) {
        (0, setup_1.handleError)(res, error, "Failed to retrieve parent engagement analytics");
    }
};
exports.getParentEngagementAnalytics = getParentEngagementAnalytics;
