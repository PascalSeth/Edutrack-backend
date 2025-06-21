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

// Trust proxy for Render
app.set("trust proxy", 1)

// Middleware with memory optimizations
app.use(
  cors({
    origin: process.env.FRONTEND_URL || "*",
    credentials: true,
  }),
)
app.use(express.json({ limit: "5mb" })) // Reduced from 10mb
app.use(express.urlencoded({ extended: true, limit: "5mb" }))

// Health check route - should be before other routes
app.get("/", (req, res) => {
  res.json({
    status: "ok",
    message: "Edutrack Backend API",
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || "development",
  })
})

app.get("/health", (req, res) => {
  res.json({
    status: "healthy",
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    memory: process.memoryUsage(),
  })
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
  console.log(`✅ Server running on port ${PORT}`)
  console.log(`🌐 Environment: ${process.env.NODE_ENV || "development"}`)
  console.log(`📊 Memory usage:`, process.memoryUsage())
})

// Handle server startup errors
server.on("error", (error: any) => {
  logger.error("Server startup error:", error)
  console.error("❌ Server startup error:", error)
  process.exit(1)
})

// Graceful shutdown
const gracefulShutdown = (signal: string) => {
  logger.info(`${signal} received, shutting down gracefully`)
  console.log(`🔄 ${signal} received, shutting down gracefully`)

  server.close(() => {
    logger.info("Server closed")
    console.log("✅ Server closed")
    process.exit(0)
  })

  // Force close after 10 seconds
  setTimeout(() => {
    logger.error("Could not close connections in time, forcefully shutting down")
    console.error("❌ Could not close connections in time, forcefully shutting down")
    process.exit(1)
  }, 10000)
}

process.on("SIGTERM", () => gracefulShutdown("SIGTERM"))
process.on("SIGINT", () => gracefulShutdown("SIGINT"))

// Handle uncaught exceptions with memory cleanup
process.on("uncaughtException", (error) => {
  logger.error("Uncaught Exception:", error)
  console.error("❌ Uncaught Exception:", error)

  // Attempt graceful shutdown
  gracefulShutdown("UNCAUGHT_EXCEPTION")
})

process.on("unhandledRejection", (reason, promise) => {
  logger.error("Unhandled Rejection at:", promise, "reason:", reason)
  console.error("❌ Unhandled Rejection at:", promise, "reason:", reason)

  // Attempt graceful shutdown
  gracefulShutdown("UNHANDLED_REJECTION")
})

// Memory monitoring
if (process.env.NODE_ENV === "production") {
  setInterval(() => {
    const memUsage = process.memoryUsage()
    const memUsageMB = {
      rss: Math.round(memUsage.rss / 1024 / 1024),
      heapTotal: Math.round(memUsage.heapTotal / 1024 / 1024),
      heapUsed: Math.round(memUsage.heapUsed / 1024 / 1024),
      external: Math.round(memUsage.external / 1024 / 1024),
    }

    logger.info("Memory usage (MB):", memUsageMB)

    // Warning if heap usage is high
    if (memUsageMB.heapUsed > 400) {
      logger.warn("High memory usage detected", memUsageMB)
    }
  }, 60000) // Check every minute
}
