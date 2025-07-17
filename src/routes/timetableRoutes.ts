import { Router } from "express"
import {
  getTimetables,
  getTimetableById,
  createTimetable,
  updateTimetable,
  deleteTimetable,
  createTimetableSlot,
  updateTimetableSlot,
  deleteTimetableSlot,
  getTeacherTimetable,
  getClassTimetable,
} from "../controllers/timetableController"
import { authMiddleware } from "../utils/setup"

const router = Router()

// Apply authentication middleware to all routes
router.use(authMiddleware)

// Timetable routes
router.get("/", getTimetables)
router.get("/:id", getTimetableById)
router.post("/", createTimetable)
router.put("/:id", updateTimetable)
router.delete("/:id", deleteTimetable)

// Timetable slot routes
router.post("/slots", createTimetableSlot)
router.put("/slots/:id", updateTimetableSlot)
router.delete("/slots/:id", deleteTimetableSlot)

// Specialized timetable views
router.get("/teacher/:teacherId", getTeacherTimetable)
router.get("/class/:classId", getClassTimetable)

export default router
