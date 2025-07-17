import { Router } from "express"
import {
  createOrderFromCart,
  initializeOrderPayment,
  verifyOrderPayment,
  getParentOrders,
  getSchoolOrders,
  updateOrderStatus,
  getOrderDetails,
  cancelOrder,
} from "../controllers/materialOrderController"

const router = Router()

// Order Management
router.post("/parents/:parentId/schools/:schoolId/orders", createOrderFromCart)
router.get("/parents/:parentId/orders", getParentOrders)
router.get("/schools/:schoolId/orders", getSchoolOrders)
router.get("/orders/:orderId", getOrderDetails)
router.put("/orders/:orderId/status", updateOrderStatus)
router.put("/orders/:orderId/cancel", cancelOrder)

// Payment
router.post("/orders/:orderId/payment/initialize", initializeOrderPayment)
router.get("/orders/payment/verify/:reference", verifyOrderPayment)

export default router
