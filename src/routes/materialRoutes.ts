import { Router } from "express"
import {
  getMaterialCategories,
  createMaterialCategory,
  getMaterialsByCategory,
  getMaterial,
  createMaterial,
  updateMaterial,
  deleteMaterial,
  getCart,
  addToCart,
  updateCartItem,
  removeFromCart,
  clearCart,
} from "../controllers/materialController"

const router = Router()

// Material Categories
router.get("/schools/:schoolId/categories", getMaterialCategories)
router.post("/schools/:schoolId/categories", createMaterialCategory)

// Materials
router.get("/categories/:categoryId/materials", getMaterialsByCategory)
router.get("/materials/:materialId", getMaterial)
router.post("/schools/:schoolId/materials", createMaterial)
router.put("/materials/:materialId", updateMaterial)
router.delete("/materials/:materialId", deleteMaterial)

// Shopping Cart
router.get("/parents/:parentId/schools/:schoolId/cart", getCart)
router.post("/parents/:parentId/schools/:schoolId/cart", addToCart)
router.put("/cart-items/:cartItemId", updateCartItem)
router.delete("/cart-items/:cartItemId", removeFromCart)
router.delete("/parents/:parentId/schools/:schoolId/cart", clearCart)

export default router
