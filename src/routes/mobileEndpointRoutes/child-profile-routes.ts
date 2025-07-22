import express from "express"
import { getParentChildren } from "../../controllers/mobileEndpointController/childProfileController"

const router = express.Router()

router.get("/", getParentChildren)

export default router
