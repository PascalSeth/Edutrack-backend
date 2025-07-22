import express from "express"
import { getAttendanceBasedOnFilter } from "../../controllers/mobileEndpointController/AttendanceRecordController"

const router = express.Router()

router.get("/", getAttendanceBasedOnFilter)

export default router
