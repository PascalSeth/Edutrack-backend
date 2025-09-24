import express from "express"
import {
  getParentSubscription,
  createParentSubscription,
  cancelParentSubscription,
} from "../controllers/parentSubscriptionController"

const router = express.Router()

// All routes require authentication
router.get("/", getParentSubscription)
router.post("/", createParentSubscription)
router.put("/:id/cancel", cancelParentSubscription)

export default router