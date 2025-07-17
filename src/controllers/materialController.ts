import type { Response, Request } from "express"
import { z } from "zod"
import { prisma, type AuthRequest, handleError, logger, getTenantFilter } from "../utils/setup"
import { supabase } from "../config/supabase"
import type { Express } from "express"

// Validation Schemas
const createCategorySchema = z.object({
  name: z.string().min(1, "Category name is required"),
  description: z.string().optional(),
  imageUrl: z.string().optional(),
})

const createMaterialSchema = z.object({
  name: z.string().min(1, "Material name is required"),
  description: z.string().optional(),
  price: z.number().positive("Price must be positive"),
  stockQuantity: z.number().int().min(0, "Stock quantity cannot be negative"),
  minOrderQty: z.number().int().min(1, "Minimum order quantity must be at least 1").default(1),
  maxOrderQty: z.number().int().positive().optional(),
  categoryId: z.string().uuid("Invalid category ID"),
  brand: z.string().optional(),
  model: z.string().optional(),
  specifications: z.record(z.any()).optional(),
})

const updateMaterialSchema = createMaterialSchema.partial()

const addToCartSchema = z.object({
  materialId: z.string().uuid("Invalid material ID"),
  quantity: z.number().int().min(1, "Quantity must be at least 1"),
})

// Categories
export const getCategories = async (req: AuthRequest, res: Response) => {
  try {
    const schoolId = (req.query.schoolId as string) || req.user?.schoolId

    if (!schoolId) {
      return res.status(400).json({ message: "School ID is required" })
    }

    const categories = await prisma.materialCategory.findMany({
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
    })

    res.status(200).json({
      message: "Categories retrieved successfully",
      categories,
    })
  } catch (error) {
    handleError(res, error, "Failed to retrieve categories")
  }
}

export const createCategory = async (req: AuthRequest, res: Response) => {
  try {
    if (!["PRINCIPAL", "SCHOOL_ADMIN", "SUPER_ADMIN"].includes(req.user?.role || "")) {
      return res.status(403).json({ message: "Access denied" })
    }

    const data = createCategorySchema.parse(req.body)
    const schoolId = req.user?.schoolId!

    const category = await prisma.materialCategory.create({
      data: {
        name: data.name,
        description: data.description,
        imageUrl: data.imageUrl,
        schoolId,
      },
    })

    logger.info("Material category created", {
      userId: req.user?.id,
      categoryId: category.id,
      schoolId,
    })

    res.status(201).json({
      message: "Category created successfully",
      category,
    })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ message: "Invalid input", errors: error.errors })
    }
    handleError(res, error, "Failed to create category")
  }
}

// Materials
export const getMaterials = async (req: AuthRequest, res: Response) => {
  try {
    const page = Number.parseInt(req.query.page as string) || 1
    const limit = Number.parseInt(req.query.limit as string) || 20
    const skip = (page - 1) * limit

    const schoolId = (req.query.schoolId as string) || req.user?.schoolId
    const categoryId = req.query.categoryId as string
    const search = req.query.search as string

    if (!schoolId) {
      return res.status(400).json({ message: "School ID is required" })
    }

    const where: any = {
      schoolId,
      isActive: true,
      stockQuantity: { gt: 0 }, // Only show materials in stock
    }

    if (categoryId) {
      where.categoryId = categoryId
    }

    if (search) {
      where.OR = [
        { name: { contains: search, mode: "insensitive" } },
        { description: { contains: search, mode: "insensitive" } },
        { brand: { contains: search, mode: "insensitive" } },
      ]
    }

    const [materials, total] = await Promise.all([
      prisma.material.findMany({
        where,
        skip,
        take: limit,
        include: {
          category: { select: { name: true } },
          school: { select: { name: true } },
        },
        orderBy: { name: "asc" },
      }),
      prisma.material.count({ where }),
    ])

    res.status(200).json({
      message: "Materials retrieved successfully",
      materials,
      pagination: { page, limit, total, pages: Math.ceil(total / limit) },
    })
  } catch (error) {
    handleError(res, error, "Failed to retrieve materials")
  }
}

export const getMaterialById = async (req: AuthRequest, res: Response) => {
  const { id } = req.params
  try {
    const material = await prisma.material.findUnique({
      where: { id },
      include: {
        category: true,
        school: { select: { name: true, logoUrl: true } },
      },
    })

    if (!material) {
      return res.status(404).json({ message: "Material not found" })
    }

    res.status(200).json({
      message: "Material retrieved successfully",
      material,
    })
  } catch (error) {
    handleError(res, error, "Failed to retrieve material")
  }
}

