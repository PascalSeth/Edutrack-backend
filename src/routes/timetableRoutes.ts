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

// Timetable routes
router.get("/", authMiddleware(["SUPER_ADMIN", "PRINCIPAL", "SCHOOL_ADMIN", "TEACHER"]), getTimetables)
router.get("/:id", authMiddleware(["SUPER_ADMIN", "PRINCIPAL", "SCHOOL_ADMIN", "TEACHER"]), getTimetableById)
router.post("/", authMiddleware(["SUPER_ADMIN", "PRINCIPAL", "SCHOOL_ADMIN"]), createTimetable)
router.put("/:id", authMiddleware(["SUPER_ADMIN", "PRINCIPAL", "SCHOOL_ADMIN"]), updateTimetable)
router.delete("/:id", authMiddleware(["SUPER_ADMIN", "PRINCIPAL", "SCHOOL_ADMIN"]), deleteTimetable)

// Timetable slot routes
router.post("/slots", authMiddleware(["SUPER_ADMIN", "PRINCIPAL", "SCHOOL_ADMIN"]), createTimetableSlot)
router.put("/slots/:id", authMiddleware(["SUPER_ADMIN", "PRINCIPAL", "SCHOOL_ADMIN"]), updateTimetableSlot)
router.delete("/slots/:id", authMiddleware(["SUPER_ADMIN", "PRINCIPAL", "SCHOOL_ADMIN"]), deleteTimetableSlot)

// Specialized timetable views
router.get("/teacher/:teacherId", authMiddleware(["SUPER_ADMIN", "PRINCIPAL", "SCHOOL_ADMIN", "TEACHER"]), getTeacherTimetable)
router.get("/class/:classId", authMiddleware(["SUPER_ADMIN", "PRINCIPAL", "SCHOOL_ADMIN", "TEACHER"]), getClassTimetable)

export default router
