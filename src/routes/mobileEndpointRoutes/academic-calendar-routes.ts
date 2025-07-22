import express from "express"
import { getEventsPerDatesAndTypes } from "../../controllers/mobileEndpointController/academicCalendarController"

const router = express.Router()

router.get("/", getEventsPerDatesAndTypes)

export default router
