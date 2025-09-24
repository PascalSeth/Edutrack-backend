import express from "express"
import academicCalendarRoutes from "./academic-calendar-routes"
// import academicResultsRoutes from "./academic-results-routes"
// import announcementsRoutes from "./announcements-routes"
import attendanceRecordRoutes from "./attendance-record-routes"
import childProfileRoutes from "./child-profile-routes"
// import feeStatusRoutes from "./fee-status-routes"
import homeScreenRoutes from "./home-screen-routes"
import onboardingRoutes from "./onboarding-routes"
import timeTableRoutes from "./time-table-routes"

const router = express.Router()

// Mount all mobile endpoint routes
router.use("/academic-calendar", academicCalendarRoutes)
// router.use("/academic-results", academicResultsRoutes)
// router.use("/announcements", announcementsRoutes)
router.use("/attendance-record", attendanceRecordRoutes)
router.use("/", childProfileRoutes)
// router.use("/fee-status", feeStatusRoutes)
router.use("/", homeScreenRoutes)
router.use("/onboarding", onboardingRoutes)
router.use("/time-table", timeTableRoutes)

export default router
