"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getAttendanceBasedOnFilter = void 0;
const client_1 = require("@prisma/client"); // Removed AttendanceStatus import
const prisma = new client_1.PrismaClient();
const getAttendanceBasedOnFilter = async (req, res) => {
    try {
        const { studentId, startDate: startParam, endDate: endParam, subjectId } = req.query;
        if (!studentId) {
            return res.status(400).json({ message: "Student ID is required." });
        }
        const startDate = startParam ? new Date(startParam) : new Date();
        const endDate = endParam ? new Date(endParam) : new Date(startDate.getTime() + 7 * 24 * 60 * 60 * 1000);
        if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
            return res.status(400).json({ message: "Invalid date format. Use YYYY-MM-DD." });
        }
        const student = await prisma.student.findUnique({
            where: { id: studentId },
            select: { name: true, surname: true },
        });
        if (!student) {
            return res.status(404).json({ message: "Student not found." });
        }
        const whereClause = {
            studentId: studentId,
            date: {
                gte: startDate,
                lte: endDate,
            },
        };
        if (subjectId) {
            whereClause.lesson = {
                subjectId: subjectId,
            };
        }
        const attendanceRecords = await prisma.attendance.findMany({
            where: whereClause,
            select: {
                date: true,
                present: true,
                lesson: {
                    select: {
                        subject: {
                            select: {
                                name: true,
                            },
                        },
                        teacher: {
                            select: {
                                user: {
                                    select: {
                                        name: true,
                                        surname: true,
                                    },
                                },
                            },
                        },
                    },
                },
            },
            orderBy: {
                date: "asc",
            },
        });
        const records = attendanceRecords.map((record) => ({
            date: record.date.toISOString().split("T")[0],
            present: record.present,
            subject: {
                name: record.lesson?.subject?.name || "N/A",
            },
            teacher: record.lesson?.teacher?.user ? {
                name: record.lesson.teacher.user.name,
                surname: record.lesson.teacher.user.surname,
            } : { name: "N/A", surname: "" },
        }));
        const totalDays = records.length;
        const presentDays = records.filter(r => r.present).length;
        const absentDays = totalDays - presentDays;
        const attendanceRate = totalDays > 0 ? (presentDays / totalDays * 100) : 0;
        res.status(200).json({
            message: "Attendance records retrieved successfully",
            records,
            summary: {
                totalDays,
                presentDays,
                absentDays,
                attendanceRate: Number(attendanceRate.toFixed(2)),
            },
        });
    }
    catch (error) {
        console.error("Error fetching attendance records:", error);
        res.status(500).json({ message: "Failed to fetch attendance records.", error: error.message });
    }
};
exports.getAttendanceBasedOnFilter = getAttendanceBasedOnFilter;
