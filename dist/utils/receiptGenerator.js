"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.generateReceiptPDF = void 0;
const pdfkit_1 = __importDefault(require("pdfkit"));
const supabase_1 = require("../config/supabase");
const generateReceiptPDF = async (receiptData) => {
    return new Promise((resolve, reject) => {
        try {
            const doc = new pdfkit_1.default({ margin: 50 });
            const chunks = [];
            doc.on("data", (chunk) => chunks.push(chunk));
            doc.on("end", async () => {
                try {
                    const pdfBuffer = Buffer.concat(chunks);
                    // Upload to Supabase storage
                    const fileName = `receipts/${receiptData.receiptNumber}.pdf`;
                    const { data, error } = await supabase_1.supabase.storage.from("documents").upload(fileName, pdfBuffer, {
                        contentType: "application/pdf",
                    });
                    if (error) {
                        reject(error);
                        return;
                    }
                    const { data: urlData } = supabase_1.supabase.storage.from("documents").getPublicUrl(fileName);
                    resolve(urlData.publicUrl);
                }
                catch (uploadError) {
                    reject(uploadError);
                }
            });
            // Generate PDF content
            const { order, payment } = receiptData;
            // Header
            doc.fontSize(20).text("PAYMENT RECEIPT", { align: "center" });
            doc.moveDown();
            // Receipt details
            doc.fontSize(12);
            doc.text(`Receipt Number: ${receiptData.receiptNumber}`);
            doc.text(`Order Number: ${order.orderNumber}`);
            doc.text(`Date: ${new Date().toLocaleDateString()}`);
            doc.moveDown();
            // School details
            doc.text("SCHOOL DETAILS:", { underline: true });
            doc.text(`Name: ${order.school.name}`);
            if (order.school.address)
                doc.text(`Address: ${order.school.address}`);
            if (order.school.phone)
                doc.text(`Phone: ${order.school.phone}`);
            doc.moveDown();
            // Parent details
            doc.text("CUSTOMER DETAILS:", { underline: true });
            doc.text(`Name: ${order.parent.user.name} ${order.parent.user.surname}`);
            doc.text(`Email: ${order.parent.user.email}`);
            if (order.parent.user.phone)
                doc.text(`Phone: ${order.parent.user.phone}`);
            doc.moveDown();
            // Order items
            doc.text("ORDER ITEMS:", { underline: true });
            let yPosition = doc.y;
            // Table headers
            doc.text("Item", 50, yPosition);
            doc.text("Qty", 300, yPosition);
            doc.text("Price", 350, yPosition);
            doc.text("Total", 450, yPosition);
            yPosition += 20;
            doc.moveTo(50, yPosition).lineTo(550, yPosition).stroke();
            yPosition += 10;
            // Items
            order.items.forEach((item) => {
                doc.text(item.materialName, 50, yPosition);
                doc.text(item.quantity.toString(), 300, yPosition);
                doc.text(`₦${item.unitPrice.toFixed(2)}`, 350, yPosition);
                doc.text(`₦${item.totalPrice.toFixed(2)}`, 450, yPosition);
                yPosition += 20;
            });
            // Totals
            yPosition += 10;
            doc.moveTo(50, yPosition).lineTo(550, yPosition).stroke();
            yPosition += 20;
            doc.text(`Subtotal: ₦${order.subtotal.toFixed(2)}`, 350, yPosition);
            yPosition += 15;
            doc.text(`Processing Fee (2.9%): ₦${order.processingFee.toFixed(2)}`, 350, yPosition);
            yPosition += 15;
            doc.fontSize(14).text(`TOTAL PAID: ₦${order.totalAmount.toFixed(2)}`, 350, yPosition);
            // Footer
            doc.fontSize(10).text("Thank you for your purchase!", { align: "center" });
            doc.text("This is a computer-generated receipt.", { align: "center" });
            doc.end();
        }
        catch (error) {
            reject(error);
        }
    });
};
exports.generateReceiptPDF = generateReceiptPDF;
