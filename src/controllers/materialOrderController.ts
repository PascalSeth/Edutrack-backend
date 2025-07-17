import type { Request, Response } from "express"
import { PrismaClient } from "@prisma/client"
import { initializePayment, verifyPayment, initiateTransfer } from "../utils/paystack"
import { generateReceiptPDF } from "../utils/receiptGenerator"

const prisma = new PrismaClient()

// Create order from cart
export const createOrderFromCart = async (req: Request, res: Response) => {
  try {
    const { parentId, schoolId } = req.params
    const { deliveryMethod, deliveryAddress, deliveryNotes } = req.body

    // Get cart with items
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
            material: true,
          },
        },
      },
    })

    if (!cart || cart.items.length === 0) {
      return res.status(400).json({
        success: false,
        message: "Cart is empty",
      })
    }

    // Calculate totals
    const subtotal = cart.items.reduce((sum, item) => {
      return sum + item.material.price.toNumber() * item.quantity
    }, 0)

    const processingFee = subtotal * 0.029 // 2.9%
    const paystackFee = (subtotal + processingFee) * 0.015 // Approximate Paystack fee
    const totalAmount = subtotal + processingFee
    const schoolAmount = subtotal

    // Generate order number
    const orderNumber = `ORD-${Date.now()}-${Math.random().toString(36).substr(2, 9).toUpperCase()}`

    // Create order
    const order = await prisma.materialOrder.create({
      data: {
        orderNumber,
        parentId,
        schoolId,
        subtotal,
        processingFee,
        paystackFee,
        totalAmount,
        schoolAmount,
        deliveryMethod: deliveryMethod || "SCHOOL_PICKUP",
        deliveryAddress,
        deliveryNotes,
        items: {
          create: cart.items.map((item) => ({
            materialId: item.materialId,
            quantity: item.quantity,
            unitPrice: item.material.price,
            totalPrice: item.material.price.toNumber() * item.quantity,
            materialName: item.material.name,
            materialImage: item.material.imageUrls[0] || null,
          })),
        },
      },
      include: {
        items: {
          include: {
            material: true,
          },
        },
        parent: {
          include: {
            user: true,
          },
        },
        school: true,
      },
    })

    // Clear cart after creating order
    await prisma.materialCartItem.deleteMany({
      where: { cartId: cart.id },
    })

    res.status(201).json({
      success: true,
      data: order,
      message: "Order created successfully",
    })
  } catch (error) {
    console.error("Error creating order:", error)
    res.status(500).json({
      success: false,
      message: "Failed to create order",
    })
  }
}

// Initialize payment for order
export const initializeOrderPayment = async (req: Request, res: Response) => {
  try {
    const { orderId } = req.params

    const order = await prisma.materialOrder.findUnique({
      where: { id: orderId },
      include: {
        parent: {
          include: {
            user: true,
          },
        },
        school: true,
      },
    })

    if (!order) {
      return res.status(404).json({
        success: false,
        message: "Order not found",
      })
    }

    if (order.status !== "PENDING") {
      return res.status(400).json({
        success: false,
        message: "Order cannot be paid for",
      })
    }

    // Initialize Paystack payment
    const paymentData = await initializePayment({
      email: order.parent.user.email,
      amount: Math.round(order.totalAmount.toNumber() * 100), // Convert to kobo
      reference: `${order.orderNumber}-${Date.now()}`,
      metadata: {
        orderId: order.id,
        parentId: order.parentId,
        schoolId: order.schoolId,
        orderNumber: order.orderNumber,
      },
    })

    // Create payment record
    await prisma.materialPayment.create({
      data: {
        orderId: order.id,
        amount: order.totalAmount,
        processingFee: order.processingFee,
        paystackFee: order.paystackFee,
        schoolAmount: order.schoolAmount,
        paystackRef: paymentData.reference,
      },
    })

    res.json({
      success: true,
      data: {
        authorization_url: paymentData.authorization_url,
        access_code: paymentData.access_code,
        reference: paymentData.reference,
      },
    })
  } catch (error) {
    console.error("Error initializing payment:", error)
    res.status(500).json({
      success: false,
      message: "Failed to initialize payment",
    })
  }
}

