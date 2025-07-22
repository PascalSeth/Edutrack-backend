"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getTransferDetails = exports.verifyTransfer = exports.getBanks = exports.verifyAccountNumber = exports.initiateTransfer = exports.createTransferRecipient = exports.createSubaccount = exports.verifyPayment = exports.initializePayment = void 0;
const axios_1 = __importDefault(require("axios"));
const PAYSTACK_SECRET_KEY = process.env.PAYSTACK_SECRET_KEY;
const PAYSTACK_BASE_URL = "https://api.paystack.co";
const paystackApi = axios_1.default.create({
    baseURL: PAYSTACK_BASE_URL,
    headers: {
        Authorization: `Bearer ${PAYSTACK_SECRET_KEY}`,
        "Content-Type": "application/json",
    },
});
// Initialize payment
const initializePayment = async (data) => {
    try {
        const response = await paystackApi.post("/transaction/initialize", data);
        return response.data.data;
    }
    catch (error) {
        console.error("Paystack initialization error:", error.response?.data || error.message);
        throw new Error(error.response?.data?.message || "Payment initialization failed");
    }
};
exports.initializePayment = initializePayment;
// Verify payment
const verifyPayment = async (reference) => {
    try {
        const response = await paystackApi.get(`/transaction/verify/${reference}`);
        return response.data;
    }
    catch (error) {
        console.error("Paystack verification error:", error.response?.data || error.message);
        throw new Error(error.response?.data?.message || "Payment verification failed");
    }
};
exports.verifyPayment = verifyPayment;
// Create subaccount
const createSubaccount = async (data) => {
    try {
        const response = await paystackApi.post("/subaccount", data);
        return response.data.data;
    }
    catch (error) {
        console.error("Paystack subaccount creation error:", error.response?.data || error.message);
        throw new Error(error.response?.data?.message || "Subaccount creation failed");
    }
};
exports.createSubaccount = createSubaccount;
// Create transfer recipient
const createTransferRecipient = async (data) => {
    try {
        const response = await paystackApi.post("/transferrecipient", {
            ...data,
            currency: data.currency || "NGN",
        });
        return response.data.data;
    }
    catch (error) {
        console.error("Paystack recipient creation error:", error.response?.data || error.message);
        throw new Error(error.response?.data?.message || "Transfer recipient creation failed");
    }
};
exports.createTransferRecipient = createTransferRecipient;
// Initiate transfer
const initiateTransfer = async (data) => {
    try {
        const response = await paystackApi.post("/transfer", {
            ...data,
            currency: data.currency || "NGN",
            source: "balance",
        });
        return response.data.data;
    }
    catch (error) {
        console.error("Paystack transfer error:", error.response?.data || error.message);
        throw new Error(error.response?.data?.message || "Transfer initiation failed");
    }
};
exports.initiateTransfer = initiateTransfer;
// Verify account number
const verifyAccountNumber = async (accountNumber, bankCode) => {
    try {
        const response = await paystackApi.get(`/bank/resolve?account_number=${accountNumber}&bank_code=${bankCode}`);
        return response.data;
    }
    catch (error) {
        console.error("Account verification error:", error.response?.data || error.message);
        throw new Error(error.response?.data?.message || "Account verification failed");
    }
};
exports.verifyAccountNumber = verifyAccountNumber;
// Get list of banks
const getBanks = async () => {
    try {
        const response = await paystackApi.get("/bank");
        return response.data.data;
    }
    catch (error) {
        console.error("Banks fetch error:", error.response?.data || error.message);
        throw new Error(error.response?.data?.message || "Failed to fetch banks");
    }
};
exports.getBanks = getBanks;
// Verify transfer
const verifyTransfer = async (transferCode) => {
    try {
        const response = await paystackApi.get(`/transfer/verify/${transferCode}`);
        return response.data;
    }
    catch (error) {
        console.error("Transfer verification error:", error.response?.data || error.message);
        throw new Error(error.response?.data?.message || "Transfer verification failed");
    }
};
exports.verifyTransfer = verifyTransfer;
// Get transfer details
const getTransferDetails = async (transferId) => {
    try {
        const response = await paystackApi.get(`/transfer/${transferId}`);
        return response.data.data;
    }
    catch (error) {
        console.error("Transfer details error:", error.response?.data || error.message);
        throw new Error(error.response?.data?.message || "Failed to get transfer details");
    }
};
exports.getTransferDetails = getTransferDetails;
