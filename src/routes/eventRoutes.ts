import { Router } from "express"
import {
  getEvents,
  getEventById,
  createEvent,
  updateEvent,
  deleteEvent,
  uploadEventImages,
  rsvpToEvent,
  getEventRSVPs,
  getUpcomingEvents,
} from "../controllers/eventController"
import { authMiddleware } from "../utils/setup"
import multer from "multer"

const router = Router()
const upload = multer({ storage: multer.memoryStorage() })

// Get all events
router.get("/", authMiddleware(["SUPER_ADMIN", "PRINCIPAL", "TEACHER", "PARENT"]), getEvents)

// Get upcoming events
router.get("/upcoming", authMiddleware(["SUPER_ADMIN", "PRINCIPAL", "TEACHER", "PARENT"]), getUpcomingEvents)

// Get event by ID
router.get("/:id", authMiddleware(["SUPER_ADMIN", "PRINCIPAL", "TEACHER", "PARENT"]), getEventById)

// Create event (principals and school admins)
router.post("/", authMiddleware(["PRINCIPAL", "SCHOOL_ADMIN"]), createEvent)

// Update event (principals and school admins)
router.put("/:id", authMiddleware(["PRINCIPAL", "SCHOOL_ADMIN"]), updateEvent)

// Delete event (principals and school admins)
router.delete("/:id", authMiddleware(["PRINCIPAL", "SCHOOL_ADMIN"]), deleteEvent)

// Upload event images
router.post("/:id/images", authMiddleware(["PRINCIPAL", "SCHOOL_ADMIN"]), upload.array("images", 10), uploadEventImages)

// RSVP to event
router.post("/:id/rsvp", authMiddleware(["SUPER_ADMIN", "PRINCIPAL", "TEACHER", "PARENT"]), rsvpToEvent)

// Get event RSVPs (principals only)
router.get("/:id/rsvps", authMiddleware(["PRINCIPAL"]), getEventRSVPs)

export default router
