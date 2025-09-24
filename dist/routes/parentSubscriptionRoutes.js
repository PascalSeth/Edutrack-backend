"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const parentSubscriptionController_1 = require("../controllers/parentSubscriptionController");
const router = express_1.default.Router();
// All routes require authentication
router.get("/", parentSubscriptionController_1.getParentSubscription);
router.post("/", parentSubscriptionController_1.createParentSubscription);
router.put("/:id/cancel", parentSubscriptionController_1.cancelParentSubscription);
exports.default = router;
