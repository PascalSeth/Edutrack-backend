import { Router } from "express"
import childRoutes from "./child-routes"

const router = Router()

// Child-specific routes for parents
router.use("/children", childRoutes)

export default router