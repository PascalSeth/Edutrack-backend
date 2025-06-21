import express, { type Express, type Request, type Response, type NextFunction } from "express"
import cors from "cors"
import dotenv from "dotenv"
import userRouter from "./routes/userRoutes"
import schoolRouter from "./routes/schoolRoutes"
import studentRouter from "./routes/studentRoutes"
import teacherRouter from "./routes/teacherRoutes"
import parentRouter from "./routes/parentRoutes"
import gradeRouter from "./routes/gradeRoutes"
import classRouter from "./routes/classRoutes"
import { logger } from "./utils/setup"
import authRouter from "./routes/authRoutes"
import assignmentRouter from "./routes/assignmentRoutes"
import attendanceRouter from "./routes/attendanceRoutes"
import eventRouter from "./routes/eventRoutes"
import analyticsRouter from "./routes/analyticsRoutes"
import notificationRouter from "./routes/notificationRoutes"
import subjectRouter from "./routes/subjectRoutes"
import dashboardRouter from "./routes/dashboardRoutes"
import multiTenantRouter from "./routes/multiTenantRoutes"

// Load environment variables FIRST
dotenv.config()

const app: Express = express()

// Middleware
app.use(cors())
app.use(express.json({ limit: "10mb" }))

// Health check route - should be before other routes
app.get("/", (req, res) => {
  res.json({ status: "ok", message: "Edutrack Backend API" })
})

app.get("/health", (req, res) => {
  res.json({ status: "healthy", timestamp: new Date().toISOString() })
})

// API Routes
app.use("/api/auth", authRouter)
app.use("/api/users", userRouter)
app.use("/api/schools", schoolRouter)
app.use("/api/students", studentRouter)
app.use("/api/teachers", teacherRouter)
app.use("/api/parents", parentRouter)
app.use("/api/grades", gradeRouter)
app.use("/api/classes", classRouter)
app.use("/api/assignments", assignmentRouter)
app.use("/api/attendance", attendanceRouter)
app.use("/api/events", eventRouter)
app.use("/api/analytics", analyticsRouter)
app.use("/api/notifications", notificationRouter)
app.use("/api/subjects", subjectRouter)
app.use("/api/dashboard", dashboardRouter)
app.use("/api/multi-tenant", multiTenantRouter)

// Error handling middleware
app.use((err: Error, req: Request, res: Response, next: NextFunction) => {
  logger.error("Unhandled error", { error: err.stack, path: req.path })
  res.status(500).json({ message: "Something went wrong!" })
})

// 404 handler
app.use("*", (req, res) => {
  res.status(404).json({ message: "Route not found" })
})

// CRITICAL: Use PORT environment variable (Render default is 10000)
const PORT = Number.parseInt(process.env.PORT || "10000", 10)

// Add error handling for server startup
const server = app.listen(PORT, "0.0.0.0", () => {
  logger.info(`Server running on port ${PORT}`)
  console.log(`Server running on port ${PORT}`)
  console.log(`Server is binding to 0.0.0.0:${PORT}`) // Extra logging for Render
})

// Handle server startup errors
server.on('error', (error: any) => {
  logger.error('Server startup error:', error)
  console.error('Server startup error:', error)
  process.exit(1)
})

// Graceful shutdown
process.on("SIGTERM", () => {
  logger.info("SIGTERM received, shutting down gracefully")
  server.close(() => {
    logger.info("Server closed")
    process.exit(0)
  })
})

process.on("SIGINT", () => {
  logger.info("SIGINT received, shutting down gracefully")
  server.close(() => {
    logger.info("Server closed")
    process.exit(0)
  })
})

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  logger.error('Uncaught Exception:', error)
  console.error('Uncaught Exception:', error)
  process.exit(1)
})

process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled Rejection at:', promise, 'reason:', reason)
  console.error('Unhandled Rejection at:', promise, 'reason:', reason)
  process.exit(1)
})