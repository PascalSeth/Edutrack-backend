import { Router } from "express"
import { getChildAttendance, getChildAssignments, getChildTimetable, getChildChat, getChildGrades } from "../../controllers/mobileEndpointController/childController"
import { authMiddleware } from "../../utils/setup"

const router = Router()

// All child routes require parent authentication
router.use(authMiddleware(["PARENT"]))

// Get child attendance
router.get("/:childId/attendance", getChildAttendance)

// Get child assignments
router.get("/:childId/assignments", getChildAssignments)

// Get child timetable
router.get("/:childId/timetable", getChildTimetable)

// Get child chat/messages
router.get("/:childId/chat", getChildChat)

// Get child grades
router.get("/:childId/grades", getChildGrades)

export default router