// Verify payment and process order
export const verifyOrderPayment = async (req: Request, res: Response) => {
  try {
    const { reference } = req.params

    // Verify payment with Paystack
    const paymentVerification = await verifyPayment(reference)

    if (!paymentVerification.status) {
      return res.status(400).json({
        success: false,
        message: "Payment verification failed",
      })
    }

    // Update payment record
    const payment = await prisma.materialPayment.update({
      where: { paystackRef: reference },
      data: {
        status: "COMPLETED",
        paystackTxnId: paymentVerification.data.id.toString(),
        authorizationCode: paymentVerification.data.authorization?.authorization_code,
        paidAt: new Date(),
        webhookData: paymentVerification.data,
      },
      include: {
        order: {
          include: {
            parent: {
              include: {
                user: true,
              },
            },
            school: {
              include: {
                paymentAccount: true,
              },
            },
            items: {
              include: {
                material: true,
              },
            },
          },
        },
      },
    })

    // Update order status
    await prisma.materialOrder.update({
      where: { id: payment.orderId },
      data: {
        status: "CONFIRMED",
        confirmedAt: new Date(),
      },
    })

    // Update material stock quantities
    for (const item of payment.order.items) {
      await prisma.material.update({
        where: { id: item.materialId },
        data: {
          stockQuantity: {
            decrement: item.quantity,
          },
        },
      })
    }

    // Transfer money to school if payment account exists
    if (payment.order.school.paymentAccount?.paystackRecipientCode) {
      try {
        const transferResult = await initiateTransfer({
          amount: Math.round(payment.schoolAmount.toNumber() * 100), // Convert to kobo
          recipient: payment.order.school.paymentAccount.paystackRecipientCode,
          reason: `Payment for order ${payment.order.orderNumber}`,
          reference: `TXF-${payment.order.orderNumber}-${Date.now()}`,
        })

        await prisma.materialPayment.update({
          where: { id: payment.id },
          data: {
            schoolTransferCode: transferResult.transfer_code,
            schoolTransferRef: transferResult.reference,
            schoolTransferStatus: "pending",
          },
        })
      } catch (transferError) {
        console.error("Error transferring to school:", transferError)
        // Continue processing even if transfer fails - can be retried later
      }
    }

    // Generate receipt
    const receiptNumber = `RCP-${payment.order.orderNumber}-${Date.now()}`
    const receiptUrl = await generateReceiptPDF({
      receiptNumber,
      order: payment.order,
      payment,
    })

    await prisma.materialPayment.update({
      where: { id: payment.id },
      data: {
        receiptNumber,
        receiptUrl,
      },
    })

    res.json({
      success: true,
      data: {
        order: payment.order,
        payment,
        receiptUrl,
      },
      message: "Payment verified and order confirmed",
    })
  } catch (error) {
    console.error("Error verifying payment:", error)
    res.status(500).json({
      success: false,
      message: "Failed to verify payment",
    })
  }
}

// Get parent's orders
export const getParentOrders = async (req: Request, res: Response) => {
  try {
    const { parentId } = req.params
    const { page = 1, limit = 10, status, schoolId } = req.query

    const skip = (Number(page) - 1) * Number(limit)

    const where: any = { parentId }
    if (status) where.status = status
    if (schoolId) where.schoolId = schoolId

    const [orders, total] = await Promise.all([
      prisma.materialOrder.findMany({
        where,
        include: {
          school: {
            select: { name: true, logoUrl: true },
          },
          items: {
            include: {
              material: {
                select: { name: true, imageUrls: true },
              },
            },
          },
          payment: {
            select: { status: true, receiptUrl: true, receiptNumber: true },
          },
        },
        skip,
        take: Number(limit),
        orderBy: { createdAt: "desc" },
      }),
      prisma.materialOrder.count({ where }),
    ])

    res.json({
      success: true,
      data: {
        orders,
        pagination: {
          page: Number(page),
          limit: Number(limit),
          total,
          pages: Math.ceil(total / Number(limit)),
        },
      },
    })
  } catch (error) {
    console.error("Error fetching parent orders:", error)
    res.status(500).json({
      success: false,
      message: "Failed to fetch orders",
    })
  }
}

// Get school's orders
export const getSchoolOrders = async (req: Request, res: Response) => {
  try {
    const { schoolId } = req.params
    const { page = 1, limit = 10, status, startDate, endDate } = req.query

    const skip = (Number(page) - 1) * Number(limit)

    const where: any = { schoolId }
    if (status) where.status = status
    if (startDate || endDate) {
      where.createdAt = {}
      if (startDate) where.createdAt.gte = new Date(startDate as string)
      if (endDate) where.createdAt.lte = new Date(endDate as string)
    }

    const [orders, total] = await Promise.all([
      prisma.materialOrder.findMany({
        where,
        include: {
          parent: {
            include: {
              user: {
                select: { name: true, surname: true, email: true, phone: true },
              },
            },
          },
          items: {
            include: {
              material: {
                select: { name: true, imageUrls: true },
              },
            },
          },
          payment: {
            select: { status: true, receiptUrl: true, receiptNumber: true, paidAt: true },
          },
        },
        skip,
        take: Number(limit),
        orderBy: { createdAt: "desc" },
      }),
      prisma.materialOrder.count({ where }),
    ])

    res.json({
      success: true,
      data: {
        orders,
        pagination: {
          page: Number(page),
          limit: Number(limit),
          total,
          pages: Math.ceil(total / Number(limit)),
        },
      },
    })
  } catch (error) {
    console.error("Error fetching school orders:", error)
    res.status(500).json({
      success: false,
      message: "Failed to fetch orders",
    })
  }
}

