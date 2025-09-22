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

// Curriculum routes
router.get("/", authMiddleware(["SUPER_ADMIN", "PRINCIPAL", "SCHOOL_ADMIN", "TEACHER"]), getCurriculums)
router.get("/:id", authMiddleware(["SUPER_ADMIN", "PRINCIPAL", "SCHOOL_ADMIN", "TEACHER"]), getCurriculumById)
router.post("/", authMiddleware(["SUPER_ADMIN", "PRINCIPAL", "SCHOOL_ADMIN"]), createCurriculum)
router.put("/:id", authMiddleware(["SUPER_ADMIN", "PRINCIPAL", "SCHOOL_ADMIN"]), updateCurriculum)
router.delete("/:id", authMiddleware(["SUPER_ADMIN", "PRINCIPAL", "SCHOOL_ADMIN"]), deleteCurriculum)

// Curriculum subject routes
router.post("/subjects", authMiddleware(["SUPER_ADMIN", "PRINCIPAL", "SCHOOL_ADMIN"]), createCurriculumSubject)

// Learning objective routes
router.get("/subjects/:curriculumSubjectId/objectives", authMiddleware(["SUPER_ADMIN", "PRINCIPAL", "SCHOOL_ADMIN", "TEACHER"]), getLearningObjectives)
router.post("/objectives", authMiddleware(["SUPER_ADMIN", "PRINCIPAL", "SCHOOL_ADMIN"]), createLearningObjective)

// Student progress routes
router.put("/progress", authMiddleware(["SUPER_ADMIN", "PRINCIPAL", "SCHOOL_ADMIN", "TEACHER"]), updateStudentProgress)
router.get("/progress/student/:studentId", authMiddleware(["SUPER_ADMIN", "PRINCIPAL", "SCHOOL_ADMIN", "TEACHER", "PARENT"]), getStudentProgress)
router.get("/:curriculumId/progress", authMiddleware(["SUPER_ADMIN", "PRINCIPAL", "SCHOOL_ADMIN", "TEACHER"]), getCurriculumProgress)

export default router
