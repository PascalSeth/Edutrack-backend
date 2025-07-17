import { Router } from "express"
import {
  getCurriculums,
  getCurriculumById,
  createCurriculum,
  updateCurriculum,
  deleteCurriculum,
  createCurriculumSubject,
  createLearningObjective,
  getLearningObjectives,
  updateStudentProgress,
  getStudentProgress,
  getCurriculumProgress,
} from "../controllers/curriculumController"
import { authMiddleware } from "../utils/setup"

const router = Router()

// Apply authentication middleware to all routes
router.use(authMiddleware)

// Curriculum routes
router.get("/", getCurriculums)
router.get("/:id", getCurriculumById)
router.post("/", createCurriculum)
router.put("/:id", updateCurriculum)
router.delete("/:id", deleteCurriculum)

// Curriculum subject routes
router.post("/subjects", createCurriculumSubject)

// Learning objective routes
router.get("/subjects/:curriculumSubjectId/objectives", getLearningObjectives)
router.post("/objectives", createLearningObjective)

// Student progress routes
router.put("/progress", updateStudentProgress)
router.get("/progress/student/:studentId", getStudentProgress)
router.get("/:curriculumId/progress", getCurriculumProgress)

export default router
