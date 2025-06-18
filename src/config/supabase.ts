import { createClient } from "@supabase/supabase-js"
import 'dotenv/config'

// Validate environment variables
const supabaseUrl = process.env.SUPABASE_URL
const supabaseKey = process.env.SUPABASE_ANON_KEY
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl) {
  throw new Error("SUPABASE_URL is required. Please check your .env file.")
}
if (!supabaseKey) {
  throw new Error("SUPABASE_ANON_KEY is required. Please check your .env file.")
}
if (!supabaseServiceKey) {
  throw new Error("SUPABASE_SERVICE_ROLE_KEY is required. Please check your .env file.")
}

// Client for general operations
export const supabase = createClient(supabaseUrl, supabaseKey)

// Service client for admin operations (file uploads, etc.)
export const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
})

// Storage buckets configuration
export const STORAGE_BUCKETS = {
  SCHOOL_DOCUMENTS: "school-documents",
  ASSIGNMENTS: "assignments",
  EXAM_QUESTIONS: "exam-questions",
  RESULTS: "results",
  PROFILE_IMAGES: "profile-images",
  CHAT_ATTACHMENTS: "chat-attachments",
  ANNOUNCEMENTS: "announcements",
  EVENTS: "events",
  RECEIPTS: "receipts",
  TIMETABLES: "timetables",
  CALENDARS: "calendars",
} as const

export type StorageBucket = (typeof STORAGE_BUCKETS)[keyof typeof STORAGE_BUCKETS]

export default supabase