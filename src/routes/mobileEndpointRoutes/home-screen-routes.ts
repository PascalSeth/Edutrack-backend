import express from "express"
import { getHomeScreenData } from "../../controllers/mobileEndpointController/homeScreen.controller"

const router = express.Router()

router.get("/home", getHomeScreenData)

export default router
