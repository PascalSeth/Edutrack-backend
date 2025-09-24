"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getTimetableForChild = void 0;
const setup_1 = require("../../utils/setup");
// Helper to calculate duration in minutes from "HH:MM" strings
const calculateDuration = (startTimeStr, endTimeStr) => {
    const [startHour, startMinute] = startTimeStr.split(":").map(Number);
    const [endHour, endMinute] = endTimeStr.split(":").map(Number);
    const startMinutes = startHour * 60 + startMinute;
    const endMinutes = endHour * 60 + endMinute;
    return endMinutes - startMinutes;
};
const getTimetableForChild = async (req, res) => {
    try {
        const { studentId } = req.params;
        const { day, startTime, endTime, subjectId, teacherId } = req.query;
        if (!studentId) {
            return res.status(400).json({ message: "Student ID is required." });
        }
        // 1. Find the student and their class
        const student = await setup_1.prisma.student.findUnique({
            where: { id: studentId },
            select: {
                id: true,
                name: true,
                surname: true,
                classId: true,
            },
        });
        if (!student) {
            return res.status(404).json({ message: "Student not found." });
        }
        if (!student.classId) {
            return res.status(404).json({ message: "Student is not assigned to a class, no timetable available." });
        }
        // 2. Find the active timetable associated with the student's class
        const today = new Date();
        today.setHours(0, 0, 0, 0); // Normalize to start of day
        const activeTimetable = await setup_1.prisma.timetable.findFirst({
            where: {
                isActive: true,
                effectiveFrom: { lte: today },
                OR: [{ effectiveTo: { gte: today } }, { effectiveTo: null }],
                // Corrected: Use 'Class' (singular) as the relation name for many-to-many
                Class: {
                    some: {
                        id: student.classId,
                    },
                },
            },
            select: {
                id: true,
                name: true, // Include timetable name for context
            },
        });
        if (!activeTimetable) {
            return res.status(404).json({ message: "No active timetable found for this student's class." });
        }
        // 3. Build the WHERE clause for timetable slots query
        const slotWhereClause = {
            timetableId: activeTimetable.id,
        };
        if (day) {
            slotWhereClause.day = String(day).toUpperCase(); // Assuming Day enum values are uppercase
        }
        if (startTime) {
            slotWhereClause.startTime = { gte: String(startTime) };
        }
        if (endTime) {
            slotWhereClause.endTime = { lte: String(endTime) };
        }
        if (subjectId) {
            slotWhereClause.lesson = {
                subjectId: String(subjectId),
            };
        }
        if (teacherId) {
            slotWhereClause.teacherId = String(teacherId);
        }
        // 4. Fetch timetable slots - Now the type matches the query
        const timetableSlots = await setup_1.prisma.timetableSlot.findMany({
            where: slotWhereClause,
            include: {
                lesson: {
                    include: {
                        subject: true, // Include the full subject object
                    },
                },
                teacher: {
                    include: {
                        user: {
                            select: {
                                name: true,
                                surname: true,
                            },
                        },
                    },
                },
                room: true, // Include the full room object
            },
            orderBy: [{ day: "asc" }, { startTime: "asc" }],
        });
        // 5. Group by day and format the results
        const timetableByDay = {};
        timetableSlots.forEach((slot) => {
            if (!timetableByDay[slot.day]) {
                timetableByDay[slot.day] = [];
            }
            timetableByDay[slot.day].push({
                startTime: slot.startTime,
                endTime: slot.endTime,
                subject: {
                    name: slot.lesson?.subject?.name || "N/A",
                    code: slot.lesson?.subject?.code || "N/A",
                },
                teacher: slot.teacher?.user ? {
                    name: slot.teacher.user.name,
                    surname: slot.teacher.user.surname,
                } : { name: "N/A", surname: "" },
                room: {
                    name: slot.room?.name || "N/A",
                },
            });
        });
        const timetable = Object.keys(timetableByDay).map((day) => ({
            day: day.toUpperCase(),
            periods: timetableByDay[day],
        }));
        res.status(200).json({
            message: "Timetable retrieved successfully",
            timetable,
        });
    }
    catch (error) {
        console.error("Error fetching timetable:", error);
        res.status(500).json({ message: "Failed to fetch timetable", error: error.message });
    }
};
exports.getTimetableForChild = getTimetableForChild;
