"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.STORAGE_BUCKETS = exports.supabaseAdmin = exports.supabase = void 0;
const supabase_js_1 = require("@supabase/supabase-js");
require("dotenv/config");
// Validate environment variables
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_ANON_KEY;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!supabaseUrl) {
    throw new Error("SUPABASE_URL is required. Please check your .env file.");
}
if (!supabaseKey) {
    throw new Error("SUPABASE_ANON_KEY is required. Please check your .env file.");
}
if (!supabaseServiceKey) {
    throw new Error("SUPABASE_SERVICE_ROLE_KEY is required. Please check your .env file.");
}
// Client for general operations
exports.supabase = (0, supabase_js_1.createClient)(supabaseUrl, supabaseKey);
// Service client for admin operations (file uploads, etc.)
exports.supabaseAdmin = (0, supabase_js_1.createClient)(supabaseUrl, supabaseServiceKey, {
    auth: {
        autoRefreshToken: false,
        persistSession: false,
    },
});
// Storage buckets configuration
exports.STORAGE_BUCKETS = {
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
};
exports.default = exports.supabase;
