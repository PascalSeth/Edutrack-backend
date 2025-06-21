"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getAttendanceAnalytics = exports.getClassAttendance = exports.getStudentAttendance = exports.recordBulkAttendance = exports.recordAttendance = void 0;
const zod_1 = require("zod");
const setup_1 = require("../utils/setup");
// Validation Schemas
const recordAttendanceSchema = zod_1.z.object({
    studentId: zod_1.z.string().uuid("Invalid student ID"),
    lessonId: zod_1.z.string().uuid("Invalid lesson ID").optional(),
    date: zod_1.z.string().datetime("Invalid date").optional(),
    present: zod_1.z.boolean(),
    note: zod_1.z.string().optional(),
});
const bulkAttendanceSchema = zod_1.z.object({
    lessonId: zod_1.z.string().uuid("Invalid lesson ID").optional(),
    date: zod_1.z.string().datetime("Invalid date").optional(),
    attendanceRecords: zod_1.z.array(zod_1.z.object({
        studentId: zod_1.z.string().uuid("Invalid student ID"),
        present: zod_1.z.boolean(),
        note: zod_1.z.string().optional(),
    })),
});
const recordAttendance = async (req, res) => {
    try {
        const data = recordAttendanceSchema.parse(req.body);
        // Only teachers can record attendance
        if (req.user?.role !== "TEACHER") {
            return res.status(403).json({ message: "Only teachers can record attendance" });
        }
        const attendanceDate = data.date ? new Date(data.date) : new Date();
        // Verify student exists and teacher has access
        const student = await setup_1.prisma.student.findFirst({
            where: {
                id: data.studentId,
                ...(0, setup_1.getTenantFilter)(req.user),
            },
            include: {
                parent: { include: { user: true } },
                class: { select: { name: true } },
            },
        });
        if (!student) {
            return res.status(404).json({ message: "Student not found or access denied" });
        }
        // Verify lesson if provided
        if (data.lessonId) {
            const lesson = await setup_1.prisma.lesson.findFirst({
                where: {
                    id: data.lessonId,
                    teacherId: req.user.id,
                },
            });
            if (!lesson) {
                return res.status(404).json({ message: "Lesson not found or access denied" });
            }
        }
        // Create or update attendance record
        const attendance = await setup_1.prisma.attendance.upsert({
            where: {
                studentId_lessonId_date: {
                    studentId: data.studentId,
                    lessonId: data.lessonId || "",
                    date: attendanceDate,
                },
            },
            update: {
                present: data.present,
                note: data.note,
                recordedById: req.user.id,
            },
            create: {
                studentId: data.studentId,
                lessonId: data.lessonId,
                date: attendanceDate,
                present: data.present,
                note: data.note,
                recordedById: req.user.id,
            },
        });
        // Notify parent if student is absent
        if (!data.present) {
            await (0, setup_1.createNotification)(student.parent.user.id, "Attendance Alert", `${student.name} ${student.surname} was marked absent ${data.lessonId ? "for a lesson" : "today"}${student.class ? ` in ${student.class.name}` : ""}. ${data.note ? `Note: ${data.note}` : ""}`, "ATTENDANCE", {
                studentId: data.studentId,
                attendanceId: attendance.id,
                date: attendanceDate.toISOString(),
            });
        }
        setup_1.logger.info("Attendance recorded", {
            userId: req.user?.id,
            studentId: data.studentId,
            present: data.present,
            date: attendanceDate.toISOString(),
        });
        res.status(200).json({
            message: "Attendance recorded successfully",
            attendance,
        });
    }
    catch (error) {
        if (error instanceof zod_1.z.ZodError) {
            return res.status(400).json({ message: "Invalid input", errors: error.errors });
        }
        (0, setup_1.handleError)(res, error, "Failed to record attendance");
    }
};
exports.recordAttendance = recordAttendance;
const recordBulkAttendance = async (req, res) => {
    try {
        const data = bulkAttendanceSchema.parse(req.body);
        if (req.user?.role !== "TEACHER") {
            return res.status(403).json({ message: "Only teachers can record attendance" });
        }
        const attendanceDate = data.date ? new Date(data.date) : new Date();
        // Verify lesson if provided
        if (data.lessonId) {
            const lesson = await setup_1.prisma.lesson.findFirst({
                where: {
                    id: data.lessonId,
                    teacherId: req.user.id,
                },
            });
            if (!lesson) {
                return res.status(404).json({ message: "Lesson not found or access denied" });
            }
        }
        // Process all attendance records in a transaction
        const results = await setup_1.prisma.$transaction(async (tx) => {
            const attendancePromises = data.attendanceRecords.map(async (record) => {
                // Verify student exists
                const student = await tx.student.findFirst({
                    where: {
                        id: record.studentId,
                        ...(0, setup_1.getTenantFilter)(req.user),
                    },
                    include: {
                        parent: { include: { user: true } },
                        class: { select: { name: true } },
                    },
                });
                if (!student) {
                    throw new Error(`Student ${record.studentId} not found`);
                }
                // Create or update attendance
                const attendance = await tx.attendance.upsert({
                    where: {
                        studentId_lessonId_date: {
                            studentId: record.studentId,
                            lessonId: data.lessonId || "",
                            date: attendanceDate,
                        },
                    },
                    update: {
                        present: record.present,
                        note: record.note,
                        recordedById: req.user.id,
                    },
                    create: {
                        studentId: record.studentId,
                        lessonId: data.lessonId,
                        date: attendanceDate,
                        present: record.present,
                        note: record.note,
                        recordedById: req.user.id,
                    },
                });
                // Queue notification for absent students
                if (!record.present) {
                    await (0, setup_1.createNotification)(student.parent.user.id, "Attendance Alert", `${student.name} ${student.surname} was marked absent ${data.lessonId ? "for a lesson" : "today"}${student.class ? ` in ${student.class.name}` : ""}. ${record.note ? `Note: ${record.note}` : ""}`, "ATTENDANCE", {
                        studentId: record.studentId,
                        attendanceId: attendance.id,
                        date: attendanceDate.toISOString(),
                    });
                }
                return attendance;
            });
            return Promise.all(attendancePromises);
        });
        setup_1.logger.info("Bulk attendance recorded", {
            userId: req.user?.id,
            recordCount: data.attendanceRecords.length,
            date: attendanceDate.toISOString(),
            lessonId: data.lessonId,
        });
        res.status(200).json({
            message: "Bulk attendance recorded successfully",
            recordsProcessed: results.length,
            attendance: results,
        });
    }
    catch (error) {
        if (error instanceof zod_1.z.ZodError) {
            return res.status(400).json({ message: "Invalid input", errors: error.errors });
        }
        (0, setup_1.handleError)(res, error, "Failed to record bulk attendance");
    }
};
exports.recordBulkAttendance = recordBulkAttendance;
const getStudentAttendance = async (req, res) => {
    const { studentId } = req.params;
    try {
        const startDate = req.query.startDate;
        const endDate = req.query.endDate;
        const lessonId = req.query.lessonId;
        // Verify access to student
        let student;
        if (req.user?.role === "PARENT") {
            student = await setup_1.prisma.student.findFirst({
                where: { id: studentId, parentId: req.user.id },
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
        const where = { studentId };
        if (startDate && endDate) {
            where.date = {
                gte: new Date(startDate),
                lte: new Date(endDate),
            };
        }
        if (lessonId) {
            where.lessonId = lessonId;
        }
        const [attendance, summary] = await Promise.all([
            setup_1.prisma.attendance.findMany({
                where,
                include: {
                    lesson: {
                        include: {
                            subject: { select: { name: true } },
                            class: { select: { name: true } },
                        },
                    },
                    recordedBy: {
                        include: {
                            user: { select: { name: true, surname: true } },
                        },
                    },
                },
                orderBy: { date: "desc" },
            }),
            setup_1.prisma.attendance.groupBy({
                by: ["present"],
                where,
                _count: { present: true },
            }),
        ]);
        const attendanceSummary = {
            totalDays: attendance.length,
            presentDays: summary.find((s) => s.present)?._count.present || 0,
            absentDays: summary.find((s) => !s.present)?._count.present || 0,
            attendanceRate: attendance.length > 0
                ? (((summary.find((s) => s.present)?._count.present || 0) / attendance.length) * 100).toFixed(2)
                : "0.00",
        };
        setup_1.logger.info("Student attendance retrieved", {
            userId: req.user?.id,
            studentId,
            recordCount: attendance.length,
            dateRange: startDate && endDate ? `${startDate} to ${endDate}` : "all",
        });
        res.status(200).json({
            message: "Student attendance retrieved successfully",
            attendance,
            summary: attendanceSummary,
            student: {
                id: student.id,
                name: student.name,
                surname: student.surname,
            },
        });
    }
    catch (error) {
        (0, setup_1.handleError)(res, error, "Failed to retrieve student attendance");
    }
};
exports.getStudentAttendance = getStudentAttendance;
const getClassAttendance = async (req, res) => {
    const { classId } = req.params;
    try {
        const date = req.query.date;
        const lessonId = req.query.lessonId;
        // Verify access to class
        const classRecord = await setup_1.prisma.class.findFirst({
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
            },
        });
        if (!classRecord) {
            return res.status(404).json({ message: "Class not found or access denied" });
        }
        const attendanceDate = date ? new Date(date) : new Date();
        const where = {
            studentId: { in: classRecord.students.map((s) => s.id) },
            date: {
                gte: new Date(attendanceDate.toDateString()),
                lt: new Date(attendanceDate.getTime() + 24 * 60 * 60 * 1000),
            },
        };
        if (lessonId) {
            where.lessonId = lessonId;
        }
        const attendance = await setup_1.prisma.attendance.findMany({
            where,
            include: {
                student: {
                    select: {
                        id: true,
                        name: true,
                        surname: true,
                        registrationNumber: true,
                    },
                },
                lesson: {
                    include: {
                        subject: { select: { name: true } },
                    },
                },
            },
        });
        // Create attendance map for easy lookup
        const attendanceMap = new Map();
        attendance.forEach((record) => {
            const key = `${record.studentId}-${record.lessonId || "general"}`;
            attendanceMap.set(key, record);
        });
        // Build complete attendance list with all students
        const completeAttendance = classRecord.students.map((student) => {
            const key = `${student.id}-${lessonId || "general"}`;
            const attendanceRecord = attendanceMap.get(key);
            return {
                student,
                attendance: attendanceRecord || null,
                status: attendanceRecord ? (attendanceRecord.present ? "present" : "absent") : "not_recorded",
            };
        });
        const summary = {
            totalStudents: classRecord.students.length,
            present: attendance.filter((a) => a.present).length,
            absent: attendance.filter((a) => !a.present).length,
            notRecorded: classRecord.students.length - attendance.length,
            attendanceRate: classRecord.students.length > 0
                ? ((attendance.filter((a) => a.present).length / classRecord.students.length) * 100).toFixed(2)
                : "0.00",
        };
        setup_1.logger.info("Class attendance retrieved", {
            userId: req.user?.id,
            classId,
            date: attendanceDate.toISOString(),
            studentCount: classRecord.students.length,
        });
        res.status(200).json({
            message: "Class attendance retrieved successfully",
            attendance: completeAttendance,
            summary,
            class: {
                id: classRecord.id,
                name: classRecord.name,
            },
            date: attendanceDate.toISOString(),
        });
    }
    catch (error) {
        (0, setup_1.handleError)(res, error, "Failed to retrieve class attendance");
    }
};
exports.getClassAttendance = getClassAttendance;
const getAttendanceAnalytics = async (req, res) => {
    try {
        const studentId = req.query.studentId;
        const classId = req.query.classId;
        const startDate = req.query.startDate;
        const endDate = req.query.endDate;
        if (!studentId && !classId) {
            return res.status(400).json({ message: "Either studentId or classId is required" });
        }
        const dateFilter = startDate && endDate
            ? {
                date: {
                    gte: new Date(startDate),
                    lte: new Date(endDate),
                },
            }
            : {};
        const where = { ...dateFilter };
        if (studentId) {
            // Verify access to student
            if (req.user?.role === "PARENT") {
                const student = await setup_1.prisma.student.findFirst({
                    where: { id: studentId, parentId: req.user.id },
                });
                if (!student) {
                    return res.status(404).json({ message: "Student not found or access denied" });
                }
            }
            where.studentId = studentId;
        }
        else if (classId) {
            // Verify access to class
            const classRecord = await setup_1.prisma.class.findFirst({
                where: {
                    id: classId,
                    ...(0, setup_1.getTenantFilter)(req.user),
                },
            });
            if (!classRecord) {
                return res.status(404).json({ message: "Class not found or access denied" });
            }
            const students = await setup_1.prisma.student.findMany({
                where: { classId },
                select: { id: true },
            });
            where.studentId = { in: students.map((s) => s.id) };
        }
        // Get attendance analytics
        const [totalRecords, presentCount, absentCount, weeklyTrends, monthlyTrends] = await Promise.all([
            setup_1.prisma.attendance.count({ where }),
            setup_1.prisma.attendance.count({ where: { ...where, present: true } }),
            setup_1.prisma.attendance.count({ where: { ...where, present: false } }),
            // Weekly trends (last 4 weeks)
            setup_1.prisma.$queryRaw `
        SELECT 
          DATE_TRUNC('week', date) as week,
          COUNT(*) as total,
          COUNT(*) FILTER (WHERE present = true) as present,
          COUNT(*) FILTER (WHERE present = false) as absent
        FROM "Attendance"
        WHERE ${studentId ? `"studentId" = ${studentId}` : `"studentId" = ANY(${JSON.stringify(where.studentId.in)})`}
          AND date >= NOW() - INTERVAL '4 weeks'
        GROUP BY DATE_TRUNC('week', date)
        ORDER BY week DESC
      `,
            // Monthly trends (last 6 months)
            setup_1.prisma.$queryRaw `
        SELECT 
          DATE_TRUNC('month', date) as month,
          COUNT(*) as total,
          COUNT(*) FILTER (WHERE present = true) as present,
          COUNT(*) FILTER (WHERE present = false) as absent
        FROM "Attendance"
        WHERE ${studentId ? `"studentId" = ${studentId}` : `"studentId" = ANY(${JSON.stringify(where.studentId.in)})`}
          AND date >= NOW() - INTERVAL '6 months'
        GROUP BY DATE_TRUNC('month', date)
        ORDER BY month DESC
      `,
        ]);
        const analytics = {
            summary: {
                totalRecords,
                presentCount,
                absentCount,
                attendanceRate: totalRecords > 0 ? ((presentCount / totalRecords) * 100).toFixed(2) : "0.00",
            },
            trends: {
                weekly: weeklyTrends,
                monthly: monthlyTrends,
            },
        };
        setup_1.logger.info("Attendance analytics retrieved", {
            userId: req.user?.id,
            studentId,
            classId,
            dateRange: startDate && endDate ? `${startDate} to ${endDate}` : "all",
        });
        res.status(200).json({
            message: "Attendance analytics retrieved successfully",
            analytics,
        });
    }
    catch (error) {
        (0, setup_1.handleError)(res, error, "Failed to retrieve attendance analytics");
    }
};
exports.getAttendanceAnalytics = getAttendanceAnalytics;
