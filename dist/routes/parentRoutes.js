"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const parentController_1 = require("../controllers/parentController");
const setup_1 = require("../utils/setup");
const router = (0, express_1.Router)();
// Get all parents (with tenant filtering)
router.get("/", (0, setup_1.authMiddleware)(["SUPER_ADMIN", "PRINCIPAL", "SCHOOL_ADMIN", "TEACHER"]), parentController_1.getParents);
// Get parents by specific school
router.get("/by-school", (0, setup_1.authMiddleware)(["SUPER_ADMIN", "PRINCIPAL", "SCHOOL_ADMIN"]), parentController_1.getParentsBySchool);
// Get parent by ID
router.get("/:id", (0, setup_1.authMiddleware)(["SUPER_ADMIN", "PRINCIPAL", "SCHOOL_ADMIN", "TEACHER", "PARENT"]), parentController_1.getParentById);
// Get parent's children across all schools
router.get("/:id/children", (0, setup_1.authMiddleware)(["SUPER_ADMIN", "PRINCIPAL", "SCHOOL_ADMIN", "PARENT"]), parentController_1.getParentChildrenAcrossSchools);
// Create parent
router.post("/", (0, setup_1.authMiddleware)(["SUPER_ADMIN", "PRINCIPAL", "SCHOOL_ADMIN"]), parentController_1.createParent);
// Update parent
router.put("/:id", (0, setup_1.authMiddleware)(["SUPER_ADMIN", "PRINCIPAL", "SCHOOL_ADMIN", "PARENT"]), parentController_1.updateParent);
// Verify parent
router.put("/:id/verify", (0, setup_1.authMiddleware)(["SUPER_ADMIN", "PRINCIPAL", "SCHOOL_ADMIN"]), parentController_1.verifyParent);
// Delete parent
router.delete("/:id", (0, setup_1.authMiddleware)(["SUPER_ADMIN"]), parentController_1.deleteParent);
exports.default = router;
