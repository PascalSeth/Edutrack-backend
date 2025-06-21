"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.deleteUser = exports.updateUser = exports.getUserById = exports.getUsers = void 0;
const zod_1 = require("zod");
const setup_1 = require("../utils/setup");
// Validation Schema for updateUser
const updateUserSchema = zod_1.z.object({
    email: zod_1.z.string().email('Invalid email').optional(),
    username: zod_1.z.string().min(1, 'Username is required').optional(),
    name: zod_1.z.string().min(1, 'Name is required').optional(),
    surname: zod_1.z.string().min(1, 'Surname is required').optional(),
    role: zod_1.z.enum(['SUPER_ADMIN', 'PRINCIPAL', 'TEACHER', 'PARENT'], { message: 'Invalid role' }).optional(),
}).refine(data => Object.keys(data).length > 0, { message: 'At least one field must be provided for update' });
const getUsers = async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 10;
        const skip = (page - 1) * limit;
        // Restrict non-SUPER_ADMIN users to their own data
        let where = {};
        if (req.user?.role !== 'SUPER_ADMIN') {
            where = { id: req.user?.id };
        }
        const [users, total] = await Promise.all([
            setup_1.prisma.user.findMany({
                where,
                skip,
                take: limit,
                select: {
                    id: true,
                    email: true,
                    username: true,
                    name: true,
                    surname: true,
                    role: true,
                    createdAt: true,
                },
            }),
            setup_1.prisma.user.count({ where }),
        ]);
        setup_1.logger.info('Users retrieved', { userId: req.user?.id, page, limit });
        res.status(200).json({
            message: 'Users retrieved successfully',
            users,
            pagination: { page, limit, total, pages: Math.ceil(total / limit) },
        });
    }
    catch (error) {
        (0, setup_1.handleError)(res, error, 'Failed to retrieve users');
    }
};
exports.getUsers = getUsers;
const getUserById = async (req, res) => {
    const { id } = req.params;
    try {
        // Restrict non-SUPER_ADMIN users to their own data
        if (req.user?.role !== 'SUPER_ADMIN' && req.user?.id !== id) {
            setup_1.logger.warn('Unauthorized user access', { userId: req.user?.id, requestedUserId: id });
            return res.status(403).json({ message: 'Unauthorized to access this user' });
        }
        const user = await setup_1.prisma.user.findUnique({
            where: { id },
            select: {
                id: true,
                email: true,
                username: true,
                name: true,
                surname: true,
                role: true,
                createdAt: true,
            },
        });
        if (!user) {
            setup_1.logger.warn('User not found', { userId: req.user?.id, requestedUserId: id });
            return res.status(404).json({ message: 'User not found' });
        }
        setup_1.logger.info('User retrieved', { userId: req.user?.id, requestedUserId: id });
        res.status(200).json({ message: 'User retrieved successfully', user });
    }
    catch (error) {
        (0, setup_1.handleError)(res, error, 'Failed to retrieve user');
    }
};
exports.getUserById = getUserById;
const updateUser = async (req, res) => {
    const { id } = req.params;
    try {
        const data = updateUserSchema.parse(req.body);
        // Restrict to SUPER_ADMIN or the user themselves
        if (req.user?.role !== 'SUPER_ADMIN' && req.user?.id !== id) {
            setup_1.logger.warn('Unauthorized attempt to update user', { userId: req.user?.id, requestedUserId: id });
            return res.status(403).json({ message: 'Unauthorized to update this user' });
        }
        // Prevent non-SUPER_ADMIN from changing role
        if (data.role && req.user?.role !== 'SUPER_ADMIN') {
            setup_1.logger.warn('Unauthorized attempt to change role', { userId: req.user?.id, requestedUserId: id });
            return res.status(403).json({ message: 'Only SUPER_ADMIN can change roles' });
        }
        // Check for email/username conflicts
        if (data.email || data.username) {
            const existingUser = await setup_1.prisma.user.findFirst({
                where: {
                    OR: [
                        data.email ? { email: data.email, id: { not: id } } : {},
                        data.username ? { username: data.username, id: { not: id } } : {},
                    ].filter(Boolean),
                },
            });
            if (existingUser) {
                setup_1.logger.warn('Update failed: Email or username already exists', { userId: req.user?.id, requestedUserId: id });
                return res.status(409).json({ message: 'Email or username already exists' });
            }
        }
        const user = await setup_1.prisma.user.update({
            where: { id },
            data: {
                email: data.email,
                username: data.username,
                name: data.name,
                surname: data.surname,
                role: data.role,
                updatedAt: new Date(),
            },
        });
        setup_1.logger.info('User updated', { userId: req.user?.id, updatedUserId: id });
        res.status(200).json({ message: 'User updated successfully', user });
    }
    catch (error) {
        if (error instanceof zod_1.z.ZodError) {
            setup_1.logger.warn('Invalid input for user update', { userId: req.user?.id, errors: error.errors });
            return res.status(400).json({ message: 'Invalid input', errors: error.errors });
        }
        (0, setup_1.handleError)(res, error, 'Failed to update user');
    }
};
exports.updateUser = updateUser;
const deleteUser = async (req, res) => {
    const { id } = req.params;
    try {
        // Restrict to SUPER_ADMIN
        if (req.user?.role !== 'SUPER_ADMIN') {
            setup_1.logger.warn('Unauthorized attempt to delete user', { userId: req.user?.id, requestedUserId: id });
            return res.status(403).json({ message: 'Only SUPER_ADMIN can delete users' });
        }
        await setup_1.prisma.user.delete({ where: { id } });
        setup_1.logger.info('User deleted', { userId: req.user?.id, deletedUserId: id });
        res.status(200).json({ message: 'User deleted successfully' });
    }
    catch (error) {
        (0, setup_1.handleError)(res, error, 'Failed to delete user');
    }
};
exports.deleteUser = deleteUser;
