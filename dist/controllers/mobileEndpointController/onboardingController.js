"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getParentProfile = void 0;
const setup_1 = require("../../utils/setup");
const getParentProfile = async (req, res) => {
    try {
        if (req.user?.role !== "PARENT") {
            return res.status(403).json({ message: "Access denied. Only parents can access this profile." });
        }
        const parentUser = await setup_1.prisma.user.findUnique({
            where: { id: req.user.id },
            select: {
                id: true,
                name: true,
                surname: true,
                email: true,
                phone: true,
                address: true,
                profileImageUrl: true,
                createdAt: true,
                // Assuming 'birthday' is on a related 'Parent' model linked to User
                parent: {
                    select: {
                        birthday: true,
                    },
                },
            },
        });
        if (!parentUser) {
            setup_1.logger.warn("Parent user not found for onboarding profile", { userId: req.user.id });
            return res.status(404).json({ message: "Parent profile not found." });
        }
        // Access birthday from the included parent relation, if it exists
        const age = (0, setup_1.calculateAge)(parentUser.parent?.birthday);
        setup_1.logger.info("Parent onboarding profile retrieved", { userId: req.user.id });
        res.status(200).json({
            message: "Parent profile retrieved successfully",
            profile: {
                ...parentUser,
                // Flatten the birthday and age into the main profile object for convenience
                birthday: parentUser.parent?.birthday,
                age,
            },
        });
    }
    catch (error) {
        (0, setup_1.handleError)(res, error, "Failed to retrieve parent onboarding profile");
    }
};
exports.getParentProfile = getParentProfile;
