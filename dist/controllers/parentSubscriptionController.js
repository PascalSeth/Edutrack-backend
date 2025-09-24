"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.cancelParentSubscription = exports.createParentSubscription = exports.getParentSubscription = void 0;
const setup_1 = require("../utils/setup");
const client_1 = require("@prisma/client");
const paystack_1 = require("../utils/paystack");
/**
 * @route GET /parents/subscription
 * @description Get current subscription for logged-in parent
 * @access Private (Parent only)
 */
const getParentSubscription = async (req, res) => {
    try {
        if (req.user?.role !== client_1.UserRole.PARENT) {
            return res.status(403).json({ message: "Access denied. Only parents can view subscriptions." });
        }
        const subscription = await setup_1.prisma.parentSubscription.findFirst({
            where: {
                parentId: req.user.id,
                status: "ACTIVE",
                endDate: {
                    gte: new Date(),
                },
            },
            orderBy: {
                endDate: "desc",
            },
        });
        if (!subscription) {
            return res.status(404).json({ message: "No active subscription found." });
        }
        setup_1.logger.info("Parent subscription retrieved", { userId: req.user.id, subscriptionId: subscription.id });
        res.status(200).json({
            message: "Subscription retrieved successfully",
            subscription,
        });
    }
    catch (error) {
        (0, setup_1.handleError)(res, error, "Failed to retrieve subscription");
    }
};
exports.getParentSubscription = getParentSubscription;
/**
 * @route POST /parents/subscription
 * @description Initialize subscription payment for parent
 * @access Private (Parent only)
 */
const createParentSubscription = async (req, res) => {
    try {
        if (req.user?.role !== client_1.UserRole.PARENT) {
            return res.status(403).json({ message: "Access denied. Only parents can create subscriptions." });
        }
        const { plan } = req.body;
        if (!plan || !Object.values(client_1.ParentSubscriptionPlan).includes(plan)) {
            return res.status(400).json({ message: "Invalid subscription plan." });
        }
        // Check for existing active subscription
        const existingSubscription = await setup_1.prisma.parentSubscription.findFirst({
            where: {
                parentId: req.user.id,
                status: "ACTIVE",
                endDate: {
                    gte: new Date(),
                },
            },
        });
        if (existingSubscription) {
            return res.status(400).json({ message: "You already have an active subscription." });
        }
        // Get parent user details for payment
        const parentUser = await setup_1.prisma.user.findUnique({
            where: { id: req.user.id },
            select: { email: true, name: true, surname: true },
        });
        if (!parentUser) {
            return res.status(404).json({ message: "Parent user not found." });
        }
        // Calculate amount and end date based on plan
        let amount;
        let endDate;
        const now = new Date();
        switch (plan) {
            case client_1.ParentSubscriptionPlan.MONTHLY:
                amount = 20;
                endDate = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000); // 30 days
                break;
            case client_1.ParentSubscriptionPlan.SIX_MONTHS:
                amount = 100;
                endDate = new Date(now.getTime() + 180 * 24 * 60 * 60 * 1000); // 180 days
                break;
            case client_1.ParentSubscriptionPlan.ANNUAL:
                amount = 220;
                endDate = new Date(now.getTime() + 365 * 24 * 60 * 60 * 1000); // 365 days
                break;
            default:
                return res.status(400).json({ message: "Invalid plan." });
        }
        // Create pending subscription
        const subscription = await setup_1.prisma.parentSubscription.create({
            data: {
                parentId: req.user.id,
                plan,
                amount,
                endDate,
                status: "PENDING",
            },
        });
        // Initialize Paystack payment (amount in pesewas for GHS)
        const paymentData = await (0, paystack_1.initializePayment)({
            email: parentUser.email,
            amount: amount * 100, // Convert to pesewas (smallest currency unit)
            currency: "GHS",
            reference: `SUB-${subscription.id}-${Date.now()}`,
            callback_url: `${process.env.FRONTEND_URL}/subscription/payment/callback`,
            metadata: {
                subscriptionId: subscription.id,
                plan,
                type: "subscription",
            },
        });
        setup_1.logger.info("Parent subscription payment initialized", {
            userId: req.user.id,
            subscriptionId: subscription.id,
            plan,
            amount,
            paystackRef: paymentData.reference
        });
        res.status(200).json({
            message: "Subscription payment initialized",
            subscription,
            payment: {
                authorization_url: paymentData.authorization_url,
                reference: paymentData.reference,
            },
        });
    }
    catch (error) {
        (0, setup_1.handleError)(res, error, "Failed to initialize subscription payment");
    }
};
exports.createParentSubscription = createParentSubscription;
/**
 * @route PUT /parents/subscription/:id/cancel
 * @description Cancel subscription
 * @access Private (Parent only)
 */
const cancelParentSubscription = async (req, res) => {
    try {
        if (req.user?.role !== client_1.UserRole.PARENT) {
            return res.status(403).json({ message: "Access denied. Only parents can cancel subscriptions." });
        }
        const { id } = req.params;
        const subscription = await setup_1.prisma.parentSubscription.findFirst({
            where: {
                id,
                parentId: req.user.id,
                status: "ACTIVE",
            },
        });
        if (!subscription) {
            return res.status(404).json({ message: "Subscription not found or not active." });
        }
        const updatedSubscription = await setup_1.prisma.parentSubscription.update({
            where: { id },
            data: {
                status: "CANCELLED",
            },
        });
        setup_1.logger.info("Parent subscription cancelled", { userId: req.user.id, subscriptionId: id });
        res.status(200).json({
            message: "Subscription cancelled successfully",
            subscription: updatedSubscription,
        });
    }
    catch (error) {
        (0, setup_1.handleError)(res, error, "Failed to cancel subscription");
    }
};
exports.cancelParentSubscription = cancelParentSubscription;