// Update order status
export const updateOrderStatus = async (req: Request, res: Response) => {
  try {
    const { orderId } = req.params
    const { status, adminNotes } = req.body

    const updateData: any = { status }
    if (adminNotes) updateData.adminNotes = adminNotes

    // Set timestamp based on status
    switch (status) {
      case "PREPARING":
        updateData.preparedAt = new Date()
        break
      case "READY_FOR_PICKUP":
      case "OUT_FOR_DELIVERY":
        updateData.preparedAt = updateData.preparedAt || new Date()
        break
      case "DELIVERED":
        updateData.deliveredAt = new Date()
        break
      case "CANCELLED":
        updateData.cancelledAt = new Date()
        break
    }

    const order = await prisma.materialOrder.update({
      where: { id: orderId },
      data: updateData,
      include: {
        parent: {
          include: {
            user: true,
          },
        },
        school: true,
      },
    })

    // Send notification to parent
    await prisma.notification.create({
      data: {
        title: "Order Status Update",
        content: `Your order ${order.orderNumber} status has been updated to ${status}`,
        type: "GENERAL",
        userId: order.parent.user.id,
      },
    })

    res.json({
      success: true,
      data: order,
      message: "Order status updated successfully",
    })
  } catch (error) {
    console.error("Error updating order status:", error)
    res.status(500).json({
      success: false,
      message: "Failed to update order status",
    })
  }
}

// Get single order details
export const getOrderDetails = async (req: Request, res: Response) => {
  try {
    const { orderId } = req.params

    const order = await prisma.materialOrder.findUnique({
      where: { id: orderId },
      include: {
        parent: {
          include: {
            user: {
              select: { name: true, surname: true, email: true, phone: true },
            },
          },
        },
        school: {
          select: { name: true, logoUrl: true, address: true, phone: true },
        },
        items: {
          include: {
            material: {
              select: { name: true, imageUrls: true, brand: true, model: true },
            },
          },
        },
        payment: true,
      },
    })

    if (!order) {
      return res.status(404).json({
        success: false,
        message: "Order not found",
      })
    }

    res.json({
      success: true,
      data: order,
    })
  } catch (error) {
    console.error("Error fetching order details:", error)
    res.status(500).json({
      success: false,
      message: "Failed to fetch order details",
    })
  }
}

// Cancel order
export const cancelOrder = async (req: Request, res: Response) => {
  try {
    const { orderId } = req.params
    const { reason } = req.body

    const order = await prisma.materialOrder.findUnique({
      where: { id: orderId },
      include: {
        items: true,
        payment: true,
      },
    })

    if (!order) {
      return res.status(404).json({
        success: false,
        message: "Order not found",
      })
    }

    if (!["PENDING", "CONFIRMED"].includes(order.status)) {
      return res.status(400).json({
        success: false,
        message: "Order cannot be cancelled at this stage",
      })
    }

    // Update order status
    await prisma.materialOrder.update({
      where: { id: orderId },
      data: {
        status: "CANCELLED",
        cancelledAt: new Date(),
        adminNotes: reason,
      },
    })

    // Restore stock quantities if order was confirmed
    if (order.status === "CONFIRMED") {
      for (const item of order.items) {
        await prisma.material.update({
          where: { id: item.materialId },
          data: {
            stockQuantity: {
              increment: item.quantity,
            },
          },
        })
      }
    }

    // Handle refund if payment was made
    if (order.payment && order.payment.status === "COMPLETED") {
      await prisma.materialPayment.update({
        where: { id: order.payment.id },
        data: {
          status: "REFUNDED",
        },
      })
      // Note: Actual refund processing would be handled separately
    }

    res.json({
      success: true,
      message: "Order cancelled successfully",
    })
  } catch (error) {
    console.error("Error cancelling order:", error)
    res.status(500).json({
      success: false,
      message: "Failed to cancel order",
    })
  }
}
