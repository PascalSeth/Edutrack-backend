import express from "express"
import cors from "cors"
import helmet from "helmet"
import rateLimit from "express-rate-limit"
import { logger } from "./utils/setup"

// Import routes
import authRoutes from "./routes/authRoutes"
import userRoutes from "./routes/userRoutes"
import schoolRoutes from "./routes/schoolRoutes"
import studentRoutes from "./routes/studentRoutes"
import teacherRoutes from "./routes/teacherRoutes"
import principalRoutes from "./routes/principalRoutes"
import parentRoutes from "./routes/parentRoutes"
import classRoutes from "./routes/classRoutes"
import subjectRoutes from "./routes/subjectRoutes"
import gradeRoutes from "./routes/gradeRoutes"
import assignmentRoutes from "./routes/assignmentRoutes"
import attendanceRoutes from "./routes/attendanceRoutes"
import eventRoutes from "./routes/eventRoutes"
import notificationRoutes from "./routes/notificationRoutes"
import materialRoutes from "./routes/materialRoutes"
import materialOrderRoutes from "./routes/materialOrderRoutes"
import schoolPaymentRoutes from "./routes/schoolPaymentRoutes"
import analyticsRoutes from "./routes/analyticsRoutes"
import dashboardRoutes from "./routes/dashboardRoutes"
import webhookRoutes from "./routes/webhookRoutes"
import reportCardRoutes from "./routes/reportCardRoutes"
import timetableRoutes from "./routes/timetableRoutes"
import examRoutes from "./routes/examRoutes"
import roomRoutes from "./routes/roomRoutes"
import curriculumRoutes from "./routes/curriculumRoutes"
import academicCalendarRoutes from "./routes/academicCalendarRoutes"
import parentSubscriptionRoutes from "./routes/parentSubscriptionRoutes"
import feeBreakdownRoutes from "./routes/feeBreakdownRoutes"
import mobileEndpointRoutes from "./routes/mobileEndpointRoutes"

const app = express()
const PORT = process.env.PORT || 3000

// Security middleware
app.use(helmet())
app.use(
  cors({
    origin: '*',
    credentials: true,
  }),
)

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  message: "Too many requests from this IP, please try again later.",
})
app.use(limiter)

// Body parsing middleware
app.use(express.json({ limit: "10mb" }))
app.use(express.urlencoded({ extended: true, limit: "10mb" }))

// Request/Response logging middleware
app.use((req, res, next) => {
  const startTime = Date.now()

  // Log incoming request
  logger.info('Incoming Request', {
    method: req.method,
    url: req.url,
    headers: req.headers,
    body: req.body,
    query: req.query,
    params: req.params,
    ip: req.ip,
    userAgent: req.get('User-Agent')
  })

  // Override res.json to log response
  const originalJson = res.json
  res.json = function(body) {
    const duration = Date.now() - startTime

    logger.info('Outgoing Response', {
      method: req.method,
      url: req.url,
      statusCode: res.statusCode,
      duration: `${duration}ms`,
      responseBody: body
    })

    return originalJson.call(this, body)
  }

  next()
})

// Health check endpoint
app.get("/health", (req, res) => {
  res.status(200).json({
    status: "OK",
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
  })
})

// API routes
app.use("/api/auth", authRoutes)
app.use("/api/users", userRoutes)
app.use("/api/schools", schoolRoutes)
app.use("/api/students", studentRoutes)
app.use("/api/teachers", teacherRoutes)
app.use("/api/principals", principalRoutes)
app.use("/api/parents", parentRoutes)
app.use("/api/classes", classRoutes)
app.use("/api/subjects", subjectRoutes)
app.use("/api/grades", gradeRoutes)
app.use("/api/assignments", assignmentRoutes)
app.use("/api/attendance", attendanceRoutes)
app.use("/api/events", eventRoutes)
app.use("/api/notifications", notificationRoutes)
app.use("/api/materials", materialRoutes)
app.use("/api/material-orders", materialOrderRoutes)
app.use("/api/school-payments", schoolPaymentRoutes)
app.use("/api/analytics", analyticsRoutes)
app.use("/api/dashboard", dashboardRoutes)
app.use("/api/webhooks", webhookRoutes)
app.use("/api/report-cards", reportCardRoutes)
app.use("/api/timetables", timetableRoutes)
app.use("/api/exams", examRoutes)
app.use("/api/rooms", roomRoutes)
app.use("/api/curriculum", curriculumRoutes)
app.use("/api/academic-calendar", academicCalendarRoutes)
app.use("/api/parents/subscription", parentSubscriptionRoutes)
app.use("/api/fee-breakdown", feeBreakdownRoutes)
app.use("/mobile/parent", mobileEndpointRoutes)

// 404 handler
app.use("*", (req, res) => {
  res.status(404).json({ message: "Route not found" })
})

// Global error handler
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  logger.error("Unhandled error:", err)
  res.status(500).json({
    message: "Internal server error",
    ...(process.env.NODE_ENV === "development" && { error: err.message }),
  })
})

app.listen(PORT, () => {
  logger.info(`Server running on port ${PORT}`)
  logger.info(`Environment: ${process.env.NODE_ENV || "development"}`)
})

export default app