export const createMaterial = async (req: AuthRequest, res: Response) => {
  try {
    if (!["PRINCIPAL", "SCHOOL_ADMIN", "SUPER_ADMIN"].includes(req.user?.role || "")) {
      return res.status(403).json({ message: "Access denied" })
    }

    const data = createMaterialSchema.parse(req.body)
    const schoolId = req.user?.schoolId!

    // Verify category exists and belongs to school
    const category = await prisma.materialCategory.findFirst({
      where: { id: data.categoryId, schoolId },
    })

    if (!category) {
      return res.status(404).json({ message: "Category not found" })
    }

    const material = await prisma.material.create({
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
    })

    logger.info("Material created", {
      userId: req.user?.id,
      materialId: material.id,
      schoolId,
    })

    res.status(201).json({
      message: "Material created successfully",
      material,
    })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ message: "Invalid input", errors: error.errors })
    }
    handleError(res, error, "Failed to create material")
  }
}

export const updateMaterial = async (req: AuthRequest, res: Response) => {
  const { id } = req.params
  try {
    if (!["PRINCIPAL", "SCHOOL_ADMIN", "SUPER_ADMIN"].includes(req.user?.role || "")) {
      return res.status(403).json({ message: "Access denied" })
    }

    const data = updateMaterialSchema.parse(req.body)
    const filter = getTenantFilter(req.user)

    const material = await prisma.material.update({
      where: { id, ...filter },
      data: {
        ...data,
        updatedAt: new Date(),
      },
      include: {
        category: true,
      },
    })

    logger.info("Material updated", { userId: req.user?.id, materialId: id })
    res.status(200).json({
      message: "Material updated successfully",
      material,
    })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ message: "Invalid input", errors: error.errors })
    }
    handleError(res, error, "Failed to update material")
  }
}

export const uploadMaterialImages = async (req: AuthRequest, res: Response) => {
  const { id } = req.params
  try {
    if (!req.files || !Array.isArray(req.files) || req.files.length === 0) {
      return res.status(400).json({ message: "No files uploaded" })
    }

    const filter = getTenantFilter(req.user)
    const material = await prisma.material.findFirst({
      where: { id, ...filter },
    })

    if (!material) {
      return res.status(404).json({ message: "Material not found" })
    }

    // Upload images to Supabase
    const uploadPromises = req.files.map(async (file: Express.Multer.File, index: number) => {
      const fileName = `material-${material.name.replace(/\s+/g, "-")}-${index + 1}-${Date.now()}-${file.originalname}`

      const { data: imageData, error: uploadError } = await supabase.storage
        .from("materials")
        .upload(`/${req.user!.schoolId}/${fileName}`, file.buffer, {
          cacheControl: "2592000",
          contentType: file.mimetype,
        })

      if (uploadError) {
        throw new Error(uploadError.message)
      }

      const { data: urlData } = supabase.storage.from("materials").getPublicUrl(imageData.path)
      return urlData.publicUrl
    })

    const imageUrls = await Promise.all(uploadPromises)

    // Update material with image URLs
    const updatedMaterial = await prisma.material.update({
      where: { id },
      data: {
        imageUrls: [...material.imageUrls, ...imageUrls],
        updatedAt: new Date(),
      },
    })

    logger.info("Material images uploaded", {
      userId: req.user?.id,
      materialId: id,
      imageCount: imageUrls.length,
    })

    res.status(200).json({
      message: "Material images uploaded successfully",
      imageUrls,
      material: updatedMaterial,
    })
  } catch (error) {
    handleError(res, error, "Failed to upload material images")
  }
}

// Cart Management
export const getCart = async (req: AuthRequest, res: Response) => {
  try {
    const { parentId, schoolId } = req.params

    const cart = await prisma.materialCart.findUnique({
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
    })

    if (!cart) {
      return res.json({
        success: true,
        data: {
          items: [],
          totalItems: 0,
          totalAmount: 0,
        },
      })
    }

    const totalAmount = cart.items.reduce((sum, item) => {
      return sum + item.material.price.toNumber() * item.quantity
    }, 0)

    res.json({
      success: true,
      data: {
        ...cart,
        totalItems: cart.items.length,
        totalAmount,
      },
    })
  } catch (error) {
    console.error("Error fetching cart:", error)
    res.status(500).json({
      success: false,
      message: "Failed to fetch cart",
    })
  }
}

export const addToCart = async (req: AuthRequest, res: Response) => {
  try {
    const { parentId, schoolId } = req.params
    const { materialId, quantity } = req.body

    // Check if material exists and has sufficient stock
    const material = await prisma.material.findUnique({
      where: { id: materialId },
    })

    if (!material || !material.isActive) {
      return res.status(404).json({
        success: false,
        message: "Material not found",
      })
    }

    if (material.stockQuantity < quantity) {
      return res.status(400).json({
        success: false,
        message: "Insufficient stock",
      })
    }

    // Get or create cart
    let cart = await prisma.materialCart.findUnique({
      where: {
        parentId_schoolId: {
          parentId,
          schoolId,
        },
      },
    })

    if (!cart) {
      cart = await prisma.materialCart.create({
        data: {
          parentId,
          schoolId,
        },
      })
    }

    // Check if item already exists in cart
    const existingItem = await prisma.materialCartItem.findUnique({
      where: {
        cartId_materialId: {
          cartId: cart.id,
          materialId,
        },
      },
    })

    if (existingItem) {
      // Update quantity
      await prisma.materialCartItem.update({
        where: { id: existingItem.id },
        data: { quantity: existingItem.quantity + quantity },
      })
    } else {
      // Create new cart item
      await prisma.materialCartItem.create({
        data: {
          cartId: cart.id,
          materialId,
          quantity,
        },
      })
    }

    res.json({
      success: true,
      message: "Item added to cart successfully",
    })
  } catch (error) {
    console.error("Error adding to cart:", error)
    res.status(500).json({
      success: false,
      message: "Failed to add item to cart",
    })
  }
}

