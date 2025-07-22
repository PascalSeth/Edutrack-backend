import express from "express"
import { getParentProfile, } from "../../controllers/mobileEndpointController/onboardingController"

const router = express.Router()

router.get("/profile", getParentProfile)

export default router
