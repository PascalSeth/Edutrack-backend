"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const roomController_1 = require("../controllers/roomController");
const setup_1 = require("../utils/setup");
const router = (0, express_1.Router)();
// Apply authentication middleware to all routes
router.use(setup_1.authMiddleware);
// Room routes
router.get("/", roomController_1.getRooms);
router.get("/:id", roomController_1.getRoomById);
router.post("/", roomController_1.createRoom);
router.put("/:id", roomController_1.updateRoom);
router.delete("/:id", roomController_1.deleteRoom);
// Room availability and utilization
router.get("/:id/availability", roomController_1.getRoomAvailability);
router.get("/:id/utilization", roomController_1.getRoomUtilization);
exports.default = router;
