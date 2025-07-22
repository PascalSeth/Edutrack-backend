"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getTeacherAnalytics = exports.getParentEngagementAnalytics = exports.getClassAnalytics = exports.getStudentAnalytics = exports.getSchoolAnalytics = void 0;
const zod_1 = require("zod");
const setup_1 = require("../utils/setup");
// Enhanced validation schemas
const analyticsQuerySchema = zod_1.z.object({
    startDate: zod_1.z.string().datetime().optional(),
    endDate: zod_1.z.string().datetime().optional(),
    studentId: zod_1.z.string().uuid().optional(),
    classId: zod_1.z.string().uuid().optional(),
    subjectId: zod_1.z.string().uuid().optional(),
    gradeId: zod_1.z.string().uuid().optional(),
    teacherId: zod_1.z.string().uuid().optional(),
    period: zod_1.z.enum(["week", "month", "quarter", "year"]).optional().default("month"),
});
// Helper function to get role-based filters
const getRoleBasedFilter = (user) => {
    const baseFilter = (0, setup_1.getTenantFilter)(user);
    switch (user?.role) {
        case "TEACHER":
            return {
                ...baseFilter,
                teacherSpecific: {
                    OR: [{ supervisorId: user.id }, { lessons: { some: { teacherId: user.id } } }],
                },
            };
        case "PARENT":
            return {
                parentSpecific: {
                    children: { some: { parentId: user.id } },
                },
            };
        case "PRINCIPAL":
        case "SCHOOL_ADMIN":
            return baseFilter;
        case "SUPER_ADMIN":
            return {}; // Super admin can see everything
        default:
            return baseFilter;
    }
};
const getSchoolAnalytics = async (req, res) => {
    try {
        // Enhanced role-based access control
        if (!["PRINCIPAL", "SCHOOL_ADMIN", "SUPER_ADMIN"].includes(req.user?.role || "")) {
            return res.status(403).json({ message: "Access denied" });
        }
        const filter = (0, setup_1.getTenantFilter)(req.user);
        const schoolId = req.user?.schoolId;
        // Get comprehensive school metrics
        const [totalStudents, totalTeachers, totalParents, totalClasses, activeAssignments, completedPayments, pendingPayments, overduePayments, recentEvents, totalSubjects, verifiedTeachers, pendingApprovals, activeSubscription,] = await Promise.all([
            setup_1.prisma.student.count({ where: filter }),
            setup_1.prisma.teacher.count({ where: filter }),
            setup_1.prisma.parent.count({
                where: {
                    children: { some: { schoolId: req.user?.schoolId } },
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
                where: { ...filter, status: "COMPLETED" },
            }),
            setup_1.prisma.payment.count({
                where: { ...filter, status: "PENDING" },
            }),
            setup_1.prisma.payment.count({
                where: {
                    ...filter,
                    status: "PENDING",
                    feeStructure: {
                        dueDate: { lt: new Date() },
                    },
                },
            }),
            setup_1.prisma.event.count({
                where: {
                    ...filter,
                    startTime: {
                        gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
                        lte: new Date(),
                    },
                },
            }),
            setup_1.prisma.subject.count({ where: filter }),
            setup_1.prisma.teacher.count({
                where: { ...filter, approvalStatus: "APPROVED" },
            }),
            setup_1.prisma.approval.count({
                where: {
                    status: "PENDING",
                    OR: [
                        { teacher: { schoolId } },
                        { examQuestion: { schoolId } },
                        { assignment: { schoolId } },
                        { result: { student: { schoolId } } },
                    ],
                },
            }),
            setup_1.prisma.subscription.findUnique({
                where: { schoolId: req.user?.schoolId },
                select: { plan: true, isActive: true },
            }),
        ]);
        // Enhanced financial analytics
        const [totalRevenue, monthlyRevenue, feeAnalytics] = await Promise.all([
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
          COUNT(*) as payment_count,
          ROUND(
            (COUNT(*) FILTER (WHERE status = 'COMPLETED')::decimal / COUNT(*)) * 100, 2
          ) as collection_rate
        FROM "Payment"
        WHERE "schoolId" = ${schoolId}
          AND "paymentDate" >= NOW() - INTERVAL '12 months'
        GROUP BY DATE_TRUNC('month', "paymentDate")
        ORDER BY month DESC
      `,
            setup_1.prisma.$queryRaw `
        SELECT 
          fs."feeType" as fee_type,
          SUM(fs.amount) as total_amount,
          SUM(CASE WHEN p.status = 'COMPLETED' THEN p.amount ELSE 0 END) as collected_amount,
          SUM(CASE WHEN p.status = 'PENDING' THEN p.amount ELSE 0 END) as pending_amount,
          ROUND(
            (SUM(CASE WHEN p.status = 'COMPLETED' THEN p.amount ELSE 0 END) / 
             NULLIF(SUM(fs.amount), 0)) * 100, 2
          ) as collection_rate
        FROM "FeeStructure" fs
        LEFT JOIN "Payment" p ON fs.id = p."feeStructureId"
        WHERE fs."schoolId" = ${schoolId}
        GROUP BY fs."feeType"
        ORDER BY total_amount DESC
      `,
        ]);
        // Enhanced attendance analytics with trends
        const attendanceRate = await setup_1.prisma.$queryRaw `
      SELECT 
        COUNT(*) as total_records,
        COUNT(*) FILTER (WHERE present = true) as present_count,
        COUNT(*) FILTER (WHERE present = false) as absent_count,
        ROUND(
          (COUNT(*) FILTER (WHERE present = true)::decimal / COUNT(*)) * 100, 2
        ) as attendance_rate,
        ROUND(
          (COUNT(*) FILTER (WHERE present = true AND date >= NOW() - INTERVAL '7 days')::decimal / 
           NULLIF(COUNT(*) FILTER (WHERE date >= NOW() - INTERVAL '7 days'), 0)) * 100 - 
          (COUNT(*) FILTER (WHERE present = true AND date >= NOW() - INTERVAL '14 days' AND date < NOW() - INTERVAL '7 days')::decimal / 
           NULLIF(COUNT(*) FILTER (WHERE date >= NOW() - INTERVAL '14 days' AND date < NOW() - INTERVAL '7 days'), 0)) * 100, 2
        ) as weekly_trend
      FROM "Attendance" a
      JOIN "Student" s ON a."studentId" = s.id
      WHERE s."schoolId" = ${schoolId}
        AND a.date >= NOW() - INTERVAL '30 days'
    `;
        // Academic performance with improvement tracking
        const averageScore = await setup_1.prisma.$queryRaw `
      SELECT 
        AVG(r.percentage) as class_average,
        MAX(r.percentage) as highest_score,
        MIN(r.percentage) as lowest_score,
        COUNT(r.id) as total_results,
        ROUND(
          AVG(r.percentage) FILTER (WHERE r."uploadedAt" >= NOW() - INTERVAL '30 days') - 
          AVG(r.percentage) FILTER (WHERE r."uploadedAt" >= NOW() - INTERVAL '60 days' AND r."uploadedAt" < NOW() - INTERVAL '30 days'), 2
        ) as improvement_rate
      FROM "Result" r
      JOIN "Student" s ON r."studentId" = s.id
      WHERE s."schoolId" = ${schoolId}
        AND r."uploadedAt" >= NOW() - INTERVAL '90 days'
    `;
        // Grade distribution with percentages
        const gradeDistribution = await setup_1.prisma.$queryRaw `
      SELECT 
        r.grade,
        COUNT(*) as count,
        ROUND((COUNT(*)::decimal / SUM(COUNT(*)) OVER()) * 100, 2) as percentage
      FROM "Result" r
      JOIN "Student" s ON r."studentId" = s.id
      WHERE s."schoolId" = ${schoolId}
        AND r.grade IS NOT NULL
        AND r."uploadedAt" >= NOW() - INTERVAL '3 months'
      GROUP BY r.grade
      ORDER BY r.grade
    `;
        // Teacher performance analytics
        const teacherPerformance = await setup_1.prisma.$queryRaw `
      SELECT 
        t.id as teacher_id,
        CONCAT(u.name, ' ', u.surname) as teacher_name,
        COUNT(DISTINCT s.id) as total_students,
        AVG(r.percentage) as avg_class_performance,
        ROUND(
          (COUNT(asub.id)::decimal / COUNT(a.id)) * 100, 2
        ) as assignment_completion_rate,
        COALESCE(AVG(pf.rating), 0) as student_satisfaction
      FROM "Teacher" t
      JOIN "User" u ON t.id = u.id
      LEFT JOIN "Class" c ON t.id = c."supervisorId"
      LEFT JOIN "Student" s ON c.id = s."classId"
      LEFT JOIN "Assignment" a ON t.id = a."teacherId"
      LEFT JOIN "AssignmentSubmission" asub ON a.id = asub."assignmentId"
      LEFT JOIN "Result" r ON s.id = r."studentId"
      LEFT JOIN "ParentFeedback" pf ON t.id = pf."teacherId"
      WHERE t."schoolId" = ${schoolId}
        AND t."approvalStatus" = 'APPROVED'
      GROUP BY t.id, u.name, u.surname
      ORDER BY avg_class_performance DESC
      LIMIT 10
    `;
        // Class comparison analytics - Fixed to include proper relations
        const classComparison = await setup_1.prisma.$queryRaw `
      SELECT 
        c.id as class_id,
        c.name as class_name,
        g.name as grade_name,
        AVG(r.percentage) as avg_performance,
        ROUND(
          (COUNT(a) FILTER (WHERE a.present = true)::decimal / COUNT(a)) * 100, 2
        ) as attendance_rate,
        COUNT(DISTINCT s.id) as total_students
      FROM "Class" c
      JOIN "Grade" g ON c."gradeId" = g.id
      LEFT JOIN "Student" s ON c.id = s."classId"
      LEFT JOIN "Result" r ON s.id = r."studentId"
      LEFT JOIN "Attendance" a ON s.id = a."studentId"
      WHERE c."schoolId" = ${schoolId}
        AND r."uploadedAt" >= NOW() - INTERVAL '3 months'
        AND a.date >= NOW() - INTERVAL '30 days'
      GROUP BY c.id, c.name, g.name
      ORDER BY avg_performance DESC
    `;
        const analytics = {
            overview: {
                totalStudents,
                totalTeachers,
                totalParents,
                totalClasses,
                totalSubjects,
                activeAssignments,
                recentEvents,
                verifiedTeachers,
                pendingApprovals,
                subscription: activeSubscription,
            },
            financial: {
                totalRevenue: totalRevenue._sum.amount || 0,
                completedPayments,
                pendingPayments,
                overduePayments,
                monthlyRevenue,
                feeAnalytics,
                collectionEfficiency: pendingPayments + completedPayments > 0
                    ? ((completedPayments / (pendingPayments + completedPayments)) * 100).toFixed(2)
                    : "0.00",
            },
            attendance: attendanceRate[0] || {
                total_records: 0,
                present_count: 0,
                absent_count: 0,
                attendance_rate: 0,
                weekly_trend: 0,
            },
            academic: {
                performance: averageScore[0] || {
                    class_average: 0,
                    highest_score: 0,
                    lowest_score: 0,
                    total_results: 0,
                    improvement_rate: 0,
                },
                gradeDistribution,
                teacherPerformance,
                classComparison,
            },
        };
        setup_1.logger.info("Enhanced school analytics retrieved", {
            userId: req.user?.id,
            schoolId: req.user?.schoolId,
            role: req.user?.role,
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
        // Enhanced multi-tenant access verification
        let student;
        if (req.user?.role === "PARENT") {
            student = await setup_1.prisma.student.findFirst({
                where: {
                    id: studentId,
                    parentId: req.user.id,
                    ...(0, setup_1.getTenantFilter)(req.user),
                },
                include: {
                    class: { include: { grade: true } },
                    parent: { include: { user: true } },
                },
            });
        }
        else if (req.user?.role === "TEACHER") {
            student = await setup_1.prisma.student.findFirst({
                where: {
                    id: studentId,
                    OR: [{ class: { supervisorId: req.user.id } }, { class: { lessons: { some: { teacherId: req.user.id } } } }],
                    ...(0, setup_1.getTenantFilter)(req.user),
                },
                include: {
                    class: { include: { grade: true } },
                    parent: { include: { user: true } },
                },
            });
        }
        else {
            student = await setup_1.prisma.student.findFirst({
                where: {
                    id: studentId,
                    ...(0, setup_1.getTenantFilter)(req.user),
                },
                include: {
                    class: { include: { grade: true } },
                    parent: { include: { user: true } },
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
        // Enhanced academic performance analytics
        const [totalAssignments, submittedAssignments, overdueAssignments, averageScore, recentResults, attendanceStats, subjectPerformance, performanceTrend, classRanking, upcomingAssignments,] = await Promise.all([
            // Total assignments for student's class and school-wide
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
                    assignment: dateFilter.createdAt ? { createdAt: dateFilter.createdAt } : {},
                },
            }),
            // Overdue assignments
            setup_1.prisma.assignment.count({
                where: {
                    OR: [{ classId: student.classId }, { assignmentType: "CLASS_WIDE", schoolId: student.schoolId }],
                    dueDate: { lt: new Date() },
                    submissions: {
                        none: { studentId: studentId },
                    },
                },
            }),
            // Average score with trend
            setup_1.prisma.result.aggregate({
                where: {
                    studentId: studentId,
                    ...dateFilter,
                },
                _avg: { percentage: true },
                _count: true,
            }),
            // Recent results with more details - Fixed examQuestion reference
            setup_1.prisma.result.findMany({
                where: {
                    studentId: studentId,
                    ...dateFilter,
                },
                include: {
                    assignment: {
                        select: {
                            title: true,
                            subject: { select: { name: true } },
                            maxScore: true,
                        },
                    },
                    exam: {
                        select: {
                            title: true,
                            examQuestions: {
                                select: {
                                    subject: { select: { name: true } },
                                    maxScore: true,
                                },
                            },
                        },
                    },
                },
                orderBy: { uploadedAt: "desc" },
                take: 10,
            }),
            // Enhanced attendance rate with trends
            setup_1.prisma.$queryRaw `
        SELECT 
          COUNT(*) as total_records,
          COUNT(*) FILTER (WHERE present = true) as present_count,
          COUNT(*) FILTER (WHERE present = false) as absent_count,
          ROUND(
            (COUNT(*) FILTER (WHERE present = true)::decimal / COUNT(*)) * 100, 2
          ) as attendance_rate,
          ROUND(
            (COUNT(*) FILTER (WHERE present = true AND date >= NOW() - INTERVAL '7 days')::decimal / 
             NULLIF(COUNT(*) FILTER (WHERE date >= NOW() - INTERVAL '7 days'), 0)) * 100, 2
          ) as weekly_trend
        FROM "Attendance"
        WHERE "studentId" = ${studentId}
          ${data.startDate && data.endDate
                ? `AND date >= '${data.startDate}' AND date <= '${data.endDate}'`
                : "AND date >= NOW() - INTERVAL '30 days'"}
      `,
            // Enhanced subject-wise performance
            setup_1.prisma.$queryRaw `
        SELECT 
          s.name as subject_name,
          COUNT(r.id) as total_results,
          AVG(r.percentage) as average_percentage,
          MAX(r.percentage) as best_score,
          MIN(r.percentage) as lowest_score,
          ROUND(
            (COUNT(*) FILTER (WHERE r.percentage >= 50)::decimal / COUNT(*)) * 100, 2
          ) as pass_rate
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
            // Performance trend over time
            setup_1.prisma.$queryRaw `
        SELECT 
          DATE_TRUNC('month', r."uploadedAt") as month,
          AVG(r.percentage) as avg_score,
          COUNT(r.id) as result_count
        FROM "Result" r
        WHERE r."studentId" = ${studentId}
          AND r."uploadedAt" >= NOW() - INTERVAL '6 months'
        GROUP BY DATE_TRUNC('month', r."uploadedAt")
        ORDER BY month ASC
      `,
            // Class ranking
            setup_1.prisma.$queryRaw `
        WITH student_averages AS (
          SELECT 
            s.id,
            AVG(r.percentage) as avg_score
          FROM "Student" s
          LEFT JOIN "Result" r ON s.id = r."studentId"
          WHERE s."classId" = ${student.classId}
            AND r."uploadedAt" >= NOW() - INTERVAL '3 months'
          GROUP BY s.id
        )
        SELECT 
          RANK() OVER (ORDER BY avg_score DESC) as rank,
          COUNT(*) OVER() as total_students
        FROM student_averages
        WHERE id = ${studentId}
      `,
            // Upcoming assignments
            setup_1.prisma.assignment.findMany({
                where: {
                    OR: [{ classId: student.classId }, { assignmentType: "CLASS_WIDE", schoolId: student.schoolId }],
                    dueDate: { gte: new Date() },
                    submissions: {
                        none: { studentId: studentId },
                    },
                },
                include: {
                    subject: { select: { name: true } },
                },
                orderBy: { dueDate: "asc" },
                take: 5,
            }),
        ]);
        // Add this helper function before the analytics object:
        const getOverallGrade = (percentage) => {
            if (percentage === null || percentage === undefined) {
                return "No Data";
            }
            if (percentage >= 80)
                return "Excellent";
            if (percentage >= 70)
                return "Good";
            if (percentage >= 60)
                return "Satisfactory";
            return "Needs Improvement";
        };
        // Replace the analytics object creation section (around lines 730-740) with this:
        const analytics = {
            student: {
                id: student.id,
                name: student.name,
                surname: student.surname,
                registrationNumber: student.registrationNumber,
                class: student.class,
                parent: {
                    name: student.parent.user.name,
                    email: student.parent.user.email,
                },
            },
            academic: {
                totalAssignments,
                submittedAssignments,
                overdueAssignments,
                submissionRate: totalAssignments > 0 ? ((submittedAssignments / totalAssignments) * 100).toFixed(2) : "0.00",
                averageScore: averageScore._avg.percentage?.toFixed(2) ?? "0.00", // Fix: Use nullish coalescing
                totalResults: averageScore._count,
                recentResults,
                subjectPerformance,
                performanceTrend,
                classRanking: classRanking[0] || { rank: 0, total_students: 0 },
                upcomingAssignments,
            },
            attendance: {
                ...(attendanceStats[0] || {
                    total_records: 0,
                    present_count: 0,
                    absent_count: 0,
                    attendance_rate: 0,
                    weekly_trend: 0,
                }),
            },
            insights: {
                strengths: subjectPerformance.filter((s) => s.average_percentage >= 75).map((s) => s.subject_name),
                needsImprovement: subjectPerformance.filter((s) => s.average_percentage < 60).map((s) => s.subject_name),
                attendanceStatus: attendanceStats[0]?.attendance_rate >= 80 ? "Good" : "Needs Improvement",
                overallGrade: getOverallGrade(averageScore._avg.percentage), // Extract to helper function
            },
        };
        setup_1.logger.info("Enhanced student analytics retrieved", {
            userId: req.user?.id,
            studentId: studentId,
            role: req.user?.role,
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
        // Enhanced multi-tenant access verification
        let classRecord;
        if (req.user?.role === "TEACHER") {
            classRecord = await setup_1.prisma.class.findFirst({
                where: {
                    id: classId,
                    OR: [{ supervisorId: req.user.id }, { lessons: { some: { teacherId: req.user.id } } }],
                    ...(0, setup_1.getTenantFilter)(req.user),
                },
                include: {
                    students: {
                        select: {
                            id: true,
                            name: true,
                            surname: true,
                            registrationNumber: true,
                        },
                    },
                    grade: { select: { name: true, level: true } },
                    supervisor: {
                        include: {
                            user: { select: { name: true, surname: true } },
                        },
                    },
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
                    students: {
                        select: {
                            id: true,
                            name: true,
                            surname: true,
                            registrationNumber: true,
                        },
                    },
                    grade: { select: { name: true, level: true } },
                    supervisor: {
                        include: {
                            user: { select: { name: true, surname: true } },
                        },
                    },
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
                    gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
                },
            };
        // Enhanced class analytics
        const [attendanceStats, academicPerformance, assignmentStats, topPerformers, strugglingStudents, subjectPerformance, attendanceTrends, disciplinaryRecords,] = await Promise.all([
            // Enhanced attendance statistics
            setup_1.prisma.$queryRaw `
        SELECT 
          COUNT(*) as total_records,
          COUNT(*) FILTER (WHERE present = true) as present_count,
          COUNT(*) FILTER (WHERE present = false) as absent_count,
          ROUND(
            (COUNT(*) FILTER (WHERE present = true)::decimal / COUNT(*)) * 100, 2
          ) as attendance_rate,
          ROUND(
            (COUNT(*) FILTER (WHERE present = true AND date >= NOW() - INTERVAL '7 days')::decimal / 
             NULLIF(COUNT(*) FILTER (WHERE date >= NOW() - INTERVAL '7 days'), 0)) * 100, 2
          ) as weekly_trend
        FROM "Attendance"
        WHERE "studentId" = ANY(${studentIds})
          AND date >= ${dateFilter.date.gte}
          ${dateFilter.date.lte ? `AND date <= ${dateFilter.date.lte}` : ""}
      `,
            // Enhanced academic performance
            setup_1.prisma.$queryRaw `
        SELECT 
          AVG(r.percentage) as class_average,
          MAX(r.percentage) as highest_score,
          MIN(r.percentage) as lowest_score,
          COUNT(r.id) as total_results,
          ROUND(
            AVG(r.percentage) FILTER (WHERE r."uploadedAt" >= NOW() - INTERVAL '30 days') - 
            AVG(r.percentage) FILTER (WHERE r."uploadedAt" >= NOW() - INTERVAL '60 days' AND r."uploadedAt" < NOW() - INTERVAL '30 days'), 2
          ) as improvement_rate
        FROM "Result" r
        WHERE r."studentId" = ANY(${studentIds})
          AND r."uploadedAt" >= ${dateFilter.date.gte}
          ${dateFilter.date.lte ? `AND r."uploadedAt" <= ${dateFilter.date.lte}` : ""}
      `,
            // Enhanced assignment statistics
            setup_1.prisma.$queryRaw `
        SELECT 
          COUNT(DISTINCT a.id) as total_assignments,
          COUNT(sub.id) as total_submissions,
          COUNT(DISTINCT a.id) FILTER (WHERE a."dueDate" < NOW()) - 
          COUNT(DISTINCT sub."assignmentId") FILTER (WHERE a."dueDate" < NOW()) as overdue_assignments,
          ROUND(
            (COUNT(sub.id)::decimal / (COUNT(DISTINCT a.id) * ${studentIds.length})) * 100, 2
          ) as submission_rate,
          AVG(EXTRACT(EPOCH FROM (sub."submittedAt" - a."startDate")) / 86400) as avg_completion_time
        FROM "Assignment" a
        LEFT JOIN "AssignmentSubmission" sub ON a.id = sub."assignmentId" 
          AND sub."studentId" = ANY(${studentIds})
        WHERE a."classId" = ${classId}
          AND a."createdAt" >= ${dateFilter.date.gte}
          ${dateFilter.date.lte ? `AND a."createdAt" <= ${dateFilter.date.lte}` : ""}
      `,
            // Enhanced top performers with trends
            setup_1.prisma.$queryRaw `
        SELECT 
          s.id,
          s.name,
          s.surname,
          AVG(r.percentage) as average_score,
          COUNT(r.id) as result_count,
          ROUND(
            AVG(r.percentage) FILTER (WHERE r."uploadedAt" >= NOW() - INTERVAL '30 days') - 
            AVG(r.percentage) FILTER (WHERE r."uploadedAt" >= NOW() - INTERVAL '60 days' AND r."uploadedAt" < NOW() - INTERVAL '30 days'), 2
          ) as improvement_trend
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
            // Enhanced struggling students with risk assessment
            setup_1.prisma.$queryRaw `
        SELECT DISTINCT
          s.id,
          s.name,
          s.surname,
          COALESCE(AVG(r.percentage), 0) as average_score,
          COALESCE(
            (COUNT(att) FILTER (WHERE att.present = true)::decimal / NULLIF(COUNT(att), 0)) * 100, 
            0
          ) as attendance_rate,
          CASE 
            WHEN COALESCE(AVG(r.percentage), 0) < 40 AND 
                 COALESCE((COUNT(att) FILTER (WHERE att.present = true)::decimal / NULLIF(COUNT(att), 0)) * 100, 100) < 70 
            THEN 'High Risk'
            WHEN COALESCE(AVG(r.percentage), 0) < 50 OR 
                 COALESCE((COUNT(att) FILTER (WHERE att.present = true)::decimal / NULLIF(COUNT(att), 0)) * 100, 100) < 80 
            THEN 'Medium Risk'
            ELSE 'Low Risk'
          END as risk_level
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
            // Subject-wise class performance
            setup_1.prisma.$queryRaw `
        SELECT 
          subj.name as subject_name,
          COUNT(r.id) as total_results,
          AVG(r.percentage) as average_percentage,
          MAX(r.percentage) as best_score,
          MIN(r.percentage) as lowest_score,
          ROUND(
            (COUNT(*) FILTER (WHERE r.percentage >= 50)::decimal / COUNT(*)) * 100, 2
          ) as pass_rate
        FROM "Subject" subj
        LEFT JOIN "Assignment" a ON subj.id = a."subjectId"
        LEFT JOIN "Result" r ON a.id = r."assignmentId"
        LEFT JOIN "ExamQuestion" eq ON subj.id = eq."subjectId"
        LEFT JOIN "Exam" e ON eq.id = e."examQuestionId"
        LEFT JOIN "Result" r2 ON e.id = r2."examId"
        WHERE (r."studentId" = ANY(${studentIds}) OR r2."studentId" = ANY(${studentIds}))
          AND subj."schoolId" = ${classRecord.schoolId}
        GROUP BY subj.name
        HAVING COUNT(COALESCE(r.id, r2.id)) > 0
        ORDER BY average_percentage DESC
      `,
            // Daily attendance trends
            setup_1.prisma.$queryRaw `
        SELECT 
          date,
          COUNT(*) as total_students,
          COUNT(*) FILTER (WHERE present = true) as present_count,
          ROUND(
            (COUNT(*) FILTER (WHERE present = true)::decimal / COUNT(*)) * 100, 2
          ) as daily_attendance_rate
        FROM "Attendance"
        WHERE "studentId" = ANY(${studentIds})
          AND date >= NOW() - INTERVAL '14 days'
        GROUP BY date
        ORDER BY date DESC
      `,
            // Disciplinary records (if any)
            setup_1.prisma.attendance.count({
                where: {
                    studentId: { in: studentIds },
                    present: false,
                    note: { not: null },
                    date: { gte: dateFilter.date.gte },
                },
            }),
        ]);
        // Get subjects for the class through assignments and lessons
        const classSubjects = await setup_1.prisma.subject.findMany({
            where: {
                schoolId: classRecord.schoolId,
                OR: [{ assignments: { some: { classId: classId } } }, { lessons: { some: { classId: classId } } }],
            },
        });
        const analytics = {
            class: {
                id: classRecord.id,
                name: classRecord.name,
                grade: classRecord.grade,
                supervisor: classRecord.supervisor
                    ? {
                        name: `${classRecord.supervisor.user.name} ${classRecord.supervisor.user.surname}`,
                    }
                    : null,
                totalStudents: studentIds.length,
                subjects: classSubjects.length,
            },
            attendance: {
                ...(attendanceStats[0] || {
                    total_records: 0,
                    present_count: 0,
                    absent_count: 0,
                    attendance_rate: 0,
                    weekly_trend: 0,
                }),
                dailyTrends: attendanceTrends,
            },
            academic: {
                ...(academicPerformance[0] || {
                    class_average: 0,
                    highest_score: 0,
                    lowest_score: 0,
                    total_results: 0,
                    improvement_rate: 0,
                }),
                subjectPerformance,
            },
            assignments: assignmentStats[0] || {
                total_assignments: 0,
                total_submissions: 0,
                submission_rate: 0,
                overdue_assignments: 0,
                avg_completion_time: 0,
            },
            insights: {
                topPerformers,
                strugglingStudents,
                disciplinaryIssues: disciplinaryRecords,
                classHealth: {
                    attendanceGrade: attendanceStats[0]?.attendance_rate >= 85
                        ? "Excellent"
                        : attendanceStats[0]?.attendance_rate >= 75
                            ? "Good"
                            : attendanceStats[0]?.attendance_rate >= 65
                                ? "Fair"
                                : "Poor",
                    academicGrade: academicPerformance[0]?.class_average >= 80
                        ? "Excellent"
                        : academicPerformance[0]?.class_average >= 70
                            ? "Good"
                            : academicPerformance[0]?.class_average >= 60
                                ? "Fair"
                                : "Poor",
                },
            },
        };
        setup_1.logger.info("Enhanced class analytics retrieved", {
            userId: req.user?.id,
            classId: classId,
            role: req.user?.role,
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
        // Enhanced role-based access control
        if (!["PRINCIPAL", "SCHOOL_ADMIN", "SUPER_ADMIN"].includes(req.user?.role || "")) {
            return res.status(403).json({ message: "Access denied" });
        }
        const schoolId = req.user?.schoolId;
        // Enhanced parent engagement metrics
        const [totalParents, activeParents, verifiedParents, messageStats, eventParticipation, paymentStats, appUsageStats, feedbackStats,] = await Promise.all([
            // Total parents with children in this school
            setup_1.prisma.parent.count({
                where: {
                    children: { some: { schoolId: req.user?.schoolId } },
                },
            }),
            // Active parents (logged in within last 30 days)
            setup_1.prisma.parent.count({
                where: {
                    children: { some: { schoolId: req.user?.schoolId } },
                    user: {
                        lastLogin: {
                            gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
                        },
                    },
                },
            }),
            // Verified parents
            setup_1.prisma.parent.count({
                where: {
                    children: { some: { schoolId: req.user?.schoolId } },
                    verificationStatus: "VERIFIED",
                },
            }),
            // Enhanced message statistics
            setup_1.prisma.$queryRaw `
        SELECT 
          COUNT(*) as total_messages,
          COUNT(DISTINCT "senderId") as active_senders,
          COUNT(*) FILTER (WHERE "readAt" IS NULL) as unread_messages,
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
            // Enhanced event participation
            setup_1.prisma.$queryRaw `
        SELECT 
          COUNT(DISTINCT e.id) as total_events,
          COUNT(rsvp.id) as total_rsvps,
          COUNT(rsvp.id) FILTER (WHERE rsvp.response = 'ATTENDING') as attending_count,
          ROUND(
            (COUNT(rsvp.id) FILTER (WHERE rsvp.response = 'ATTENDING')::decimal / 
             NULLIF(COUNT(rsvp.id), 0)) * 100, 2
          ) as participation_rate
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
            // Enhanced payment statistics
            setup_1.prisma.$queryRaw `
        SELECT 
          COUNT(*) as total_payments,
          COUNT(*) FILTER (WHERE status = 'COMPLETED') as completed_payments,
          COUNT(*) FILTER (WHERE status = 'PENDING') as pending_payments,
          COUNT(*) FILTER (WHERE status = 'PENDING' AND "createdAt" < NOW() - INTERVAL '30 days') as overdue_payments,
          AVG(
            EXTRACT(EPOCH FROM ("paymentDate" - "createdAt")) / 86400
          ) as avg_payment_time_days,
          SUM(amount) FILTER (WHERE status = 'COMPLETED') as total_revenue,
          ROUND(
            (COUNT(*) FILTER (WHERE status = 'COMPLETED')::decimal / COUNT(*)) * 100, 2
          ) as collection_rate
        FROM "Payment" p
        WHERE p."schoolId" = ${schoolId}
          AND p."createdAt" >= NOW() - INTERVAL '90 days'
      `,
            // Enhanced app usage statistics
            setup_1.prisma.$queryRaw `
        SELECT 
          COUNT(DISTINCT n."userId") as active_users,
          COUNT(DISTINCT n."userId") FILTER (WHERE n."createdAt" >= NOW() - INTERVAL '1 day') as daily_active_users,
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
            // Parent feedback statistics - Fixed null handling
            setup_1.prisma.parentFeedback.aggregate({
                where: {
                    parent: {
                        children: { some: { schoolId: req.user?.schoolId } },
                    },
                },
                _avg: { rating: true },
                _count: true,
            }),
        ]);
        const analytics = {
            overview: {
                totalParents,
                activeParents,
                verifiedParents,
                engagementRate: totalParents > 0 ? ((activeParents / totalParents) * 100).toFixed(2) : "0.00",
                verificationRate: totalParents > 0 ? ((verifiedParents / totalParents) * 100).toFixed(2) : "0.00",
            },
            communication: {
                ...(messageStats[0] || {
                    total_messages: 0,
                    active_senders: 0,
                    avg_response_time_hours: 0,
                    unread_messages: 0,
                }),
                responseRate: messageStats[0]?.total_messages > 0
                    ? (((messageStats[0].total_messages - messageStats[0].unread_messages) / messageStats[0].total_messages) *
                        100).toFixed(2)
                    : "0.00",
            },
            events: eventParticipation[0] || {
                total_events: 0,
                total_rsvps: 0,
                attending_count: 0,
                participation_rate: 0,
            },
            payments: paymentStats[0] || {
                total_payments: 0,
                completed_payments: 0,
                pending_payments: 0,
                overdue_payments: 0,
                avg_payment_time_days: 0,
                total_revenue: 0,
                collection_rate: 0,
            },
            appUsage: appUsageStats[0] || {
                active_users: 0,
                daily_active_users: 0,
                total_notifications: 0,
                read_notifications: 0,
                read_rate: 0,
            },
            feedback: {
                averageRating: feedbackStats._avg.rating?.toFixed(2) || "0.00",
                totalFeedbacks: feedbackStats._count,
                satisfactionLevel: feedbackStats._avg.rating && feedbackStats._avg.rating >= 4
                    ? "High"
                    : feedbackStats._avg.rating && feedbackStats._avg.rating >= 3
                        ? "Medium"
                        : "Low",
            },
        };
        setup_1.logger.info("Enhanced parent engagement analytics retrieved", {
            userId: req.user?.id,
            schoolId: req.user?.schoolId,
            role: req.user?.role,
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
const getTeacherAnalytics = async (req, res) => {
    const { teacherId } = req.params;
    try {
        // Role-based access control
        if (req.user?.role === "TEACHER" && req.user?.id !== teacherId) {
            return res.status(403).json({ message: "Access denied" });
        }
        if (!["TEACHER", "PRINCIPAL", "SCHOOL_ADMIN", "SUPER_ADMIN"].includes(req.user?.role || "")) {
            return res.status(403).json({ message: "Access denied" });
        }
        const teacher = await setup_1.prisma.teacher.findFirst({
            where: {
                id: teacherId,
                ...(0, setup_1.getTenantFilter)(req.user),
            },
            include: {
                user: { select: { name: true, surname: true, email: true } },
                subjects: true,
                supervisedClasses: { include: { students: true, grade: true } },
            },
        });
        if (!teacher) {
            return res.status(404).json({ message: "Teacher not found or access denied" });
        }
        // Get teacher-specific analytics
        const [totalStudents, totalClasses, totalSubjects, assignmentStats, studentPerformance, classPerformance, feedbackStats,] = await Promise.all([
            // Total students taught
            setup_1.prisma.student.count({
                where: {
                    OR: [{ class: { supervisorId: teacherId } }, { class: { lessons: { some: { teacherId } } } }],
                },
            }),
            // Total classes
            setup_1.prisma.class.count({
                where: {
                    OR: [{ supervisorId: teacherId }, { lessons: { some: { teacherId } } }],
                },
            }),
            // Total subjects taught
            teacher.subjects.length,
            // Assignment statistics
            setup_1.prisma.$queryRaw `
        SELECT 
          COUNT(a.id) as total_assignments,
          COUNT(sub.id) as total_submissions,
          ROUND(
            (COUNT(sub.id)::decimal / (COUNT(a.id) * 
              (SELECT COUNT(*) FROM "Student" s 
               WHERE s."classId" IN (
                 SELECT DISTINCT c.id FROM "Class" c 
                 WHERE c."supervisorId" = ${teacherId} 
                 OR EXISTS (SELECT 1 FROM "Lesson" l WHERE l."classId" = c.id AND l."teacherId" = ${teacherId})
               ))
            )) * 100, 2
          ) as submission_rate,
          AVG(r.percentage) as avg_score
        FROM "Assignment" a
        LEFT JOIN "AssignmentSubmission" sub ON a.id = sub."assignmentId"
        LEFT JOIN "Result" r ON a.id = r."assignmentId"
        WHERE a."teacherId" = ${teacherId}
          AND a."createdAt" >= NOW() - INTERVAL '3 months'
      `,
            // Student performance under this teacher
            setup_1.prisma.$queryRaw `
        SELECT 
          AVG(r.percentage) as avg_performance,
          COUNT(DISTINCT r."studentId") as students_with_results,
          COUNT(r.id) as total_results
        FROM "Result" r
        JOIN "Assignment" a ON r."assignmentId" = a.id
        WHERE a."teacherId" = ${teacherId}
          AND r."uploadedAt" >= NOW() - INTERVAL '3 months'
      `,
            // Class performance comparison - Fixed to use proper relations
            setup_1.prisma.$queryRaw `
        SELECT 
          c.id,
          c.name as class_name,
          g.name as grade_name,
          AVG(r.percentage) as avg_performance,
          COUNT(DISTINCT s.id) as total_students
        FROM "Class" c
        JOIN "Grade" g ON c."gradeId" = g.id
        LEFT JOIN "Student" s ON c.id = s."classId"
        LEFT JOIN "Result" r ON s.id = r."studentId"
        WHERE (c."supervisorId" = ${teacherId} OR 
               EXISTS (SELECT 1 FROM "Lesson" l WHERE l."classId" = c.id AND l."teacherId" = ${teacherId}))
          AND r."uploadedAt" >= NOW() - INTERVAL '3 months'
        GROUP BY c.id, c.name, g.name
        ORDER BY avg_performance DESC
      `,
            // Parent feedback for this teacher - Fixed null handling
            setup_1.prisma.parentFeedback.aggregate({
                where: { teacherId },
                _avg: { rating: true },
                _count: true,
            }),
        ]);
        const analytics = {
            teacher: {
                id: teacher.id,
                name: `${teacher.user.name} ${teacher.user.surname}`,
                email: teacher.user.email,
                subjects: teacher.subjects.map((s) => s.name),
                approvalStatus: teacher.approvalStatus,
            },
            overview: {
                totalStudents,
                totalClasses,
                totalSubjects,
                supervisedClasses: teacher.supervisedClasses.length,
            },
            assignments: assignmentStats[0] || {
                total_assignments: 0,
                total_submissions: 0,
                submission_rate: 0,
                avg_score: 0,
            },
            performance: {
                studentPerformance: studentPerformance[0] || {
                    avg_performance: 0,
                    students_with_results: 0,
                    total_results: 0,
                },
                classPerformance,
            },
            feedback: {
                averageRating: feedbackStats._avg.rating?.toFixed(2) || "0.00",
                totalFeedbacks: feedbackStats._count,
                satisfactionLevel: feedbackStats._avg.rating && feedbackStats._avg.rating >= 4
                    ? "High"
                    : feedbackStats._avg.rating && feedbackStats._avg.rating >= 3
                        ? "Medium"
                        : "Low",
            },
        };
        setup_1.logger.info("Teacher analytics retrieved", {
            userId: req.user?.id,
            teacherId,
            role: req.user?.role,
        });
        res.status(200).json({
            message: "Teacher analytics retrieved successfully",
            analytics,
        });
    }
    catch (error) {
        (0, setup_1.handleError)(res, error, "Failed to retrieve teacher analytics");
    }
};
exports.getTeacherAnalytics = getTeacherAnalytics;
