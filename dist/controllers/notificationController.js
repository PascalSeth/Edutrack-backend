"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.updateNotificationPreferences = exports.getNotificationPreferences = exports.getNotificationStats = exports.deleteNotification = exports.markAllAsRead = exports.markAsRead = exports.createNotification = exports.getNotifications = void 0;
const zod_1 = require("zod");
const setup_1 = require("../utils/setup");
// Validation Schemas
const createNotificationSchema = zod_1.z.object({
    title: zod_1.z.string().min(1, "Title is required"),
    content: zod_1.z.string().min(1, "Content is required"),
    type: zod_1.z.enum([
        "ATTENDANCE",
        "ASSIGNMENT",
        "EXAM",
        "RESULT",
        "PAYMENT",
        "ANNOUNCEMENT",
        "EVENT",
        "MESSAGE",
        "APPROVAL",
        "REMINDER",
        "GENERAL",
    ]),
    priority: zod_1.z.enum(["LOW", "NORMAL", "HIGH", "URGENT"]).default("NORMAL"),
    targetUserIds: zod_1.z.array(zod_1.z.string().uuid()).optional(),
    targetRoles: zod_1.z.array(zod_1.z.enum(["TEACHER", "PARENT", "PRINCIPAL", "SCHOOL_ADMIN"])).optional(),
    classId: zod_1.z.string().uuid().optional(),
    data: zod_1.z.record(zod_1.z.any()).optional(),
    actionUrl: zod_1.z.string().optional(),
    imageUrl: zod_1.z.string().optional(),
});
const markAsReadSchema = zod_1.z.object({
    notificationIds: zod_1.z.array(zod_1.z.string().uuid()),
});
const getNotifications = async (req, res) => {
    try {
        const page = Number.parseInt(req.query.page) || 1;
        const limit = Number.parseInt(req.query.limit) || 20;
        const skip = (page - 1) * limit;
        const unreadOnly = req.query.unreadOnly === "true";
        const type = req.query.type;
        const priority = req.query.priority;
        const where = { userId: req.user.id };
        if (unreadOnly) {
            where.isRead = false;
        }
        if (type) {
            where.type = type;
        }
        if (priority) {
            where.priority = priority;
        }
        const [notifications, total, unreadCount] = await Promise.all([
            setup_1.prisma.notification.findMany({
                where,
                skip,
                take: limit,
                orderBy: [{ priority: "desc" }, { createdAt: "desc" }],
            }),
            setup_1.prisma.notification.count({ where }),
            setup_1.prisma.notification.count({
                where: {
                    userId: req.user.id,
                    isRead: false,
                },
            }),
        ]);
        setup_1.logger.info("Notifications retrieved", {
            userId: req.user?.id,
            page,
            limit,
            total,
            unreadCount,
            filters: { unreadOnly, type, priority },
        });
        res.status(200).json({
            message: "Notifications retrieved successfully",
            notifications,
            pagination: { page, limit, total, pages: Math.ceil(total / limit) },
            unreadCount,
        });
    }
    catch (error) {
        (0, setup_1.handleError)(res, error, "Failed to retrieve notifications");
    }
};
exports.getNotifications = getNotifications;
const createNotification = async (req, res) => {
    try {
        const data = createNotificationSchema.parse(req.body);
        // Only principals and school admins can create notifications
        if (!["PRINCIPAL", "SCHOOL_ADMIN", "SUPER_ADMIN"].includes(req.user?.role || "")) {
            return res.status(403).json({ message: "Access denied" });
        }
        let targetUserIds = [];
        // Determine target users
        if (data.targetUserIds) {
            targetUserIds = data.targetUserIds;
        }
        else if (data.targetRoles || data.classId) {
            const filter = (0, setup_1.getTenantFilter)(req.user);
            // Build user query based on roles and class
            const userWhere = {};
            if (data.targetRoles) {
                userWhere.role = { in: data.targetRoles };
            }
            // Add school filter for non-super admins
            if (req.user?.role !== "SUPER_ADMIN") {
                if (data.targetRoles?.includes("TEACHER")) {
                    userWhere.teacher = { schoolId: req.user?.schoolId };
                }
                if (data.targetRoles?.includes("PARENT")) {
                    userWhere.parent = { schoolId: req.user?.schoolId };
                }
                if (data.targetRoles?.includes("PRINCIPAL")) {
                    userWhere.principal = { schoolId: req.user?.schoolId };
                }
                if (data.targetRoles?.includes("SCHOOL_ADMIN")) {
                    userWhere.schoolAdmin = { schoolId: req.user?.schoolId };
                }
            }
            // If class is specified, filter parents by their children in that class
            if (data.classId && data.targetRoles?.includes("PARENT")) {
                const students = await setup_1.prisma.student.findMany({
                    where: { classId: data.classId },
                    select: { parentId: true },
                });
                const parentIds = students.map((s) => s.parentId);
                userWhere.parent = {
                    ...userWhere.parent,
                    id: { in: parentIds },
                };
            }
            const users = await setup_1.prisma.user.findMany({
                where: userWhere,
                select: { id: true },
            });
            targetUserIds = users.map((u) => u.id);
        }
        if (targetUserIds.length === 0) {
            return res.status(400).json({ message: "No target users specified" });
        }
        // Create notifications for all target users
        const notifications = await setup_1.prisma.$transaction(targetUserIds.map((userId) => setup_1.prisma.notification.create({
            data: {
                userId,
                title: data.title,
                content: data.content,
                type: data.type,
                priority: data.priority,
                data: data.data,
                actionUrl: data.actionUrl,
                imageUrl: data.imageUrl,
            },
        })));
        setup_1.logger.info("Bulk notifications created", {
            userId: req.user?.id,
            notificationCount: notifications.length,
            type: data.type,
            priority: data.priority,
        });
        res.status(201).json({
            message: "Notifications created successfully",
            notificationCount: notifications.length,
            notifications: notifications.slice(0, 5), // Return first 5 as sample
        });
    }
    catch (error) {
        if (error instanceof zod_1.z.ZodError) {
            return res.status(400).json({ message: "Invalid input", errors: error.errors });
        }
        (0, setup_1.handleError)(res, error, "Failed to create notifications");
    }
};
exports.createNotification = createNotification;
const markAsRead = async (req, res) => {
    try {
        const data = markAsReadSchema.parse(req.body);
        // Update notifications to mark as read
        const result = await setup_1.prisma.notification.updateMany({
            where: {
                id: { in: data.notificationIds },
                userId: req.user.id, // Ensure user can only mark their own notifications
            },
            data: {
                isRead: true,
                readAt: new Date(),
            },
        });
        setup_1.logger.info("Notifications marked as read", {
            userId: req.user?.id,
            notificationIds: data.notificationIds,
            updatedCount: result.count,
        });
        res.status(200).json({
            message: "Notifications marked as read",
            updatedCount: result.count,
        });
    }
    catch (error) {
        if (error instanceof zod_1.z.ZodError) {
            return res.status(400).json({ message: "Invalid input", errors: error.errors });
        }
        (0, setup_1.handleError)(res, error, "Failed to mark notifications as read");
    }
};
exports.markAsRead = markAsRead;
const markAllAsRead = async (req, res) => {
    try {
        const result = await setup_1.prisma.notification.updateMany({
            where: {
                userId: req.user.id,
                isRead: false,
            },
            data: {
                isRead: true,
                readAt: new Date(),
            },
        });
        setup_1.logger.info("All notifications marked as read", {
            userId: req.user?.id,
            updatedCount: result.count,
        });
        res.status(200).json({
            message: "All notifications marked as read",
            updatedCount: result.count,
        });
    }
    catch (error) {
        (0, setup_1.handleError)(res, error, "Failed to mark all notifications as read");
    }
};
exports.markAllAsRead = markAllAsRead;
const deleteNotification = async (req, res) => {
    const { id } = req.params;
    try {
        // Verify notification belongs to user
        const notification = await setup_1.prisma.notification.findFirst({
            where: { id, userId: req.user.id },
        });
        if (!notification) {
            return res.status(404).json({ message: "Notification not found" });
        }
        await setup_1.prisma.notification.delete({ where: { id } });
        setup_1.logger.info("Notification deleted", {
            userId: req.user?.id,
            notificationId: id,
        });
        res.status(200).json({ message: "Notification deleted successfully" });
    }
    catch (error) {
        (0, setup_1.handleError)(res, error, "Failed to delete notification");
    }
};
exports.deleteNotification = deleteNotification;
const getNotificationStats = async (req, res) => {
    try {
        const [totalNotifications, unreadCount, priorityBreakdown, typeBreakdown, recentActivity] = await Promise.all([
            setup_1.prisma.notification.count({ where: { userId: req.user.id } }),
            setup_1.prisma.notification.count({
                where: { userId: req.user.id, isRead: false },
            }),
            setup_1.prisma.notification.groupBy({
                by: ["priority"],
                where: { userId: req.user.id, isRead: false },
                _count: { priority: true },
            }),
            setup_1.prisma.notification.groupBy({
                by: ["type"],
                where: { userId: req.user.id, isRead: false },
                _count: { type: true },
            }),
            setup_1.prisma.notification.findMany({
                where: {
                    userId: req.user.id,
                    createdAt: {
                        gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000), // Last 7 days
                    },
                },
                select: {
                    createdAt: true,
                    type: true,
                    priority: true,
                },
                orderBy: { createdAt: "desc" },
            }),
        ]);
        const stats = {
            overview: {
                totalNotifications,
                unreadCount,
                readRate: totalNotifications > 0
                    ? (((totalNotifications - unreadCount) / totalNotifications) * 100).toFixed(2)
                    : "0.00",
            },
            breakdown: {
                byPriority: priorityBreakdown.reduce((acc, item) => {
                    acc[item.priority] = item._count.priority;
                    return acc;
                }, {}),
                byType: typeBreakdown.reduce((acc, item) => {
                    acc[item.type] = item._count.type;
                    return acc;
                }, {}),
            },
            recentActivity: recentActivity.length,
        };
        setup_1.logger.info("Notification stats retrieved", {
            userId: req.user?.id,
            totalNotifications,
            unreadCount,
        });
        res.status(200).json({
            message: "Notification statistics retrieved successfully",
            stats,
        });
    }
    catch (error) {
        (0, setup_1.handleError)(res, error, "Failed to retrieve notification statistics");
    }
};
exports.getNotificationStats = getNotificationStats;
const getNotificationPreferences = async (req, res) => {
    try {
        // This would typically be stored in a separate UserPreferences table
        // For now, we'll return default preferences
        const preferences = {
            email: {
                assignments: true,
                grades: true,
                attendance: true,
                events: true,
                payments: true,
                announcements: true,
            },
            push: {
                assignments: true,
                grades: true,
                attendance: true,
                events: true,
                payments: false,
                announcements: true,
            },
            sms: {
                assignments: false,
                grades: false,
                attendance: true,
                events: false,
                payments: true,
                announcements: false,
            },
        };
        res.status(200).json({
            message: "Notification preferences retrieved successfully",
            preferences,
        });
    }
    catch (error) {
        (0, setup_1.handleError)(res, error, "Failed to retrieve notification preferences");
    }
};
exports.getNotificationPreferences = getNotificationPreferences;
const updateNotificationPreferences = async (req, res) => {
    try {
        // This would update the UserPreferences table
        // For now, we'll just return success
        const preferences = req.body;
        setup_1.logger.info("Notification preferences updated", {
            userId: req.user?.id,
            preferences: JSON.stringify(preferences),
        });
        res.status(200).json({
            message: "Notification preferences updated successfully",
            preferences,
        });
    }
    catch (error) {
        (0, setup_1.handleError)(res, error, "Failed to update notification preferences");
    }
};
exports.updateNotificationPreferences = updateNotificationPreferences;