export const removeFromCart = async (req: AuthRequest, res: Response) => {
  try {
    const { cartItemId } = req.params

    await prisma.materialCartItem.delete({
      where: { id: cartItemId },
    })

    res.json({
      success: true,
      message: "Item removed from cart successfully",
    })
  } catch (error) {
    console.error("Error removing from cart:", error)
    res.status(500).json({
      success: false,
      message: "Failed to remove item from cart",
    })
  }
}

export const clearCart = async (req: AuthRequest, res: Response) => {
  try {
    const { parentId, schoolId } = req.params

    const cart = await prisma.materialCart.findUnique({
      where: {
        parentId_schoolId: {
          parentId,
          schoolId,
        },
      },
    })

    if (cart) {
      await prisma.materialCartItem.deleteMany({
        where: { cartId: cart.id },
      })
    }

    res.json({
      success: true,
      message: "Cart cleared successfully",
    })
  } catch (error) {
    console.error("Error clearing cart:", error)
    res.status(500).json({
      success: false,
      message: "Failed to clear cart",
    })
  }
}

// Get all material categories for a school
export const getMaterialCategories = async (req: Request, res: Response) => {
  try {
    const { schoolId } = req.params

    const categories = await prisma.materialCategory.findMany({
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
    })

    res.json({
      success: true,
      data: categories,
    })
  } catch (error) {
    console.error("Error fetching material categories:", error)
    res.status(500).json({
      success: false,
      message: "Failed to fetch material categories",
    })
  }
}

// Create material category
export const createMaterialCategory = async (req: Request, res: Response) => {
  try {
    const { schoolId } = req.params
    const { name, description, imageUrl } = req.body

    const category = await prisma.materialCategory.create({
      data: {
        name,
        description,
        imageUrl,
        schoolId,
      },
    })

    res.status(201).json({
      success: true,
      data: category,
      message: "Material category created successfully",
    })
  } catch (error) {
    console.error("Error creating material category:", error)
    res.status(500).json({
      success: false,
      message: "Failed to create material category",
    })
  }
}

// Get materials by category
export const getMaterialsByCategory = async (req: Request, res: Response) => {
  try {
    const { categoryId } = req.params
    const { page = 1, limit = 20, search } = req.query

    const skip = (Number(page) - 1) * Number(limit)

    const where: any = {
      categoryId,
      isActive: true,
    }

    if (search) {
      where.OR = [
        { name: { contains: search as string, mode: "insensitive" } },
        { description: { contains: search as string, mode: "insensitive" } },
        { brand: { contains: search as string, mode: "insensitive" } },
      ]
    }

    const [materials, total] = await Promise.all([
      prisma.material.findMany({
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
      prisma.material.count({ where }),
    ])

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
    })
  } catch (error) {
    console.error("Error fetching materials:", error)
    res.status(500).json({
      success: false,
      message: "Failed to fetch materials",
    })
  }
}

// Get single material
export const getMaterial = async (req: Request, res: Response) => {
  try {
    const { materialId } = req.params

    const material = await prisma.material.findUnique({
      where: { id: materialId },
      include: {
        category: {
          select: { name: true },
        },
        school: {
          select: { name: true, logoUrl: true },
        },
      },
    })

    if (!material) {
      return res.status(404).json({
        success: false,
        message: "Material not found",
      })
    }

    res.json({
      success: true,
      data: material,
    })
  } catch (error) {
    console.error("Error fetching material:", error)
    res.status(500).json({
      success: false,
      message: "Failed to fetch material",
    })
  }
}

// Delete material
export const deleteMaterial = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params

    await prisma.material.update({
      where: { id },
      data: { isActive: false },
    })

    res.json({
      success: true,
      message: "Material deleted successfully",
    })
  } catch (error) {
    console.error("Error deleting material:", error)
    res.status(500).json({
      success: false,
      message: "Failed to delete material",
    })
  }
}

// Update cart item quantity
export const updateCartItem = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params
    const { quantity } = req.body

    if (quantity <= 0) {
      // Remove item if quantity is 0 or negative
      await prisma.materialCartItem.delete({
        where: { id },
      })
    } else {
      // Update quantity
      await prisma.materialCartItem.update({
        where: { id },
        data: { quantity },
      })
    }

    res.json({
      success: true,
      message: "Cart updated successfully",
    })
  } catch (error) {
    console.error("Error updating cart item:", error)
    res.status(500).json({
      success: false,
      message: "Failed to update cart item",
    })
  }
}
