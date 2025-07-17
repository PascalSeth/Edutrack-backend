import { Router } from "express"
import {
  getRooms,
  getRoomById,
  createRoom,
  updateRoom,
  deleteRoom,
  getRoomAvailability,
  getRoomUtilization,
} from "../controllers/roomController"
import { authMiddleware } from "../utils/setup"

const router = Router()

// Apply authentication middleware to all routes
router.use(authMiddleware)

// Room routes
router.get("/", getRooms)
router.get("/:id", getRoomById)
router.post("/", createRoom)
router.put("/:id", updateRoom)
router.delete("/:id", deleteRoom)

// Room availability and utilization
router.get("/:id/availability", getRoomAvailability)
router.get("/:id/utilization", getRoomUtilization)

export default router
