import express from "express"
import { getTimetableForChild } from "../../controllers/mobileEndpointController/TimeTableController"

const router = express.Router()

router.get("/:studentId", getTimetableForChild)

export default router
