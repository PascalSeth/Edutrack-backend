"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const dotenv_1 = __importDefault(require("dotenv"));
const userRoutes_1 = __importDefault(require("./routes/userRoutes"));
const schoolRoutes_1 = __importDefault(require("./routes/schoolRoutes"));
const studentRoutes_1 = __importDefault(require("./routes/studentRoutes"));
const teacherRoutes_1 = __importDefault(require("./routes/teacherRoutes"));
const parentRoutes_1 = __importDefault(require("./routes/parentRoutes"));
const gradeRoutes_1 = __importDefault(require("./routes/gradeRoutes"));
const classRoutes_1 = __importDefault(require("./routes/classRoutes"));
const setup_1 = require("./utils/setup");
const authRoutes_1 = __importDefault(require("./routes/authRoutes"));
const assignmentRoutes_1 = __importDefault(require("./routes/assignmentRoutes"));
const attendanceRoutes_1 = __importDefault(require("./routes/attendanceRoutes"));
const eventRoutes_1 = __importDefault(require("./routes/eventRoutes"));
const analyticsRoutes_1 = __importDefault(require("./routes/analyticsRoutes"));
const notificationRoutes_1 = __importDefault(require("./routes/notificationRoutes"));
const subjectRoutes_1 = __importDefault(require("./routes/subjectRoutes"));
const dashboardRoutes_1 = __importDefault(require("./routes/dashboardRoutes"));
const multiTenantRoutes_1 = __importDefault(require("./routes/multiTenantRoutes"));
// Load environment variables FIRST
dotenv_1.default.config();
const app = (0, express_1.default)();
// Middleware
app.use((0, cors_1.default)());
app.use(express_1.default.json({ limit: "10mb" }));
// Health check route - should be before other routes
app.get("/", (req, res) => {
    res.json({ status: "ok", message: "Edutrack Backend API" });
});
app.get("/health", (req, res) => {
    res.json({ status: "healthy", timestamp: new Date().toISOString() });
});
// API Routes
app.use("/api/auth", authRoutes_1.default);
app.use("/api/users", userRoutes_1.default);
app.use("/api/schools", schoolRoutes_1.default);
app.use("/api/students", studentRoutes_1.default);
app.use("/api/teachers", teacherRoutes_1.default);
app.use("/api/parents", parentRoutes_1.default);
app.use("/api/grades", gradeRoutes_1.default);
app.use("/api/classes", classRoutes_1.default);
app.use("/api/assignments", assignmentRoutes_1.default);
app.use("/api/attendance", attendanceRoutes_1.default);
app.use("/api/events", eventRoutes_1.default);
app.use("/api/analytics", analyticsRoutes_1.default);
app.use("/api/notifications", notificationRoutes_1.default);
app.use("/api/subjects", subjectRoutes_1.default);
app.use("/api/dashboard", dashboardRoutes_1.default);
app.use("/api/multi-tenant", multiTenantRoutes_1.default);
// Error handling middleware
app.use((err, req, res, next) => {
    setup_1.logger.error("Unhandled error", { error: err.stack, path: req.path });
    res.status(500).json({ message: "Something went wrong!" });
});
// 404 handler
app.use("*", (req, res) => {
    res.status(404).json({ message: "Route not found" });
});
// CRITICAL: Use PORT environment variable (Render default is 10000)
const PORT = Number.parseInt(process.env.PORT || "10000", 10);
// Add error handling for server startup
const server = app.listen(PORT, "0.0.0.0", () => {
    setup_1.logger.info(`Server running on port ${PORT}`);
    console.log(`Server running on port ${PORT}`);
    console.log(`Server is binding to 0.0.0.0:${PORT}`); // Extra logging for Render
});
// Handle server startup errors
server.on('error', (error) => {
    setup_1.logger.error('Server startup error:', error);
    console.error('Server startup error:', error);
    process.exit(1);
});
// Graceful shutdown
process.on("SIGTERM", () => {
    setup_1.logger.info("SIGTERM received, shutting down gracefully");
    server.close(() => {
        setup_1.logger.info("Server closed");
        process.exit(0);
    });
});
process.on("SIGINT", () => {
    setup_1.logger.info("SIGINT received, shutting down gracefully");
    server.close(() => {
        setup_1.logger.info("Server closed");
        process.exit(0);
    });
});
// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
    setup_1.logger.error('Uncaught Exception:', error);
    console.error('Uncaught Exception:', error);
    process.exit(1);
});
process.on('unhandledRejection', (reason, promise) => {
    setup_1.logger.error('Unhandled Rejection at:', promise, 'reason:', reason);
    console.error('Unhandled Rejection at:', promise, 'reason:', reason);
    process.exit(1);
});
