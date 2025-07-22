"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const childProfileController_1 = require("../../controllers/mobileEndpointController/childProfileController");
const router = express_1.default.Router();
router.get("/", childProfileController_1.getParentChildren);
exports.default = router;
