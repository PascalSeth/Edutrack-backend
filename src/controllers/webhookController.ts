import type { Request, Response } from "express"
import { PrismaClient } from "@prisma/client"
import crypto from "crypto"

const prisma = new PrismaClient()

// Paystack webhook handler
export const handlePaystackWebhook = async (req: Request, res: Response) => {
  try {
    const hash = crypto
      .createHmac("sha512", process.env.PAYSTACK_SECRET_KEY!)
      .update(JSON.stringify(req.body))
      .digest("hex")

    if (hash !== req.headers["x-paystack-signature"]) {
      return res.status(400).json({
        success: false,
        message: "Invalid signature",
      })
    }

    const event = req.body

    switch (event.event) {
      case "charge.success":
        await handleChargeSuccess(event.data)
        break
      case "transfer.success":
        await handleTransferSuccess(event.data)
        break
      case "transfer.failed":
        await handleTransferFailed(event.data)
        break
      case "transfer.reversed":
        await handleTransferReversed(event.data)
        break
      default:
        console.log(`Unhandled webhook event: ${event.event}`)
    }

    res.status(200).json({ success: true })
  } catch (error) {
    console.error("Webhook processing error:", error)
    res.status(500).json({
      success: false,
      message: "Webhook processing failed",
    })
  }
}

// Handle successful charge
const handleChargeSuccess = async (data: any) => {
  try {
    const payment = await prisma.materialPayment.findUnique({
      where: { paystackRef: data.reference },
      include: {
        order: {
          include: {
            parent: {
              include: {
                user: true,
              },
            },
            school: true,
          },
        },
      },
    })

    if (!payment) {
      console.log(`Payment not found for reference: ${data.reference}`)
      return
    }

    if (payment.status === "COMPLETED") {
      console.log(`Payment already processed: ${data.reference}`)
      return
    }

    // Update payment status
    await prisma.materialPayment.update({
      where: { id: payment.id },
      data: {
        status: "COMPLETED",
        paystackTxnId: data.id.toString(),
        authorizationCode: data.authorization?.authorization_code,
        paidAt: new Date(),
        webhookData: data,
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

    // Send notification to parent
    await prisma.notification.create({
      data: {
        title: "Payment Successful",
        content: `Your payment for order ${payment.order.orderNumber} has been confirmed.`,
        type: "PAYMENT",
        userId: payment.order.parent.user.id,
      },
    })

    console.log(`Payment processed successfully: ${data.reference}`)
  } catch (error) {
    console.error("Error handling charge success:", error)
  }
}

// Handle successful transfer
const handleTransferSuccess = async (data: any) => {
  try {
    const payment = await prisma.materialPayment.findFirst({
      where: { schoolTransferCode: data.transfer_code },
      include: {
        order: {
          include: {
            school: true,
          },
        },
      },
    })

    if (!payment) {
      console.log(`Payment not found for transfer code: ${data.transfer_code}`)
      return
    }

    // Update transfer status
    await prisma.materialPayment.update({
      where: { id: payment.id },
      data: {
        schoolTransferStatus: "success",
        schoolTransferredAt: new Date(),
      },
    })

    console.log(`Transfer successful: ${data.transfer_code}`)
  } catch (error) {
    console.error("Error handling transfer success:", error)
  }
}

// Handle failed transfer
const handleTransferFailed = async (data: any) => {
  try {
    const payment = await prisma.materialPayment.findFirst({
      where: { schoolTransferCode: data.transfer_code },
    })

    if (!payment) {
      console.log(`Payment not found for transfer code: ${data.transfer_code}`)
      return
    }

    // Update transfer status
    await prisma.materialPayment.update({
      where: { id: payment.id },
      data: {
        schoolTransferStatus: "failed",
      },
    })

    console.log(`Transfer failed: ${data.transfer_code}`)
  } catch (error) {
    console.error("Error handling transfer failure:", error)
  }
}

// Handle reversed transfer
const handleTransferReversed = async (data: any) => {
  try {
    const payment = await prisma.materialPayment.findFirst({
      where: { schoolTransferCode: data.transfer_code },
    })

    if (!payment) {
      console.log(`Payment not found for transfer code: ${data.transfer_code}`)
      return
    }

    // Update transfer status
    await prisma.materialPayment.update({
      where: { id: payment.id },
      data: {
        schoolTransferStatus: "reversed",
      },
    })

    console.log(`Transfer reversed: ${data.transfer_code}`)
  } catch (error) {
    console.error("Error handling transfer reversal:", error)
  }
}

// Manual transfer retry (for failed transfers)
export const retryTransfer = async (req: Request, res: Response) => {
  try {
    const { paymentId } = req.params

    const payment = await prisma.materialPayment.findUnique({
      where: { id: paymentId },
      include: {
        order: {
          include: {
            school: {
              include: {
                paymentAccount: true,
              },
            },
          },
        },
      },
    })

    if (!payment) {
      return res.status(404).json({
        success: false,
        message: "Payment not found",
      })
    }

    if (!payment.order.school.paymentAccount?.paystackRecipientCode) {
      return res.status(400).json({
        success: false,
        message: "School payment account not configured",
      })
    }

    // Retry transfer
    const { initiateTransfer } = await import("../utils/paystack")

    const transferResult = await initiateTransfer({
      amount: Math.round(payment.schoolAmount.toNumber() * 100),
      recipient: payment.order.school.paymentAccount.paystackRecipientCode,
      reason: `Retry payment for order ${payment.order.orderNumber}`,
      reference: `RTY-${payment.order.orderNumber}-${Date.now()}`,
    })

    await prisma.materialPayment.update({
      where: { id: payment.id },
      data: {
        schoolTransferCode: transferResult.transfer_code,
        schoolTransferRef: transferResult.reference,
        schoolTransferStatus: "pending",
      },
    })

    res.json({
      success: true,
      message: "Transfer retry initiated successfully",
    })
  } catch (error) {
    console.error("Error retrying transfer:", error)
    res.status(500).json({
      success: false,
      message: "Failed to retry transfer",
    })
  }
}
