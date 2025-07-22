"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.updateCartItem = exports.deleteMaterial = exports.getMaterial = exports.getMaterialsByCategory = exports.createMaterialCategory = exports.getMaterialCategories = exports.clearCart = exports.removeFromCart = exports.addToCart = exports.getCart = exports.uploadMaterialImages = exports.updateMaterial = exports.createMaterial = exports.getMaterialById = exports.getMaterials = exports.createCategory = exports.getCategories = void 0;
const zod_1 = require("zod");
const setup_1 = require("../utils/setup");
const supabase_1 = require("../config/supabase");
// Validation Schemas
const createCategorySchema = zod_1.z.object({
    name: zod_1.z.string().min(1, "Category name is required"),
    description: zod_1.z.string().optional(),
    imageUrl: zod_1.z.string().optional(),
});
const createMaterialSchema = zod_1.z.object({
    name: zod_1.z.string().min(1, "Material name is required"),
    description: zod_1.z.string().optional(),
    price: zod_1.z.number().positive("Price must be positive"),
    stockQuantity: zod_1.z.number().int().min(0, "Stock quantity cannot be negative"),
    minOrderQty: zod_1.z.number().int().min(1, "Minimum order quantity must be at least 1").default(1),
    maxOrderQty: zod_1.z.number().int().positive().optional(),
    categoryId: zod_1.z.string().uuid("Invalid category ID"),
    brand: zod_1.z.string().optional(),
    model: zod_1.z.string().optional(),
    specifications: zod_1.z.record(zod_1.z.any()).optional(),
});
const updateMaterialSchema = createMaterialSchema.partial();
const addToCartSchema = zod_1.z.object({
    materialId: zod_1.z.string().uuid("Invalid material ID"),
    quantity: zod_1.z.number().int().min(1, "Quantity must be at least 1"),
});
// Categories
const getCategories = async (req, res) => {
    try {
        const schoolId = req.query.schoolId || req.user?.schoolId;
        if (!schoolId) {
            return res.status(400).json({ message: "School ID is required" });
        }
        const categories = await setup_1.prisma.materialCategory.findMany({
            where: {
                schoolId,
                isActive: true,
            },
            include: {
                _count: {
                    select: { materials: true },
                },
            },
            orderBy: { name: "asc" },
        });
        res.status(200).json({
            message: "Categories retrieved successfully",
            categories,
        });
    }
    catch (error) {
        (0, setup_1.handleError)(res, error, "Failed to retrieve categories");
    }
};
exports.getCategories = getCategories;
const createCategory = async (req, res) => {
    try {
        if (!["PRINCIPAL", "SCHOOL_ADMIN", "SUPER_ADMIN"].includes(req.user?.role || "")) {
            return res.status(403).json({ message: "Access denied" });
        }
        const data = createCategorySchema.parse(req.body);
        const schoolId = req.user?.schoolId;
        const category = await setup_1.prisma.materialCategory.create({
            data: {
                name: data.name,
                description: data.description,
                imageUrl: data.imageUrl,
                schoolId,
            },
        });
        setup_1.logger.info("Material category created", {
            userId: req.user?.id,
            categoryId: category.id,
            schoolId,
        });
        res.status(201).json({
            message: "Category created successfully",
            category,
        });
    }
    catch (error) {
        if (error instanceof zod_1.z.ZodError) {
            return res.status(400).json({ message: "Invalid input", errors: error.errors });
        }
        (0, setup_1.handleError)(res, error, "Failed to create category");
    }
};
exports.createCategory = createCategory;
// Materials
const getMaterials = async (req, res) => {
    try {
        const page = Number.parseInt(req.query.page) || 1;
        const limit = Number.parseInt(req.query.limit) || 20;
        const skip = (page - 1) * limit;
        const schoolId = req.query.schoolId || req.user?.schoolId;
        const categoryId = req.query.categoryId;
        const search = req.query.search;
        if (!schoolId) {
            return res.status(400).json({ message: "School ID is required" });
        }
        const where = {
            schoolId,
            isActive: true,
            stockQuantity: { gt: 0 }, // Only show materials in stock
        };
        if (categoryId) {
            where.categoryId = categoryId;
        }
        if (search) {
            where.OR = [
                { name: { contains: search, mode: "insensitive" } },
                { description: { contains: search, mode: "insensitive" } },
                { brand: { contains: search, mode: "insensitive" } },
            ];
        }
        const [materials, total] = await Promise.all([
            setup_1.prisma.material.findMany({
                where,
                skip,
                take: limit,
                include: {
                    category: { select: { name: true } },
                    school: { select: { name: true } },
                },
                orderBy: { name: "asc" },
            }),
            setup_1.prisma.material.count({ where }),
        ]);
        res.status(200).json({
            message: "Materials retrieved successfully",
            materials,
            pagination: { page, limit, total, pages: Math.ceil(total / limit) },
        });
    }
    catch (error) {
        (0, setup_1.handleError)(res, error, "Failed to retrieve materials");
    }
};
exports.getMaterials = getMaterials;
const getMaterialById = async (req, res) => {
    const { id } = req.params;
    try {
        const material = await setup_1.prisma.material.findUnique({
            where: { id },
            include: {
                category: true,
                school: { select: { name: true, logoUrl: true } },
            },
        });
        if (!material) {
            return res.status(404).json({ message: "Material not found" });
        }
        res.status(200).json({
            message: "Material retrieved successfully",
            material,
        });
    }
    catch (error) {
        (0, setup_1.handleError)(res, error, "Failed to retrieve material");
    }
};
exports.getMaterialById = getMaterialById;
const createMaterial = async (req, res) => {
    try {
        if (!["PRINCIPAL", "SCHOOL_ADMIN", "SUPER_ADMIN"].includes(req.user?.role || "")) {
            return res.status(403).json({ message: "Access denied" });
        }
        const data = createMaterialSchema.parse(req.body);
        const schoolId = req.user?.schoolId;
        // Verify category exists and belongs to school
        const category = await setup_1.prisma.materialCategory.findFirst({
            where: { id: data.categoryId, schoolId },
        });
        if (!category) {
            return res.status(404).json({ message: "Category not found" });
        }
        const material = await setup_1.prisma.material.create({
            data: {
                name: data.name,
                description: data.description,
                price: data.price,
                stockQuantity: data.stockQuantity,
                minOrderQty: data.minOrderQty,
                maxOrderQty: data.maxOrderQty,
                categoryId: data.categoryId,
                schoolId,
                brand: data.brand,
                model: data.model,
                specifications: data.specifications,
            },
            include: {
                category: true,
            },
        });
        setup_1.logger.info("Material created", {
            userId: req.user?.id,
            materialId: material.id,
            schoolId,
        });
        res.status(201).json({
            message: "Material created successfully",
            material,
        });
    }
    catch (error) {
        if (error instanceof zod_1.z.ZodError) {
            return res.status(400).json({ message: "Invalid input", errors: error.errors });
        }
        (0, setup_1.handleError)(res, error, "Failed to create material");
    }
};
exports.createMaterial = createMaterial;
const updateMaterial = async (req, res) => {
    const { id } = req.params;
    try {
        if (!["PRINCIPAL", "SCHOOL_ADMIN", "SUPER_ADMIN"].includes(req.user?.role || "")) {
            return res.status(403).json({ message: "Access denied" });
        }
        const data = updateMaterialSchema.parse(req.body);
        const filter = (0, setup_1.getTenantFilter)(req.user);
        const material = await setup_1.prisma.material.update({
            where: { id, ...filter },
            data: {
                ...data,
                updatedAt: new Date(),
            },
            include: {
                category: true,
            },
        });
        setup_1.logger.info("Material updated", { userId: req.user?.id, materialId: id });
        res.status(200).json({
            message: "Material updated successfully",
            material,
        });
    }
    catch (error) {
        if (error instanceof zod_1.z.ZodError) {
            return res.status(400).json({ message: "Invalid input", errors: error.errors });
        }
        (0, setup_1.handleError)(res, error, "Failed to update material");
    }
};
exports.updateMaterial = updateMaterial;
const uploadMaterialImages = async (req, res) => {
    const { id } = req.params;
    try {
        if (!req.files || !Array.isArray(req.files) || req.files.length === 0) {
            return res.status(400).json({ message: "No files uploaded" });
        }
        const filter = (0, setup_1.getTenantFilter)(req.user);
        const material = await setup_1.prisma.material.findFirst({
            where: { id, ...filter },
        });
        if (!material) {
            return res.status(404).json({ message: "Material not found" });
        }
        // Upload images to Supabase
        const uploadPromises = req.files.map(async (file, index) => {
            const fileName = `material-${material.name.replace(/\s+/g, "-")}-${index + 1}-${Date.now()}-${file.originalname}`;
            const { data: imageData, error: uploadError } = await supabase_1.supabase.storage
                .from("materials")
                .upload(`/${req.user.schoolId}/${fileName}`, file.buffer, {
                cacheControl: "2592000",
                contentType: file.mimetype,
            });
            if (uploadError) {
                throw new Error(uploadError.message);
            }
            const { data: urlData } = supabase_1.supabase.storage.from("materials").getPublicUrl(imageData.path);
            return urlData.publicUrl;
        });
        const imageUrls = await Promise.all(uploadPromises);
        // Update material with image URLs
        const updatedMaterial = await setup_1.prisma.material.update({
            where: { id },
            data: {
                imageUrls: [...material.imageUrls, ...imageUrls],
                updatedAt: new Date(),
            },
        });
        setup_1.logger.info("Material images uploaded", {
            userId: req.user?.id,
            materialId: id,
            imageCount: imageUrls.length,
        });
        res.status(200).json({
            message: "Material images uploaded successfully",
            imageUrls,
            material: updatedMaterial,
        });
    }
    catch (error) {
        (0, setup_1.handleError)(res, error, "Failed to upload material images");
    }
};
exports.uploadMaterialImages = uploadMaterialImages;
// Cart Management
const getCart = async (req, res) => {
    try {
        const { parentId, schoolId } = req.params;
        const cart = await setup_1.prisma.materialCart.findUnique({
            where: {
                parentId_schoolId: {
                    parentId,
                    schoolId,
                },
            },
            include: {
                items: {
                    include: {
                        material: {
                            select: {
                                id: true,
                                name: true,
                                price: true,
                                imageUrls: true,
                                stockQuantity: true,
                                minOrderQty: true,
                                maxOrderQty: true,
                            },
                        },
                    },
                },
            },
        });
        if (!cart) {
            return res.json({
                success: true,
                data: {
                    items: [],
                    totalItems: 0,
                    totalAmount: 0,
                },
            });
        }
        const totalAmount = cart.items.reduce((sum, item) => {
            return sum + item.material.price.toNumber() * item.quantity;
        }, 0);
        res.json({
            success: true,
            data: {
                ...cart,
                totalItems: cart.items.length,
                totalAmount,
            },
        });
    }
    catch (error) {
        console.error("Error fetching cart:", error);
        res.status(500).json({
            success: false,
            message: "Failed to fetch cart",
        });
    }
};
exports.getCart = getCart;
const addToCart = async (req, res) => {
    try {
        const { parentId, schoolId } = req.params;
        const { materialId, quantity } = req.body;
        // Check if material exists and has sufficient stock
        const material = await setup_1.prisma.material.findUnique({
            where: { id: materialId },
        });
        if (!material || !material.isActive) {
            return res.status(404).json({
                success: false,
                message: "Material not found",
            });
        }
        if (material.stockQuantity < quantity) {
            return res.status(400).json({
                success: false,
                message: "Insufficient stock",
            });
        }
        // Get or create cart
        let cart = await setup_1.prisma.materialCart.findUnique({
            where: {
                parentId_schoolId: {
                    parentId,
                    schoolId,
                },
            },
        });
        if (!cart) {
            cart = await setup_1.prisma.materialCart.create({
                data: {
                    parentId,
                    schoolId,
                },
            });
        }
        // Check if item already exists in cart
        const existingItem = await setup_1.prisma.materialCartItem.findUnique({
            where: {
                cartId_materialId: {
                    cartId: cart.id,
                    materialId,
                },
            },
        });
        if (existingItem) {
            // Update quantity
            await setup_1.prisma.materialCartItem.update({
                where: { id: existingItem.id },
                data: { quantity: existingItem.quantity + quantity },
            });
        }
        else {
            // Create new cart item
            await setup_1.prisma.materialCartItem.create({
                data: {
                    cartId: cart.id,
                    materialId,
                    quantity,
                },
            });
        }
        res.json({
            success: true,
            message: "Item added to cart successfully",
        });
    }
    catch (error) {
        console.error("Error adding to cart:", error);
        res.status(500).json({
            success: false,
            message: "Failed to add item to cart",
        });
    }
};
exports.addToCart = addToCart;
const removeFromCart = async (req, res) => {
    try {
        const { cartItemId } = req.params;
        await setup_1.prisma.materialCartItem.delete({
            where: { id: cartItemId },
        });
        res.json({
            success: true,
            message: "Item removed from cart successfully",
        });
    }
    catch (error) {
        console.error("Error removing from cart:", error);
        res.status(500).json({
            success: false,
            message: "Failed to remove item from cart",
        });
    }
};
exports.removeFromCart = removeFromCart;
const clearCart = async (req, res) => {
    try {
        const { parentId, schoolId } = req.params;
        const cart = await setup_1.prisma.materialCart.findUnique({
            where: {
                parentId_schoolId: {
                    parentId,
                    schoolId,
                },
            },
        });
        if (cart) {
            await setup_1.prisma.materialCartItem.deleteMany({
                where: { cartId: cart.id },
            });
        }
        res.json({
            success: true,
            message: "Cart cleared successfully",
        });
    }
    catch (error) {
        console.error("Error clearing cart:", error);
        res.status(500).json({
            success: false,
            message: "Failed to clear cart",
        });
    }
};
exports.clearCart = clearCart;
// Get all material categories for a school
const getMaterialCategories = async (req, res) => {
    try {
        const { schoolId } = req.params;
        const categories = await setup_1.prisma.materialCategory.findMany({
            where: {
                schoolId,
                isActive: true,
            },
            include: {
                materials: {
                    where: { isActive: true },
                    select: {
                        id: true,
                        name: true,
                        price: true,
                        stockQuantity: true,
                    },
                },
            },
            orderBy: { name: "asc" },
        });
        res.json({
            success: true,
            data: categories,
        });
    }
    catch (error) {
        console.error("Error fetching material categories:", error);
        res.status(500).json({
            success: false,
            message: "Failed to fetch material categories",
        });
    }
};
exports.getMaterialCategories = getMaterialCategories;
// Create material category
const createMaterialCategory = async (req, res) => {
    try {
        const { schoolId } = req.params;
        const { name, description, imageUrl } = req.body;
        const category = await setup_1.prisma.materialCategory.create({
            data: {
                name,
                description,
                imageUrl,
                schoolId,
            },
        });
        res.status(201).json({
            success: true,
            data: category,
            message: "Material category created successfully",
        });
    }
    catch (error) {
        console.error("Error creating material category:", error);
        res.status(500).json({
            success: false,
            message: "Failed to create material category",
        });
    }
};
exports.createMaterialCategory = createMaterialCategory;
// Get materials by category
const getMaterialsByCategory = async (req, res) => {
    try {
        const { categoryId } = req.params;
        const { page = 1, limit = 20, search } = req.query;
        const skip = (Number(page) - 1) * Number(limit);
        const where = {
            categoryId,
            isActive: true,
        };
        if (search) {
            where.OR = [
                { name: { contains: search, mode: "insensitive" } },
                { description: { contains: search, mode: "insensitive" } },
                { brand: { contains: search, mode: "insensitive" } },
            ];
        }
        const [materials, total] = await Promise.all([
            setup_1.prisma.material.findMany({
                where,
                include: {
                    category: {
                        select: { name: true },
                    },
                },
                skip,
                take: Number(limit),
                orderBy: { name: "asc" },
            }),
            setup_1.prisma.material.count({ where }),
        ]);
        res.json({
            success: true,
            data: {
                materials,
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
        console.error("Error fetching materials:", error);
        res.status(500).json({
            success: false,
            message: "Failed to fetch materials",
        });
    }
};
exports.getMaterialsByCategory = getMaterialsByCategory;
// Get single material
const getMaterial = async (req, res) => {
    try {
        const { materialId } = req.params;
        const material = await setup_1.prisma.material.findUnique({
            where: { id: materialId },
            include: {
                category: {
                    select: { name: true },
                },
                school: {
                    select: { name: true, logoUrl: true },
                },
            },
        });
        if (!material) {
            return res.status(404).json({
                success: false,
                message: "Material not found",
            });
        }
        res.json({
            success: true,
            data: material,
        });
    }
    catch (error) {
        console.error("Error fetching material:", error);
        res.status(500).json({
            success: false,
            message: "Failed to fetch material",
        });
    }
};
exports.getMaterial = getMaterial;
// Delete material
const deleteMaterial = async (req, res) => {
    try {
        const { id } = req.params;
        await setup_1.prisma.material.update({
            where: { id },
            data: { isActive: false },
        });
        res.json({
            success: true,
            message: "Material deleted successfully",
        });
    }
    catch (error) {
        console.error("Error deleting material:", error);
        res.status(500).json({
            success: false,
            message: "Failed to delete material",
        });
    }
};
exports.deleteMaterial = deleteMaterial;
// Update cart item quantity
const updateCartItem = async (req, res) => {
    try {
        const { id } = req.params;
        const { quantity } = req.body;
        if (quantity <= 0) {
            // Remove item if quantity is 0 or negative
            await setup_1.prisma.materialCartItem.delete({
                where: { id },
            });
        }
        else {
            // Update quantity
            await setup_1.prisma.materialCartItem.update({
                where: { id },
                data: { quantity },
            });
        }
        res.json({
            success: true,
            message: "Cart updated successfully",
        });
    }
    catch (error) {
        console.error("Error updating cart item:", error);
        res.status(500).json({
            success: false,
            message: "Failed to update cart item",
        });
    }
};
exports.updateCartItem = updateCartItem;
