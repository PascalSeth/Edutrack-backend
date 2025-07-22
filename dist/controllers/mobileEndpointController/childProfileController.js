"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getParentChildren = void 0;
const setup_1 = require("../../utils/setup");
const client_1 = require("@prisma/client");
/**
 * @route GET /mobile/parent/children
 * @description Get a list of children associated with the logged-in parent, including their basic info.
 * @access Private (Parent only)
 */
const getParentChildren = async (req, res) => {
    try {
        if (req.user?.role !== client_1.UserRole.PARENT) {
            return res.status(403).json({ message: "Access denied. Only parents can view their children." });
        }
        const children = await setup_1.prisma.student.findMany({
            where: { parentId: req.user.id },
            select: {
                id: true,
                name: true,
                surname: true,
                birthday: true,
                imageUrl: true,
                registrationNumber: true,
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
                    },
                },
                grade: {
                    select: {
                        id: true,
                        name: true,
                        level: true,
                    },
                },
            },
            orderBy: [{ school: { name: "asc" } }, { name: "asc" }],
        });
        const childrenWithAge = children.map((child) => ({
            id: child.id,
            name: child.name,
            surname: child.surname,
            birthday: child.birthday,
            age: (0, setup_1.calculateAge)(child.birthday), // Calculate age from DOB
            imageUrl: child.imageUrl,
            registrationNumber: child.registrationNumber,
            school: child.school,
            class: child.class,
            grade: child.grade,
        }));
        setup_1.logger.info("Children list retrieved for parent", { userId: req.user.id, childrenCount: childrenWithAge.length });
        res.status(200).json({
            message: "Children list retrieved successfully",
            children: childrenWithAge,
        });
    }
    catch (error) {
        (0, setup_1.handleError)(res, error, "Failed to retrieve children list");
    }
};
exports.getParentChildren = getParentChildren;
