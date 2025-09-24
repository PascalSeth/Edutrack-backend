"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const eventController_1 = require("../controllers/eventController");
const setup_1 = require("../utils/setup");
const multer_1 = __importDefault(require("multer"));
const router = (0, express_1.Router)();
const upload = (0, multer_1.default)({ storage: multer_1.default.memoryStorage() });
// Get all events
router.get("/", (0, setup_1.authMiddleware)(["SUPER_ADMIN", "PRINCIPAL", "TEACHER", "PARENT"]), eventController_1.getEvents);
// Get upcoming events
router.get("/upcoming", (0, setup_1.authMiddleware)(["SUPER_ADMIN", "PRINCIPAL", "TEACHER", "PARENT"]), eventController_1.getUpcomingEvents);
// Get event by ID
router.get("/:id", (0, setup_1.authMiddleware)(["SUPER_ADMIN", "PRINCIPAL", "TEACHER", "PARENT"]), eventController_1.getEventById);
// Create event (principals and school admins)
router.post("/", (0, setup_1.authMiddleware)(["PRINCIPAL", "SCHOOL_ADMIN"]), eventController_1.createEvent);
// Update event (principals and school admins)
router.put("/:id", (0, setup_1.authMiddleware)(["PRINCIPAL", "SCHOOL_ADMIN"]), eventController_1.updateEvent);
// Delete event (principals and school admins)
router.delete("/:id", (0, setup_1.authMiddleware)(["PRINCIPAL", "SCHOOL_ADMIN"]), eventController_1.deleteEvent);
// Upload event images
router.post("/:id/images", (0, setup_1.authMiddleware)(["PRINCIPAL", "SCHOOL_ADMIN"]), upload.array("images", 10), eventController_1.uploadEventImages);
// RSVP to event
router.post("/:id/rsvp", (0, setup_1.authMiddleware)(["SUPER_ADMIN", "PRINCIPAL", "TEACHER", "PARENT"]), eventController_1.rsvpToEvent);
// Get event RSVPs (principals only)
router.get("/:id/rsvps", (0, setup_1.authMiddleware)(["PRINCIPAL"]), eventController_1.getEventRSVPs);
exports.default = router;
