"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.searchAcrossSchools = exports.getUnassignedStudents = exports.assignStudentToClass = exports.verifyParentChild = exports.addChildToParent = exports.getPrincipalSchoolOverview = exports.getTeacherStudents = exports.getTeacherSubjects = exports.getTeacherClasses = exports.getParentSchools = exports.getParentChildren = void 0;
const zod_1 = require("zod");
const setup_1 = require("../utils/setup");
// Parent-specific endpoints for multi-school children management
const getParentChildren = async (req, res) => {
    try {
        if (req.user?.role !== "PARENT") {
            return res.status(403).json({ message: "Access denied" });
        }
        const children = await setup_1.prisma.student.findMany({
            where: { parentId: req.user.id },
            include: {
                school: {
                    select: {
                        id: true,
                        name: true,
                        city: true,
                        logoUrl: true,
                    },
                },
                class: {
                    select: {
                        id: true,
                        name: true,
                        grade: { select: { name: true, level: true } },
                    },
                },
                _count: {
                    select: {
                        attendances: true,
                        results: true,
                        assignmentSubmissions: true,
                    },
                },
            },
            orderBy: { name: "asc" },
        });
        // Group children by school
        const childrenBySchool = children.reduce((acc, child) => {
            const schoolId = child.school.id;
            if (!acc[schoolId]) {
                acc[schoolId] = {
                    school: child.school,
                    children: [],
                };
            }
            acc[schoolId].children.push(child);
            return acc;
        }, {});
        setup_1.logger.info("Parent children retrieved", {
            userId: req.user?.id,
            childrenCount: children.length,
            schoolsCount: Object.keys(childrenBySchool).length,
        });
        res.status(200).json({
            message: "Children retrieved successfully",
            children,
            childrenBySchool: Object.values(childrenBySchool),
            summary: {
                totalChildren: children.length,
                schoolsCount: Object.keys(childrenBySchool).length,
            },
        });
    }
    catch (error) {
        (0, setup_1.handleError)(res, error, "Failed to retrieve parent children");
    }
};
exports.getParentChildren = getParentChildren;
const getParentSchools = async (req, res) => {
    try {
        if (req.user?.role !== "PARENT") {
            return res.status(403).json({ message: "Access denied" });
        }
        const schools = await setup_1.prisma.school.findMany({
            where: {
                students: {
                    some: { parentId: req.user.id },
                },
            },
            include: {
                students: {
                    where: { parentId: req.user.id },
                    select: {
                        id: true,
                        name: true,
                        surname: true,
                        registrationNumber: true,
                        class: { select: { name: true } },
                        grade: { select: { name: true } },
                    },
                },
                _count: {
                    select: {
                        students: true,
                        teachers: true,
                        classes: true,
                    },
                },
            },
        });
        setup_1.logger.info("Parent schools retrieved", {
            userId: req.user?.id,
            schoolsCount: schools.length,
        });
        res.status(200).json({
            message: "Schools retrieved successfully",
            schools,
        });
    }
    catch (error) {
        (0, setup_1.handleError)(res, error, "Failed to retrieve parent schools");
    }
};
exports.getParentSchools = getParentSchools;
// Teacher-specific endpoints for their classes and subjects
const getTeacherClasses = async (req, res) => {
    try {
        if (req.user?.role !== "TEACHER") {
            return res.status(403).json({ message: "Access denied" });
        }
        const classes = await setup_1.prisma.class.findMany({
            where: {
                OR: [
                    { supervisorId: req.user.id },
                    {
                        lessons: {
                            some: { teacherId: req.user.id },
                        },
                    },
                ],
            },
            include: {
                grade: { select: { name: true, level: true } },
                school: { select: { name: true } },
                students: {
                    select: {
                        id: true,
                        name: true,
                        surname: true,
                        registrationNumber: true,
                    },
                },
                lessons: {
                    where: { teacherId: req.user.id },
                    include: {
                        subject: { select: { name: true } },
                    },
                },
                _count: {
                    select: {
                        students: true,
                        assignments: true,
                    },
                },
            },
            orderBy: { name: "asc" },
        });
        setup_1.logger.info("Teacher classes retrieved", {
            userId: req.user?.id,
            classesCount: classes.length,
        });
        res.status(200).json({
            message: "Teacher classes retrieved successfully",
            classes,
        });
    }
    catch (error) {
        (0, setup_1.handleError)(res, error, "Failed to retrieve teacher classes");
    }
};
exports.getTeacherClasses = getTeacherClasses;
const getTeacherSubjects = async (req, res) => {
    try {
        if (req.user?.role !== "TEACHER") {
            return res.status(403).json({ message: "Access denied" });
        }
        const subjects = await setup_1.prisma.subject.findMany({
            where: {
                teachers: {
                    some: { id: req.user.id },
                },
            },
            include: {
                school: { select: { name: true } },
                lessons: {
                    where: { teacherId: req.user.id },
                    include: {
                        class: { select: { name: true } },
                    },
                },
                assignments: {
                    where: { teacherId: req.user.id },
                    select: {
                        id: true,
                        title: true,
                        dueDate: true,
                        class: { select: { name: true } },
                    },
                    orderBy: { dueDate: "desc" },
                    take: 5,
                },
                _count: {
                    select: {
                        lessons: true,
                        assignments: true,
                        examQuestions: true,
                    },
                },
            },
            orderBy: { name: "asc" },
        });
        setup_1.logger.info("Teacher subjects retrieved", {
            userId: req.user?.id,
            subjectsCount: subjects.length,
        });
        res.status(200).json({
            message: "Teacher subjects retrieved successfully",
            subjects,
        });
    }
    catch (error) {
        (0, setup_1.handleError)(res, error, "Failed to retrieve teacher subjects");
    }
};
exports.getTeacherSubjects = getTeacherSubjects;
const getTeacherStudents = async (req, res) => {
    try {
        if (req.user?.role !== "TEACHER") {
            return res.status(403).json({ message: "Access denied" });
        }
        // Get students from classes the teacher supervises or teaches
        const students = await setup_1.prisma.student.findMany({
            where: {
                OR: [
                    {
                        class: { supervisorId: req.user.id },
                    },
                    {
                        class: {
                            lessons: {
                                some: { teacherId: req.user.id },
                            },
                        },
                    },
                ],
            },
            include: {
                class: {
                    select: {
                        name: true,
                        grade: { select: { name: true } },
                    },
                },
                parent: {
                    include: {
                        user: {
                            select: {
                                name: true,
                                surname: true,
                                email: true,
                                phone: true,
                            },
                        },
                    },
                },
                _count: {
                    select: {
                        attendances: true,
                        results: true,
                        assignmentSubmissions: true,
                    },
                },
            },
            orderBy: [{ class: { name: "asc" } }, { name: "asc" }],
        });
        // Group students by class
        const studentsByClass = students.reduce((acc, student) => {
            const className = student.class?.name || "No Class";
            if (!acc[className]) {
                acc[className] = [];
            }
            acc[className].push(student);
            return acc;
        }, {});
        setup_1.logger.info("Teacher students retrieved", {
            userId: req.user?.id,
            studentsCount: students.length,
            classesCount: Object.keys(studentsByClass).length,
        });
        res.status(200).json({
            message: "Teacher students retrieved successfully",
            students,
            studentsByClass,
            summary: {
                totalStudents: students.length,
                classesCount: Object.keys(studentsByClass).length,
            },
        });
    }
    catch (error) {
        (0, setup_1.handleError)(res, error, "Failed to retrieve teacher students");
    }
};
exports.getTeacherStudents = getTeacherStudents;
// Principal-specific endpoints for school management
const getPrincipalSchoolOverview = async (req, res) => {
    try {
        if (req.user?.role !== "PRINCIPAL") {
            return res.status(403).json({ message: "Access denied" });
        }
        const filter = (0, setup_1.getTenantFilter)(req.user);
        const [school, grades, classes, subjects, teachers, students, pendingApprovals, recentActivities] = await Promise.all([
            setup_1.prisma.school.findUnique({
                where: { id: req.user.schoolId },
                include: {
                    subscription: true,
                    _count: {
                        select: {
                            students: true,
                            teachers: true,
                            classes: true,
                            grades: true,
                            subjects: true,
                        },
                    },
                },
            }),
            setup_1.prisma.grade.findMany({
                where: filter,
                include: {
                    _count: {
                        select: {
                            classes: true,
                            students: true,
                        },
                    },
                },
                orderBy: { level: "asc" },
            }),
            setup_1.prisma.class.findMany({
                where: filter,
                include: {
                    grade: { select: { name: true } },
                    supervisor: {
                        include: {
                            user: { select: { name: true, surname: true } },
                        },
                    },
                    _count: {
                        select: {
                            students: true,
                            lessons: true,
                        },
                    },
                },
                orderBy: { name: "asc" },
            }),
            setup_1.prisma.subject.findMany({
                where: filter,
                include: {
                    teachers: {
                        include: {
                            user: { select: { name: true, surname: true } },
                        },
                    },
                    _count: {
                        select: {
                            lessons: true,
                            assignments: true,
                        },
                    },
                },
                orderBy: { name: "asc" },
            }),
            setup_1.prisma.teacher.findMany({
                where: filter,
                include: {
                    user: {
                        select: {
                            name: true,
                            surname: true,
                            email: true,
                            profileImageUrl: true,
                        },
                    },
                    approval: true,
                    subjects: {
                        select: { name: true },
                    },
                    supervisedClasses: {
                        select: { name: true },
                    },
                },
                orderBy: { user: { name: "asc" } },
            }),
            setup_1.prisma.student.count({ where: filter }),
            setup_1.prisma.approval.findMany({
                where: {
                    status: "PENDING",
                    OR: [
                        { teacher: { schoolId: req.user.schoolId } },
                        { assignment: { schoolId: req.user.schoolId } },
                        { examQuestion: { schoolId: req.user.schoolId } },
                    ],
                },
                include: {
                    teacher: {
                        include: {
                            user: { select: { name: true, surname: true } },
                        },
                    },
                    assignment: {
                        select: { title: true },
                    },
                    examQuestion: {
                        select: { title: true },
                    },
                },
                orderBy: { createdAt: "desc" },
            }),
            // Recent activities (assignments, events, etc.)
            setup_1.prisma.assignment.findMany({
                where: {
                    ...filter,
                    createdAt: {
                        gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
                    },
                },
                include: {
                    teacher: {
                        include: {
                            user: { select: { name: true, surname: true } },
                        },
                    },
                    subject: { select: { name: true } },
                    class: { select: { name: true } },
                },
                orderBy: { createdAt: "desc" },
                take: 10,
            }),
        ]);
        const overview = {
            school,
            structure: {
                grades,
                classes,
                subjects,
            },
            staff: {
                teachers,
                totalTeachers: teachers.length,
                approvedTeachers: teachers.filter((t) => t.approval?.status === "APPROVED").length,
                pendingTeachers: teachers.filter((t) => t.approval?.status === "PENDING").length,
            },
            students: {
                totalStudents: students,
            },
            pendingApprovals,
            recentActivities,
        };
        setup_1.logger.info("Principal school overview retrieved", {
            userId: req.user?.id,
            schoolId: req.user?.schoolId,
        });
        res.status(200).json({
            message: "Principal school overview retrieved successfully",
            overview,
        });
    }
    catch (error) {
        (0, setup_1.handleError)(res, error, "Failed to retrieve principal school overview");
    }
};
exports.getPrincipalSchoolOverview = getPrincipalSchoolOverview;
// Student verification endpoints
const addChildSchema = zod_1.z.object({
    studentId: zod_1.z.string().uuid("Invalid student ID"),
    verificationCode: zod_1.z.string().optional(),
});
const addChildToParent = async (req, res) => {
    try {
        if (req.user?.role !== "PARENT") {
            return res.status(403).json({ message: "Access denied" });
        }
        const data = addChildSchema.parse(req.body);
        // Find the student
        const student = await setup_1.prisma.student.findUnique({
            where: { id: data.studentId },
            include: {
                school: { select: { name: true } },
                parent: {
                    include: {
                        user: { select: { name: true, surname: true } },
                    },
                },
            },
        });
        if (!student) {
            return res.status(404).json({ message: "Student not found" });
        }
        // Check if student already has a parent
        if (student.parentId) {
            return res.status(400).json({
                message: "Student already has a parent assigned",
                currentParent: student.parent?.user,
            });
        }
        // Update student with parent ID
        const updatedStudent = await setup_1.prisma.student.update({
            where: { id: data.studentId },
            data: {
                parentId: req.user.id,
                verificationStatus: "PENDING",
            },
            include: {
                school: { select: { name: true } },
                class: { select: { name: true } },
                grade: { select: { name: true } },
            },
        });
        // Create notification for school admin/principal
        await setup_1.prisma.notification.create({
            data: {
                userId: req.user.id,
                title: "Child Added Successfully",
                content: `You have successfully added ${student.name} ${student.surname} from ${student.school.name} as your child. Verification is pending.`,
                type: "GENERAL",
            },
        });
        setup_1.logger.info("Child added to parent", {
            userId: req.user?.id,
            studentId: data.studentId,
            schoolId: student.schoolId,
        });
        res.status(200).json({
            message: "Child added successfully",
            student: updatedStudent,
        });
    }
    catch (error) {
        if (error instanceof zod_1.z.ZodError) {
            return res.status(400).json({ message: "Invalid input", errors: error.errors });
        }
        (0, setup_1.handleError)(res, error, "Failed to add child to parent");
    }
};
exports.addChildToParent = addChildToParent;
const verifyParentChild = async (req, res) => {
    const { studentId } = req.params;
    try {
        if (!["PRINCIPAL", "SCHOOL_ADMIN"].includes(req.user?.role || "")) {
            return res.status(403).json({ message: "Access denied" });
        }
        const filter = (0, setup_1.getTenantFilter)(req.user);
        const student = await setup_1.prisma.student.findFirst({
            where: {
                id: studentId,
                ...filter,
            },
            include: {
                parent: {
                    include: {
                        user: { select: { name: true, surname: true, email: true } },
                    },
                },
            },
        });
        if (!student) {
            return res.status(404).json({ message: "Student not found or access denied" });
        }
        const updatedStudent = await setup_1.prisma.student.update({
            where: { id: studentId },
            data: {
                verificationStatus: "VERIFIED",
                verifiedAt: new Date(),
            },
        });
        // Notify parent
        await setup_1.prisma.notification.create({
            data: {
                userId: student.parentId,
                title: "Child Verification Approved",
                content: `Your relationship with ${student.name} ${student.surname} has been verified and approved.`,
                type: "APPROVAL",
            },
        });
        setup_1.logger.info("Parent-child relationship verified", {
            userId: req.user?.id,
            studentId: studentId,
            parentId: student.parentId,
        });
        res.status(200).json({
            message: "Parent-child relationship verified successfully",
            student: updatedStudent,
        });
    }
    catch (error) {
        (0, setup_1.handleError)(res, error, "Failed to verify parent-child relationship");
    }
};
exports.verifyParentChild = verifyParentChild;
// Class assignment endpoints
const assignStudentToClass = async (req, res) => {
    const { studentId } = req.params;
    const { classId } = req.body;
    try {
        if (!["PRINCIPAL", "SCHOOL_ADMIN"].includes(req.user?.role || "")) {
            return res.status(403).json({ message: "Access denied" });
        }
        const filter = (0, setup_1.getTenantFilter)(req.user);
        // Verify student and class belong to the same school
        const [student, classRecord] = await Promise.all([
            setup_1.prisma.student.findFirst({
                where: { id: studentId, ...filter },
            }),
            setup_1.prisma.class.findFirst({
                where: { id: classId, ...filter },
                include: {
                    grade: { select: { name: true } },
                    _count: { select: { students: true } },
                },
            }),
        ]);
        if (!student) {
            return res.status(404).json({ message: "Student not found or access denied" });
        }
        if (!classRecord) {
            return res.status(404).json({ message: "Class not found or access denied" });
        }
        // Check class capacity
        if (classRecord._count.students >= classRecord.capacity) {
            return res.status(400).json({ message: "Class is at full capacity" });
        }
        const updatedStudent = await setup_1.prisma.student.update({
            where: { id: studentId },
            data: {
                classId: classId,
                gradeId: classRecord.gradeId,
            },
            include: {
                class: {
                    select: {
                        name: true,
                        grade: { select: { name: true } },
                    },
                },
            },
        });
        setup_1.logger.info("Student assigned to class", {
            userId: req.user?.id,
            studentId: studentId,
            classId: classId,
        });
        res.status(200).json({
            message: "Student assigned to class successfully",
            student: updatedStudent,
        });
    }
    catch (error) {
        (0, setup_1.handleError)(res, error, "Failed to assign student to class");
    }
};
exports.assignStudentToClass = assignStudentToClass;
const getUnassignedStudents = async (req, res) => {
    try {
        if (!["PRINCIPAL", "SCHOOL_ADMIN"].includes(req.user?.role || "")) {
            return res.status(403).json({ message: "Access denied" });
        }
        const filter = (0, setup_1.getTenantFilter)(req.user);
        const unassignedStudents = await setup_1.prisma.student.findMany({
            where: {
                ...filter,
                classId: null,
            },
            include: {
                parent: {
                    include: {
                        user: { select: { name: true, surname: true, email: true } },
                    },
                },
            },
            orderBy: { name: "asc" },
        });
        setup_1.logger.info("Unassigned students retrieved", {
            userId: req.user?.id,
            count: unassignedStudents.length,
        });
        res.status(200).json({
            message: "Unassigned students retrieved successfully",
            students: unassignedStudents,
            count: unassignedStudents.length,
        });
    }
    catch (error) {
        (0, setup_1.handleError)(res, error, "Failed to retrieve unassigned students");
    }
};
exports.getUnassignedStudents = getUnassignedStudents;
// Multi-tenant search endpoints
const searchAcrossSchools = async (req, res) => {
    try {
        if (req.user?.role !== "PARENT") {
            return res.status(403).json({ message: "Access denied" });
        }
        const { query, type } = req.query;
        if (!query || query.length < 2) {
            return res.status(400).json({ message: "Search query must be at least 2 characters" });
        }
        const results = {};
        // Get schools where parent has children
        const parentSchools = await setup_1.prisma.school.findMany({
            where: {
                students: {
                    some: { parentId: req.user.id },
                },
            },
            select: { id: true },
        });
        const schoolIds = parentSchools.map((s) => s.id);
        if (type === "assignments" || !type) {
            results.assignments = await setup_1.prisma.assignment.findMany({
                where: {
                    schoolId: { in: schoolIds },
                    OR: [
                        { title: { contains: query, mode: "insensitive" } },
                        { description: { contains: query, mode: "insensitive" } },
                    ],
                },
                include: {
                    school: { select: { name: true } },
                    subject: { select: { name: true } },
                    class: { select: { name: true } },
                    teacher: {
                        include: {
                            user: { select: { name: true, surname: true } },
                        },
                    },
                },
                take: 10,
            });
        }
        if (type === "events" || !type) {
            results.events = await setup_1.prisma.event.findMany({
                where: {
                    schoolId: { in: schoolIds },
                    OR: [
                        { title: { contains: query, mode: "insensitive" } },
                        { description: { contains: query, mode: "insensitive" } },
                    ],
                },
                include: {
                    school: { select: { name: true } },
                    class: { select: { name: true } },
                },
                take: 10,
            });
        }
        if (type === "announcements" || !type) {
            results.announcements = await setup_1.prisma.announcement.findMany({
                where: {
                    schoolId: { in: schoolIds },
                    OR: [
                        { title: { contains: query, mode: "insensitive" } },
                        { content: { contains: query, mode: "insensitive" } },
                    ],
                },
                include: {
                    school: { select: { name: true } },
                    class: { select: { name: true } },
                },
                take: 10,
            });
        }
        setup_1.logger.info("Multi-school search performed", {
            userId: req.user?.id,
            query: query,
            type: type,
            schoolsCount: schoolIds.length,
        });
        res.status(200).json({
            message: "Search completed successfully",
            query,
            results,
        });
    }
    catch (error) {
        (0, setup_1.handleError)(res, error, "Failed to perform search");
    }
};
exports.searchAcrossSchools = searchAcrossSchools;
