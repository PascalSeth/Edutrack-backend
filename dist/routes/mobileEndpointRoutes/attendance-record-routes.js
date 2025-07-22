"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const AttendanceRecordController_1 = require("../../controllers/mobileEndpointController/AttendanceRecordController");
const router = express_1.default.Router();
router.get("/", AttendanceRecordController_1.getAttendanceBasedOnFilter);
exports.default = router;
