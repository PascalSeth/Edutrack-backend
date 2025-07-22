"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const TimeTableController_1 = require("../../controllers/mobileEndpointController/TimeTableController");
const router = express_1.default.Router();
router.get("/:studentId", TimeTableController_1.getTimetableForChild);
exports.default = router;
