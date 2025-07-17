import { Router } from "express"
import {
  getSchoolPaymentAccount,
  createSchoolPaymentAccount,
  updatePaymentAccountStatus,
  getPaymentStatistics,
  getTransferHistory,
} from "../controllers/schoolPaymentController"

const router = Router()

// Payment Account Management
router.get("/schools/:schoolId/payment-account", getSchoolPaymentAccount)
router.post("/schools/:schoolId/payment-account", createSchoolPaymentAccount)
router.put("/payment-accounts/:accountId/status", updatePaymentAccountStatus)

// Statistics and History
router.get("/schools/:schoolId/payment-statistics", getPaymentStatistics)
router.get("/schools/:schoolId/transfer-history", getTransferHistory)

export default router
