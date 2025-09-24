import express from "express"
import { getParentChildren } from "../../controllers/mobileEndpointController/childProfileController"

const router = express.Router()

router.get("/children", getParentChildren)

export default router
