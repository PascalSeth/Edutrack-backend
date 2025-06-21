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

dotenv.config()

const app: Express = express()

// Middleware
app.use(cors())
app.use(express.json({ limit: '10mb' })) // Add size limit to prevent memory issues

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

// Error handling middleware
app.use((err: Error, req: Request, res: Response, next: NextFunction) => {
  logger.error("Unhandled error", { error: err.stack, path: req.path })
  res.status(500).json({ message: "Something went wrong!" })
})

// 404 handler
app.use("*", (req, res) => {
  res.status(404).json({ message: "Route not found" })
})

const PORT = parseInt(process.env.PORT || '3000', 10)
const server = app.listen(PORT, '0.0.0.0', () => {
  logger.info(`Server running on port ${PORT}`)
  console.log(`Server running on port ${PORT}`) // Console log for Render to detect
})

// Graceful shutdown
process.on('SIGTERM', () => {
  logger.info('SIGTERM received, shutting down gracefully')
  server.close(() => {
    logger.info('Server closed')
    process.exit(0)
  })
})

process.on('SIGINT', () => {
  logger.info('SIGINT received, shutting down gracefully')
  server.close(() => {
    logger.info('Server closed')
    process.exit(0)
  })
})