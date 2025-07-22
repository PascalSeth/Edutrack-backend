"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const academicCalendarController_1 = require("../../controllers/mobileEndpointController/academicCalendarController");
const router = express_1.default.Router();
router.get("/", academicCalendarController_1.getEventsPerDatesAndTypes);
exports.default = router;
