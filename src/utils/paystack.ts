import axios from "axios"

const PAYSTACK_SECRET_KEY = process.env.PAYSTACK_SECRET_KEY
const PAYSTACK_BASE_URL = "https://api.paystack.co"

const paystackApi = axios.create({
  baseURL: PAYSTACK_BASE_URL,
  headers: {
    Authorization: `Bearer ${PAYSTACK_SECRET_KEY}`,
    "Content-Type": "application/json",
  },
})

export interface PaymentInitializationData {
  email: string
  amount: number // in kobo
  reference?: string
  callback_url?: string
  metadata?: any
  channels?: string[]
  split_code?: string
  subaccount?: string
  transaction_charge?: number
  bearer?: string
}

export interface SubaccountData {
  business_name: string
  settlement_bank: string
  account_number: string
  percentage_charge: number
  description?: string
  primary_contact_email?: string
  primary_contact_name?: string
  primary_contact_phone?: string
  metadata?: any
}

export interface TransferRecipientData {
  type: string
  name: string
  account_number: string
  bank_code: string
  description?: string
  currency?: string
  metadata?: any
}

export interface TransferData {
  amount: number // in kobo
  recipient: string
  reason?: string
  currency?: string
  reference?: string
}

// Initialize payment
export const initializePayment = async (data: PaymentInitializationData) => {
  try {
    const response = await paystackApi.post("/transaction/initialize", data)
    return response.data.data
  } catch (error: any) {
    console.error("Paystack initialization error:", error.response?.data || error.message)
    throw new Error(error.response?.data?.message || "Payment initialization failed")
  }
}

// Verify payment
export const verifyPayment = async (reference: string) => {
  try {
    const response = await paystackApi.get(`/transaction/verify/${reference}`)
    return response.data
  } catch (error: any) {
    console.error("Paystack verification error:", error.response?.data || error.message)
    throw new Error(error.response?.data?.message || "Payment verification failed")
  }
}

// Create subaccount
export const createSubaccount = async (data: SubaccountData) => {
  try {
    const response = await paystackApi.post("/subaccount", data)
    return response.data.data
  } catch (error: any) {
    console.error("Paystack subaccount creation error:", error.response?.data || error.message)
    throw new Error(error.response?.data?.message || "Subaccount creation failed")
  }
}

// Create transfer recipient
export const createTransferRecipient = async (data: TransferRecipientData) => {
  try {
    const response = await paystackApi.post("/transferrecipient", {
      ...data,
      currency: data.currency || "NGN",
    })
    return response.data.data
  } catch (error: any) {
    console.error("Paystack recipient creation error:", error.response?.data || error.message)
    throw new Error(error.response?.data?.message || "Transfer recipient creation failed")
  }
}

// Initiate transfer
export const initiateTransfer = async (data: TransferData) => {
  try {
    const response = await paystackApi.post("/transfer", {
      ...data,
      currency: data.currency || "NGN",
      source: "balance",
    })
    return response.data.data
  } catch (error: any) {
    console.error("Paystack transfer error:", error.response?.data || error.message)
    throw new Error(error.response?.data?.message || "Transfer initiation failed")
  }
}

// Verify account number
export const verifyAccountNumber = async (accountNumber: string, bankCode: string) => {
  try {
    const response = await paystackApi.get(`/bank/resolve?account_number=${accountNumber}&bank_code=${bankCode}`)
    return response.data
  } catch (error: any) {
    console.error("Account verification error:", error.response?.data || error.message)
    throw new Error(error.response?.data?.message || "Account verification failed")
  }
}

// Get list of banks
export const getBanks = async () => {
  try {
    const response = await paystackApi.get("/bank")
    return response.data.data
  } catch (error: any) {
    console.error("Banks fetch error:", error.response?.data || error.message)
    throw new Error(error.response?.data?.message || "Failed to fetch banks")
  }
}

// Verify transfer
export const verifyTransfer = async (transferCode: string) => {
  try {
    const response = await paystackApi.get(`/transfer/verify/${transferCode}`)
    return response.data
  } catch (error: any) {
    console.error("Transfer verification error:", error.response?.data || error.message)
    throw new Error(error.response?.data?.message || "Transfer verification failed")
  }
}

// Get transfer details
export const getTransferDetails = async (transferId: string) => {
  try {
    const response = await paystackApi.get(`/transfer/${transferId}`)
    return response.data.data
  } catch (error: any) {
    console.error("Transfer details error:", error.response?.data || error.message)
    throw new Error(error.response?.data?.message || "Failed to get transfer details")
  }
}
