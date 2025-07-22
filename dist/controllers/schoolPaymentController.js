"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getTransferHistory = exports.getPaymentStatistics = exports.updatePaymentAccountStatus = exports.createSchoolPaymentAccount = exports.getSchoolPaymentAccount = void 0;
const client_1 = require("@prisma/client");
const paystack_1 = require("../utils/paystack");
const prisma = new client_1.PrismaClient();
// Get school payment account
const getSchoolPaymentAccount = async (req, res) => {
    try {
        const { schoolId } = req.params;
        const paymentAccount = await prisma.schoolPaymentAccount.findUnique({
            where: { schoolId },
            include: {
                school: {
                    select: { name: true },
                },
            },
        });
        res.json({
            success: true,
            data: paymentAccount,
        });
    }
    catch (error) {
        console.error("Error fetching payment account:", error);
        res.status(500).json({
            success: false,
            message: "Failed to fetch payment account",
        });
    }
};
exports.getSchoolPaymentAccount = getSchoolPaymentAccount;
// Create or update school payment account
const createSchoolPaymentAccount = async (req, res) => {
    try {
        const { schoolId } = req.params;
        const { accountName, accountNumber, bankCode, bankName, momoProvider, momoNumber, preferredMethod } = req.body;
        // Verify account number with bank
        let accountVerification;
        try {
            accountVerification = await (0, paystack_1.verifyAccountNumber)(accountNumber, bankCode);
            if (!accountVerification.status) {
                return res.status(400).json({
                    success: false,
                    message: "Invalid account details",
                });
            }
        }
        catch (verifyError) {
            console.error("Account verification error:", verifyError);
            return res.status(400).json({
                success: false,
                message: "Could not verify account details",
            });
        }
        // Get school details
        const school = await prisma.school.findUnique({
            where: { id: schoolId },
        });
        if (!school) {
            return res.status(404).json({
                success: false,
                message: "School not found",
            });
        }
        // Create Paystack subaccount
        const subaccountData = await (0, paystack_1.createSubaccount)({
            business_name: school.name,
            settlement_bank: bankCode,
            account_number: accountNumber,
            percentage_charge: 0, // We handle the split manually
            description: `Subaccount for ${school.name}`,
            primary_contact_email: school.email || "admin@edutrack.com",
            primary_contact_name: accountName,
            primary_contact_phone: school.phone || "0000000000",
        });
        // Create transfer recipient
        const recipientData = await (0, paystack_1.createTransferRecipient)({
            type: "nuban",
            name: accountName,
            account_number: accountNumber,
            bank_code: bankCode,
            description: `Transfer recipient for ${school.name}`,
        });
        // Create or update payment account
        const paymentAccount = await prisma.schoolPaymentAccount.upsert({
            where: { schoolId },
            update: {
                accountName,
                accountNumber,
                bankCode,
                bankName,
                momoProvider,
                momoNumber,
                preferredMethod: preferredMethod || "BANK_ACCOUNT",
                paystackSubaccountCode: subaccountData.subaccount_code,
                paystackRecipientCode: recipientData.recipient_code,
                isVerified: true,
                verifiedAt: new Date(),
            },
            create: {
                schoolId,
                accountName,
                accountNumber,
                bankCode,
                bankName,
                momoProvider,
                momoNumber,
                preferredMethod: preferredMethod || "BANK_ACCOUNT",
                paystackSubaccountCode: subaccountData.subaccount_code,
                paystackRecipientCode: recipientData.recipient_code,
                isVerified: true,
                verifiedAt: new Date(),
            },
        });
        res.json({
            success: true,
            data: paymentAccount,
            message: "Payment account configured successfully",
        });
    }
    catch (error) {
        console.error("Error creating payment account:", error);
        res.status(500).json({
            success: false,
            message: "Failed to configure payment account",
        });
    }
};
exports.createSchoolPaymentAccount = createSchoolPaymentAccount;
// Update payment account status
const updatePaymentAccountStatus = async (req, res) => {
    try {
        const { accountId } = req.params;
        const { isActive } = req.body;
        const paymentAccount = await prisma.schoolPaymentAccount.update({
            where: { id: accountId },
            data: { isActive },
        });
        res.json({
            success: true,
            data: paymentAccount,
            message: `Payment account ${isActive ? "activated" : "deactivated"} successfully`,
        });
    }
    catch (error) {
        console.error("Error updating payment account status:", error);
        res.status(500).json({
            success: false,
            message: "Failed to update payment account status",
        });
    }
};
exports.updatePaymentAccountStatus = updatePaymentAccountStatus;
// Get payment statistics for school
const getPaymentStatistics = async (req, res) => {
    try {
        const { schoolId } = req.params;
        const { startDate, endDate } = req.query;
        const dateFilter = {};
        if (startDate)
            dateFilter.gte = new Date(startDate);
        if (endDate)
            dateFilter.lte = new Date(endDate);
        const whereClause = {
            order: { schoolId },
        };
        if (Object.keys(dateFilter).length > 0) {
            whereClause.paidAt = dateFilter;
        }
        // Get payment statistics
        const [totalPayments, completedPayments, totalRevenue, totalProcessingFees, recentPayments] = await Promise.all([
            prisma.materialPayment.count({
                where: { order: { schoolId } },
            }),
            prisma.materialPayment.count({
                where: {
                    ...whereClause,
                    status: "COMPLETED",
                },
            }),
            prisma.materialPayment.aggregate({
                where: {
                    ...whereClause,
                    status: "COMPLETED",
                },
                _sum: {
                    schoolAmount: true,
                },
            }),
            prisma.materialPayment.aggregate({
                where: {
                    ...whereClause,
                    status: "COMPLETED",
                },
                _sum: {
                    processingFee: true,
                },
            }),
            prisma.materialPayment.findMany({
                where: {
                    order: { schoolId },
                    status: "COMPLETED",
                },
                include: {
                    order: {
                        select: {
                            orderNumber: true,
                            parent: {
                                include: {
                                    user: {
                                        select: { name: true, surname: true },
                                    },
                                },
                            },
                        },
                    },
                },
                orderBy: { paidAt: "desc" },
                take: 10,
            }),
        ]);
        res.json({
            success: true,
            data: {
                totalPayments,
                completedPayments,
                totalRevenue: totalRevenue._sum.schoolAmount || 0,
                totalProcessingFees: totalProcessingFees._sum.processingFee || 0,
                recentPayments,
            },
        });
    }
    catch (error) {
        console.error("Error fetching payment statistics:", error);
        res.status(500).json({
            success: false,
            message: "Failed to fetch payment statistics",
        });
    }
};
exports.getPaymentStatistics = getPaymentStatistics;
// Get transfer history
const getTransferHistory = async (req, res) => {
    try {
        const { schoolId } = req.params;
        const { page = 1, limit = 20 } = req.query;
        const skip = (Number(page) - 1) * Number(limit);
        const [transfers, total] = await Promise.all([
            prisma.materialPayment.findMany({
                where: {
                    order: { schoolId },
                    status: "COMPLETED",
                    schoolTransferCode: { not: null },
                },
                include: {
                    order: {
                        select: {
                            orderNumber: true,
                            parent: {
                                include: {
                                    user: {
                                        select: { name: true, surname: true },
                                    },
                                },
                            },
                        },
                    },
                },
                skip,
                take: Number(limit),
                orderBy: { schoolTransferredAt: "desc" },
            }),
            prisma.materialPayment.count({
                where: {
                    order: { schoolId },
                    status: "COMPLETED",
                    schoolTransferCode: { not: null },
                },
            }),
        ]);
        res.json({
            success: true,
            data: {
                transfers,
                pagination: {
                    page: Number(page),
                    limit: Number(limit),
                    total,
                    pages: Math.ceil(total / Number(limit)),
                },
            },
        });
    }
    catch (error) {
        console.error("Error fetching transfer history:", error);
        res.status(500).json({
            success: false,
            message: "Failed to fetch transfer history",
        });
    }
};
exports.getTransferHistory = getTransferHistory;
