import { Router } from "express"
import {
  getTerms,
  getTermById,
  createTerm,
  updateTerm,
  deleteTerm,
  getHolidays,
  createHoliday,
  updateHoliday,
  deleteHoliday,
  createCalendarItem,
  getCalendarItems,
  getAcademicCalendar,
} from "../controllers/academicCalendarController"
import { authMiddleware } from "../utils/setup"

const router = Router()

// Term routes
router.get("/terms", authMiddleware(["SUPER_ADMIN", "PRINCIPAL", "SCHOOL_ADMIN", "TEACHER"]), getTerms)
router.get("/terms/:id", authMiddleware(["SUPER_ADMIN", "PRINCIPAL", "SCHOOL_ADMIN", "TEACHER"]), getTermById)
router.post("/terms", authMiddleware(["SUPER_ADMIN", "PRINCIPAL", "SCHOOL_ADMIN"]), createTerm)
router.put("/terms/:id", authMiddleware(["SUPER_ADMIN", "PRINCIPAL", "SCHOOL_ADMIN"]), updateTerm)
router.delete("/terms/:id", authMiddleware(["SUPER_ADMIN", "PRINCIPAL", "SCHOOL_ADMIN"]), deleteTerm)

// Holiday routes
router.get("/holidays", authMiddleware(["SUPER_ADMIN", "PRINCIPAL", "SCHOOL_ADMIN", "TEACHER"]), getHolidays)
router.post("/holidays", authMiddleware(["SUPER_ADMIN", "PRINCIPAL", "SCHOOL_ADMIN"]), createHoliday)
router.put("/holidays/:id", authMiddleware(["SUPER_ADMIN", "PRINCIPAL", "SCHOOL_ADMIN"]), updateHoliday)
router.delete("/holidays/:id", authMiddleware(["SUPER_ADMIN", "PRINCIPAL", "SCHOOL_ADMIN"]), deleteHoliday)

// Calendar item routes
router.post("/calendar-items", authMiddleware(["SUPER_ADMIN", "PRINCIPAL", "SCHOOL_ADMIN"]), createCalendarItem)
router.get("/calendar/:academicCalendarId/items", authMiddleware(["SUPER_ADMIN", "PRINCIPAL", "SCHOOL_ADMIN", "TEACHER"]), getCalendarItems)

// Academic calendar overview
router.get("/calendar", authMiddleware(["SUPER_ADMIN", "PRINCIPAL", "SCHOOL_ADMIN", "TEACHER"]), getAcademicCalendar)

export default router
