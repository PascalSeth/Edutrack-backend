"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const homeScreen_controller_1 = require("../../controllers/mobileEndpointController/homeScreen.controller");
const router = express_1.default.Router();
router.get("/", homeScreen_controller_1.getHomeScreenData);
exports.default = router;
