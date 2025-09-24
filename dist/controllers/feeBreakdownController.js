"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getStudentFeeBreakdown = exports.setStudentOverride = exports.deleteFeeBreakdownItem = exports.updateFeeBreakdownItem = exports.addFeeBreakdownItem = exports.updateFeeStructure = exports.createFeeStructure = exports.getFeeStructure = exports.getFeeStructures = void 0;
const client_1 = require("@prisma/client");
const prisma = new client_1.PrismaClient();
// Get all fee structures for a school
const getFeeStructures = async (req, res) => {
    try {
        const { schoolId } = req.params;
        const { academicYearId, feeType } = req.query;
        const where = { schoolId };
        if (academicYearId)
            where.academicYearId = academicYearId;
        if (feeType)
            where.feeType = feeType;
        const feeStructures = await prisma.feeStructure.findMany({
            where,
            include: {
                academicYear: {
                    select: { name: true, startDate: true, endDate: true }
                },
                feeBreakdownItems: {
                    orderBy: { createdAt: 'asc' }
                },
                _count: {
                    select: { payments: true }
                }
            },
            orderBy: { createdAt: 'desc' }
        });
        res.json({
            success: true,
            data: feeStructures
        });
    }
    catch (error) {
        console.error("Error fetching fee structures:", error);
        res.status(500).json({
            success: false,
            message: "Failed to fetch fee structures"
        });
    }
};
exports.getFeeStructures = getFeeStructures;
// Get single fee structure with breakdown
const getFeeStructure = async (req, res) => {
    try {
        const { feeStructureId } = req.params;
        const feeStructure = await prisma.feeStructure.findUnique({
            where: { id: feeStructureId },
            include: {
                academicYear: {
                    select: { name: true, startDate: true, endDate: true }
                },
                feeBreakdownItems: {
                    include: {
                        studentOverrides: {
                            include: {
                                student: {
                                    select: { name: true, surname: true, registrationNumber: true }
                                }
                            }
                        }
                    },
                    orderBy: { createdAt: 'asc' }
                },
                payments: {
                    select: {
                        id: true,
                        amount: true,
                        status: true,
                        paymentDate: true,
                        parent: {
                            select: {
                                user: { select: { name: true, surname: true } }
                            }
                        }
                    },
                    orderBy: { paymentDate: 'desc' },
                    take: 10
                }
            }
        });
        if (!feeStructure) {
            return res.status(404).json({
                success: false,
                message: "Fee structure not found"
            });
        }
        res.json({
            success: true,
            data: feeStructure
        });
    }
    catch (error) {
        console.error("Error fetching fee structure:", error);
        res.status(500).json({
            success: false,
            message: "Failed to fetch fee structure"
        });
    }
};
exports.getFeeStructure = getFeeStructure;
// Create fee structure with breakdown
const createFeeStructure = async (req, res) => {
    try {
        const { schoolId } = req.params;
        const { name, description, academicYearId, feeType, dueDate, gracePeriod, lateFee, currency = "GHS", feeBreakdownItems } = req.body;
        // Calculate total amount from breakdown items
        const totalAmount = feeBreakdownItems?.reduce((sum, item) => sum + parseFloat(item.amount), 0) || 0;
        const feeStructure = await prisma.feeStructure.create({
            data: {
                name,
                description,
                amount: totalAmount,
                currency,
                academicYearId,
                schoolId,
                feeType: feeType || "TUITION",
                dueDate: dueDate ? new Date(dueDate) : null,
                gracePeriod,
                lateFee: lateFee ? parseFloat(lateFee) : null,
                feeBreakdownItems: {
                    create: feeBreakdownItems?.map((item) => ({
                        name: item.name,
                        description: item.description,
                        amount: parseFloat(item.amount),
                        isMandatory: item.isMandatory ?? true,
                        isRecurring: item.isRecurring ?? true,
                        frequency: item.frequency
                    })) || []
                }
            },
            include: {
                feeBreakdownItems: true
            }
        });
        res.status(201).json({
            success: true,
            data: feeStructure,
            message: "Fee structure created successfully"
        });
    }
    catch (error) {
        console.error("Error creating fee structure:", error);
        res.status(500).json({
            success: false,
            message: "Failed to create fee structure"
        });
    }
};
exports.createFeeStructure = createFeeStructure;
// Update fee structure
const updateFeeStructure = async (req, res) => {
    try {
        const { feeStructureId } = req.params;
        const updates = req.body;
        // If updating breakdown items, recalculate total
        if (updates.feeBreakdownItems) {
            const totalAmount = updates.feeBreakdownItems.reduce((sum, item) => sum + parseFloat(item.amount), 0);
            updates.amount = totalAmount;
        }
        const feeStructure = await prisma.feeStructure.update({
            where: { id: feeStructureId },
            data: updates,
            include: {
                feeBreakdownItems: true
            }
        });
        res.json({
            success: true,
            data: feeStructure,
            message: "Fee structure updated successfully"
        });
    }
    catch (error) {
        console.error("Error updating fee structure:", error);
        res.status(500).json({
            success: false,
            message: "Failed to update fee structure"
        });
    }
};
exports.updateFeeStructure = updateFeeStructure;
// Add breakdown item to fee structure
const addFeeBreakdownItem = async (req, res) => {
    try {
        const { feeStructureId } = req.params;
        const { name, description, amount, isMandatory, isRecurring, frequency } = req.body;
        const breakdownItem = await prisma.feeBreakdownItem.create({
            data: {
                name,
                description,
                amount: parseFloat(amount),
                isMandatory: isMandatory ?? true,
                isRecurring: isRecurring ?? true,
                frequency,
                feeStructureId
            }
        });
        // Update total amount
        await updateFeeStructureTotal(feeStructureId);
        res.status(201).json({
            success: true,
            data: breakdownItem,
            message: "Fee breakdown item added successfully"
        });
    }
    catch (error) {
        console.error("Error adding fee breakdown item:", error);
        res.status(500).json({
            success: false,
            message: "Failed to add fee breakdown item"
        });
    }
};
exports.addFeeBreakdownItem = addFeeBreakdownItem;
// Update breakdown item
const updateFeeBreakdownItem = async (req, res) => {
    try {
        const { itemId } = req.params;
        const updates = req.body;
        if (updates.amount) {
            updates.amount = parseFloat(updates.amount);
        }
        const breakdownItem = await prisma.feeBreakdownItem.update({
            where: { id: itemId },
            data: updates
        });
        // Update total amount
        const feeStructure = await prisma.feeStructure.findFirst({
            where: { feeBreakdownItems: { some: { id: itemId } } }
        });
        if (feeStructure) {
            await updateFeeStructureTotal(feeStructure.id);
        }
        res.json({
            success: true,
            data: breakdownItem,
            message: "Fee breakdown item updated successfully"
        });
    }
    catch (error) {
        console.error("Error updating fee breakdown item:", error);
        res.status(500).json({
            success: false,
            message: "Failed to update fee breakdown item"
        });
    }
};
exports.updateFeeBreakdownItem = updateFeeBreakdownItem;
// Delete breakdown item
const deleteFeeBreakdownItem = async (req, res) => {
    try {
        const { itemId } = req.params;
        // Get fee structure ID before deleting
        const item = await prisma.feeBreakdownItem.findUnique({
            where: { id: itemId },
            select: { feeStructureId: true }
        });
        if (!item) {
            return res.status(404).json({
                success: false,
                message: "Fee breakdown item not found"
            });
        }
        await prisma.feeBreakdownItem.delete({
            where: { id: itemId }
        });
        // Update total amount
        await updateFeeStructureTotal(item.feeStructureId);
        res.json({
            success: true,
            message: "Fee breakdown item deleted successfully"
        });
    }
    catch (error) {
        console.error("Error deleting fee breakdown item:", error);
        res.status(500).json({
            success: false,
            message: "Failed to delete fee breakdown item"
        });
    }
};
exports.deleteFeeBreakdownItem = deleteFeeBreakdownItem;
// Set student-specific override
const setStudentOverride = async (req, res) => {
    try {
        const { itemId, studentId } = req.params;
        const { overrideAmount, isExempt, overrideReason } = req.body;
        const override = await prisma.feeBreakdownOverride.upsert({
            where: {
                feeBreakdownItemId_studentId: {
                    feeBreakdownItemId: itemId,
                    studentId
                }
            },
            update: {
                overrideAmount: overrideAmount ? parseFloat(overrideAmount) : null,
                isExempt,
                overrideReason
            },
            create: {
                feeBreakdownItemId: itemId,
                studentId,
                overrideAmount: overrideAmount ? parseFloat(overrideAmount) : null,
                isExempt,
                overrideReason
            }
        });
        res.json({
            success: true,
            data: override,
            message: "Student override set successfully"
        });
    }
    catch (error) {
        console.error("Error setting student override:", error);
        res.status(500).json({
            success: false,
            message: "Failed to set student override"
        });
    }
};
exports.setStudentOverride = setStudentOverride;
// Get student's fee breakdown (for parents)
const getStudentFeeBreakdown = async (req, res) => {
    try {
        const { studentId } = req.params;
        const student = await prisma.student.findUnique({
            where: { id: studentId },
            select: {
                id: true,
                name: true,
                surname: true,
                registrationNumber: true,
                grade: {
                    select: { name: true, level: true }
                },
                class: {
                    select: { name: true }
                },
                school: {
                    select: { id: true, name: true }
                }
            }
        });
        if (!student) {
            return res.status(404).json({
                success: false,
                message: "Student not found"
            });
        }
        // Get applicable fee structures for student's grade/academic year
        const currentAcademicYear = await prisma.academicYear.findFirst({
            where: {
                schoolId: student.school.id,
                isActive: true
            }
        });
        if (!currentAcademicYear) {
            return res.status(404).json({
                success: false,
                message: "No active academic year found"
            });
        }
        const feeStructures = await prisma.feeStructure.findMany({
            where: {
                schoolId: student.school.id,
                academicYearId: currentAcademicYear.id
            },
            include: {
                feeBreakdownItems: {
                    include: {
                        studentOverrides: {
                            where: { studentId: student.id }
                        }
                    }
                }
            }
        });
        // Calculate breakdown for each fee structure
        const breakdown = feeStructures.map(feeStructure => {
            const items = feeStructure.feeBreakdownItems.map(item => {
                const override = item.studentOverrides[0];
                const finalAmount = override?.isExempt ? 0 :
                    override?.overrideAmount ?? item.amount.toNumber();
                return {
                    id: item.id,
                    name: item.name,
                    description: item.description,
                    baseAmount: item.amount.toNumber(),
                    finalAmount,
                    isMandatory: item.isMandatory,
                    isRecurring: item.isRecurring,
                    frequency: item.frequency,
                    hasOverride: !!override,
                    overrideReason: override?.overrideReason,
                    isExempt: override?.isExempt || false
                };
            });
            const totalAmount = items.reduce((sum, item) => sum + Number(item.finalAmount), 0);
            return {
                feeStructureId: feeStructure.id,
                feeStructureName: feeStructure.name,
                feeType: feeStructure.feeType,
                dueDate: feeStructure.dueDate,
                gracePeriod: feeStructure.gracePeriod,
                lateFee: feeStructure.lateFee?.toNumber(),
                currency: feeStructure.currency,
                items,
                totalAmount
            };
        });
        res.json({
            success: true,
            data: {
                student,
                academicYear: {
                    id: currentAcademicYear.id,
                    name: currentAcademicYear.name
                },
                feeBreakdown: breakdown
            }
        });
    }
    catch (error) {
        console.error("Error fetching student fee breakdown:", error);
        res.status(500).json({
            success: false,
            message: "Failed to fetch student fee breakdown"
        });
    }
};
exports.getStudentFeeBreakdown = getStudentFeeBreakdown;
// Helper function to update fee structure total
const updateFeeStructureTotal = async (feeStructureId) => {
    const items = await prisma.feeBreakdownItem.findMany({
        where: { feeStructureId },
        select: { amount: true }
    });
    const total = items.reduce((sum, item) => sum + item.amount.toNumber(), 0);
    await prisma.feeStructure.update({
        where: { id: feeStructureId },
        data: { amount: total }
    });
};
