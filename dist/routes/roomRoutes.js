"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const roomController_1 = require("../controllers/roomController");
const setup_1 = require("../utils/setup");
const router = (0, express_1.Router)();
// Room routes
router.get("/", (0, setup_1.authMiddleware)(["SUPER_ADMIN", "PRINCIPAL", "SCHOOL_ADMIN", "TEACHER"]), roomController_1.getRooms);
router.get("/:id", (0, setup_1.authMiddleware)(["SUPER_ADMIN", "PRINCIPAL", "SCHOOL_ADMIN", "TEACHER"]), roomController_1.getRoomById);
router.post("/", (0, setup_1.authMiddleware)(["SUPER_ADMIN", "PRINCIPAL", "SCHOOL_ADMIN"]), roomController_1.createRoom);
router.put("/:id", (0, setup_1.authMiddleware)(["SUPER_ADMIN", "PRINCIPAL", "SCHOOL_ADMIN"]), roomController_1.updateRoom);
router.delete("/:id", (0, setup_1.authMiddleware)(["SUPER_ADMIN", "PRINCIPAL", "SCHOOL_ADMIN"]), roomController_1.deleteRoom);
// Room availability and utilization
router.get("/:id/availability", (0, setup_1.authMiddleware)(["SUPER_ADMIN", "PRINCIPAL", "SCHOOL_ADMIN", "TEACHER"]), roomController_1.getRoomAvailability);
router.get("/:id/utilization", (0, setup_1.authMiddleware)(["SUPER_ADMIN", "PRINCIPAL", "SCHOOL_ADMIN", "TEACHER"]), roomController_1.getRoomUtilization);
exports.default = router;
