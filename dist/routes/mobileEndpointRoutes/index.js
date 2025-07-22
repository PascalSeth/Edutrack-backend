"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const academic_calendar_routes_1 = __importDefault(require("./academic-calendar-routes"));
// import academicResultsRoutes from "./academic-results-routes"
// import announcementsRoutes from "./announcements-routes"
const attendance_record_routes_1 = __importDefault(require("./attendance-record-routes"));
const child_profile_routes_1 = __importDefault(require("./child-profile-routes"));
// import feeStatusRoutes from "./fee-status-routes"
const home_screen_routes_1 = __importDefault(require("./home-screen-routes"));
const onboarding_routes_1 = __importDefault(require("./onboarding-routes"));
const time_table_routes_1 = __importDefault(require("./time-table-routes"));
const router = express_1.default.Router();
// Mount all mobile endpoint routes
router.use("/academic-calendar", academic_calendar_routes_1.default);
// router.use("/academic-results", academicResultsRoutes)
// router.use("/announcements", announcementsRoutes)
router.use("/attendance-record", attendance_record_routes_1.default);
router.use("/child-profile", child_profile_routes_1.default);
// router.use("/fee-status", feeStatusRoutes)
router.use("/home-screen", home_screen_routes_1.default);
router.use("/onboarding", onboarding_routes_1.default);
router.use("/time-table", time_table_routes_1.default);
exports.default = router;
