"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getEventsPerDatesAndTypes = void 0;
const client_1 = require("@prisma/client");
const prisma = new client_1.PrismaClient();
const getEventsPerDatesAndTypes = async (req, res) => {
    try {
        const { startDate: startParam, endDate: endParam, types, schoolId } = req.query;
        if (!schoolId) {
            return res.status(400).json({ message: "School ID is required." });
        }
        const startDate = startParam ? new Date(startParam) : new Date();
        // Default to 7 days from start if endDate is not provided
        const endDate = endParam ? new Date(endParam) : new Date(startDate.getTime() + 7 * 24 * 60 * 60 * 1000);
        if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
            return res.status(400).json({ message: "Invalid date format. Use YYYY-MM-DD." });
        }
        const eventTypes = types
            ? types.split(",").map((type) => type.trim().toUpperCase())
            : ["EXAM", "HOLIDAY", "EVENT", "ASSIGNMENT"];
        let allEvents = [];
        if (eventTypes.includes("EXAM")) {
            const exams = await prisma.exam.findMany({
                where: {
                    startDate: {
                        gte: startDate,
                        lte: endDate,
                    },
                    schoolId: schoolId,
                },
                select: {
                    id: true,
                    title: true,
                    startDate: true, // Use startDate as per schema
                    endDate: true,
                    description: true,
                },
            });
            allEvents = allEvents.concat(exams.map((exam) => ({
                id: exam.id,
                type: "EXAM",
                title: exam.title,
                date: exam.startDate, // Use startDate for the calendar entry
                description: exam.description,
            })));
        }
        if (eventTypes.includes("HOLIDAY")) {
            const holidays = await prisma.holiday.findMany({
                where: {
                    startDate: {
                        gte: startDate,
                        lte: endDate,
                    },
                    schoolId: schoolId,
                },
                select: {
                    id: true,
                    name: true,
                    startDate: true, // Use startDate as per schema
                    endDate: true,
                    description: true,
                },
            });
            allEvents = allEvents.concat(holidays.map((holiday) => ({
                id: holiday.id,
                type: "HOLIDAY",
                title: holiday.name,
                date: holiday.startDate, // Use startDate for the calendar entry
                description: holiday.description,
            })));
        }
        // Corrected: Assuming 'Event' model uses 'title', 'startDate', 'endDate'
        if (eventTypes.includes("EVENT")) {
            const schoolEvents = await prisma.event.findMany({
                where: {
                    startTime: {
                        // Corrected: Use startDate for filtering
                        gte: startDate,
                        lte: endDate,
                    },
                    schoolId: schoolId,
                },
                select: {
                    id: true,
                    title: true, // Corrected: Use title instead of name
                    startTime: true, // Corrected: Use startDate
                    endTime: true,
                    description: true,
                },
            });
            allEvents = allEvents.concat(schoolEvents.map((event) => ({
                // Removed explicit type for 'event' to let TS infer from select
                id: event.id,
                type: "EVENT",
                title: event.title, // Corrected: Use event.title
                date: event.startTime, // Corrected: Use event.startDate for the calendar entry
                description: event.description,
            })));
        }
        if (eventTypes.includes("ASSIGNMENT")) {
            const assignments = await prisma.assignment.findMany({
                where: {
                    dueDate: {
                        gte: startDate,
                        lte: endDate,
                    },
                    // Assuming assignments are linked to a school via the class
                    class: {
                        schoolId: schoolId,
                    },
                },
                select: {
                    id: true,
                    title: true,
                    dueDate: true,
                    description: true,
                    subject: {
                        select: {
                            name: true,
                        },
                    },
                    class: {
                        select: {
                            name: true,
                        },
                    },
                },
            });
            allEvents = allEvents.concat(assignments.map((assignment) => ({
                id: assignment.id,
                type: "ASSIGNMENT",
                title: assignment.title,
                date: assignment.dueDate,
                description: assignment.description,
                subject: assignment.subject?.name,
                class: assignment.class?.name,
            })));
        }
        // Sort events by date
        allEvents.sort((a, b) => a.date.getTime() - b.date.getTime());
        res.status(200).json({ success: true, data: allEvents });
    }
    catch (error) {
        console.error("Error fetching academic calendar events:", error);
        res.status(500).json({ message: "Failed to fetch academic calendar events.", error: error.message });
    }
};
exports.getEventsPerDatesAndTypes = getEventsPerDatesAndTypes;
