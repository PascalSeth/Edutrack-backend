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

// Apply authentication middleware to all routes
router.use(authMiddleware)

// Term routes
router.get("/terms", getTerms)
router.get("/terms/:id", getTermById)
router.post("/terms", createTerm)
router.put("/terms/:id", updateTerm)
router.delete("/terms/:id", deleteTerm)

// Holiday routes
router.get("/holidays", getHolidays)
router.post("/holidays", createHoliday)
router.put("/holidays/:id", updateHoliday)
router.delete("/holidays/:id", deleteHoliday)

// Calendar item routes
router.post("/calendar-items", createCalendarItem)
router.get("/calendar/:academicCalendarId/items", getCalendarItems)

// Academic calendar overview
router.get("/calendar", getAcademicCalendar)

export default router
