"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const helmet_1 = __importDefault(require("helmet"));
const express_rate_limit_1 = __importDefault(require("express-rate-limit"));
const setup_1 = require("./utils/setup");
// Import routes
const authRoutes_1 = __importDefault(require("./routes/authRoutes"));
const userRoutes_1 = __importDefault(require("./routes/userRoutes"));
const schoolRoutes_1 = __importDefault(require("./routes/schoolRoutes"));
const studentRoutes_1 = __importDefault(require("./routes/studentRoutes"));
const teacherRoutes_1 = __importDefault(require("./routes/teacherRoutes"));
const parentRoutes_1 = __importDefault(require("./routes/parentRoutes"));
const classRoutes_1 = __importDefault(require("./routes/classRoutes"));
const subjectRoutes_1 = __importDefault(require("./routes/subjectRoutes"));
const gradeRoutes_1 = __importDefault(require("./routes/gradeRoutes"));
const assignmentRoutes_1 = __importDefault(require("./routes/assignmentRoutes"));
const attendanceRoutes_1 = __importDefault(require("./routes/attendanceRoutes"));
const eventRoutes_1 = __importDefault(require("./routes/eventRoutes"));
const notificationRoutes_1 = __importDefault(require("./routes/notificationRoutes"));
const materialRoutes_1 = __importDefault(require("./routes/materialRoutes"));
const materialOrderRoutes_1 = __importDefault(require("./routes/materialOrderRoutes"));
const schoolPaymentRoutes_1 = __importDefault(require("./routes/schoolPaymentRoutes"));
const analyticsRoutes_1 = __importDefault(require("./routes/analyticsRoutes"));
const dashboardRoutes_1 = __importDefault(require("./routes/dashboardRoutes"));
const webhookRoutes_1 = __importDefault(require("./routes/webhookRoutes"));
const reportCardRoutes_1 = __importDefault(require("./routes/reportCardRoutes"));
const timetableRoutes_1 = __importDefault(require("./routes/timetableRoutes"));
const examRoutes_1 = __importDefault(require("./routes/examRoutes"));
const roomRoutes_1 = __importDefault(require("./routes/roomRoutes"));
const curriculumRoutes_1 = __importDefault(require("./routes/curriculumRoutes"));
const academicCalendarRoutes_1 = __importDefault(require("./routes/academicCalendarRoutes"));
const app = (0, express_1.default)();
const PORT = process.env.PORT || 3000;
// Security middleware
app.use((0, helmet_1.default)());
app.use((0, cors_1.default)({
    origin: '*',
    credentials: true,
}));
// Rate limiting
const limiter = (0, express_rate_limit_1.default)({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100, // limit each IP to 100 requests per windowMs
    message: "Too many requests from this IP, please try again later.",
});
app.use(limiter);
// Body parsing middleware
app.use(express_1.default.json({ limit: "10mb" }));
app.use(express_1.default.urlencoded({ extended: true, limit: "10mb" }));
// Health check endpoint
app.get("/health", (req, res) => {
    res.status(200).json({
        status: "OK",
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
    });
});
// API routes
app.use("/api/auth", authRoutes_1.default);
app.use("/api/users", userRoutes_1.default);
app.use("/api/schools", schoolRoutes_1.default);
app.use("/api/students", studentRoutes_1.default);
app.use("/api/teachers", teacherRoutes_1.default);
app.use("/api/parents", parentRoutes_1.default);
app.use("/api/classes", classRoutes_1.default);
app.use("/api/subjects", subjectRoutes_1.default);
app.use("/api/grades", gradeRoutes_1.default);
app.use("/api/assignments", assignmentRoutes_1.default);
app.use("/api/attendance", attendanceRoutes_1.default);
app.use("/api/events", eventRoutes_1.default);
app.use("/api/notifications", notificationRoutes_1.default);
app.use("/api/materials", materialRoutes_1.default);
app.use("/api/material-orders", materialOrderRoutes_1.default);
app.use("/api/school-payments", schoolPaymentRoutes_1.default);
app.use("/api/analytics", analyticsRoutes_1.default);
app.use("/api/dashboard", dashboardRoutes_1.default);
app.use("/api/webhooks", webhookRoutes_1.default);
app.use("/api/report-cards", reportCardRoutes_1.default);
app.use("/api/timetables", timetableRoutes_1.default);
app.use("/api/exams", examRoutes_1.default);
app.use("/api/rooms", roomRoutes_1.default);
app.use("/api/curriculum", curriculumRoutes_1.default);
app.use("/api/academic-calendar", academicCalendarRoutes_1.default);
// 404 handler
app.use("*", (req, res) => {
    res.status(404).json({ message: "Route not found" });
});
// Global error handler
app.use((err, req, res, next) => {
    setup_1.logger.error("Unhandled error:", err);
    res.status(500).json({
        message: "Internal server error",
        ...(process.env.NODE_ENV === "development" && { error: err.message }),
    });
});
app.listen(PORT, () => {
    setup_1.logger.info(`Server running on port ${PORT}`);
    setup_1.logger.info(`Environment: ${process.env.NODE_ENV || "development"}`);
});
exports.default = app;
