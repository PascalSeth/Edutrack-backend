"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const materialController_1 = require("../controllers/materialController");
const router = (0, express_1.Router)();
// Material Categories
router.get("/schools/:schoolId/categories", materialController_1.getMaterialCategories);
router.post("/schools/:schoolId/categories", materialController_1.createMaterialCategory);
// Materials
router.get("/categories/:categoryId/materials", materialController_1.getMaterialsByCategory);
router.get("/materials/:materialId", materialController_1.getMaterial);
router.post("/schools/:schoolId/materials", materialController_1.createMaterial);
router.put("/materials/:materialId", materialController_1.updateMaterial);
router.delete("/materials/:materialId", materialController_1.deleteMaterial);
// Shopping Cart
router.get("/parents/:parentId/schools/:schoolId/cart", materialController_1.getCart);
router.post("/parents/:parentId/schools/:schoolId/cart", materialController_1.addToCart);
router.put("/cart-items/:cartItemId", materialController_1.updateCartItem);
router.delete("/cart-items/:cartItemId", materialController_1.removeFromCart);
router.delete("/parents/:parentId/schools/:schoolId/cart", materialController_1.clearCart);
exports.default = router;
