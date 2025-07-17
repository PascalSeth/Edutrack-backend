import { Router } from "express"
import { handlePaystackWebhook, retryTransfer } from "../controllers/webhookController"

const router = Router()

// Webhook endpoints
router.post("/paystack", handlePaystackWebhook)

// Manual operations
router.post("/payments/:paymentId/retry-transfer", retryTransfer)

export default router
