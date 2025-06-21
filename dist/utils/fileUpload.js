"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.FileUploadService = void 0;
const supabase_1 = require("../config/supabase");
const setup_1 = require("./setup");
class FileUploadService {
    static async uploadFile(options) {
        const { file, fileName, mimeType, bucket, schoolId, uploadedById, category } = options;
        // Generate unique filename
        const timestamp = Date.now();
        const uniqueFileName = `${timestamp}-${fileName}`;
        const filePath = schoolId ? `${schoolId}/${uniqueFileName}` : uniqueFileName;
        try {
            // Upload to Supabase Storage
            const { data, error } = await supabase_1.supabaseAdmin.storage.from(bucket).upload(filePath, file, {
                contentType: mimeType,
                upsert: false,
            });
            if (error) {
                throw new Error(`Upload failed: ${error.message}`);
            }
            // Get public URL
            const { data: urlData } = supabase_1.supabaseAdmin.storage.from(bucket).getPublicUrl(filePath);
            // Save file record to database
            const fileRecord = await setup_1.prisma.fileStorage.create({
                data: {
                    fileName: uniqueFileName,
                    originalName: fileName,
                    fileSize: file.length,
                    mimeType,
                    fileUrl: urlData.publicUrl,
                    bucketName: bucket,
                    uploadedById,
                    schoolId,
                    fileCategory: category,
                },
            });
            return {
                fileUrl: urlData.publicUrl,
                fileName: uniqueFileName,
                fileId: fileRecord.id,
            };
        }
        catch (error) {
            throw new Error(`File upload failed: ${error instanceof Error ? error.message : "Unknown error"}`);
        }
    }
    static async deleteFile(fileUrl, bucket) {
        try {
            // Extract file path from URL
            const url = new URL(fileUrl);
            const pathParts = url.pathname.split("/");
            const filePath = pathParts.slice(-2).join("/"); // Get last two parts (schoolId/filename or just filename)
            // Delete from Supabase Storage
            const { error } = await supabase_1.supabaseAdmin.storage.from(bucket).remove([filePath]);
            if (error) {
                throw new Error(`Delete failed: ${error.message}`);
            }
            // Delete from database
            await setup_1.prisma.fileStorage.deleteMany({
                where: { fileUrl },
            });
        }
        catch (error) {
            throw new Error(`File deletion failed: ${error instanceof Error ? error.message : "Unknown error"}`);
        }
    }
    static async getFilesByCategory(category, schoolId) {
        return setup_1.prisma.fileStorage.findMany({
            where: {
                fileCategory: category,
                ...(schoolId && { schoolId }),
            },
            orderBy: { createdAt: "desc" },
        });
    }
    static getBucketForCategory(category) {
        const categoryToBucket = {
            PROFILE_IMAGE: supabase_1.STORAGE_BUCKETS.PROFILE_IMAGES,
            SCHOOL_LOGO: supabase_1.STORAGE_BUCKETS.SCHOOL_DOCUMENTS,
            DOCUMENT: supabase_1.STORAGE_BUCKETS.SCHOOL_DOCUMENTS,
            ASSIGNMENT: supabase_1.STORAGE_BUCKETS.ASSIGNMENTS,
            EXAM_QUESTION: supabase_1.STORAGE_BUCKETS.EXAM_QUESTIONS,
            RESULT: supabase_1.STORAGE_BUCKETS.RESULTS,
            TIMETABLE: supabase_1.STORAGE_BUCKETS.TIMETABLES,
            CALENDAR: supabase_1.STORAGE_BUCKETS.CALENDARS,
            ANNOUNCEMENT: supabase_1.STORAGE_BUCKETS.ANNOUNCEMENTS,
            EVENT_IMAGE: supabase_1.STORAGE_BUCKETS.EVENTS,
            CHAT_ATTACHMENT: supabase_1.STORAGE_BUCKETS.CHAT_ATTACHMENTS,
            RECEIPT: supabase_1.STORAGE_BUCKETS.RECEIPTS,
            ACCREDITATION: supabase_1.STORAGE_BUCKETS.SCHOOL_DOCUMENTS,
            OTHER: supabase_1.STORAGE_BUCKETS.SCHOOL_DOCUMENTS,
        };
        return categoryToBucket[category];
    }
}
exports.FileUploadService = FileUploadService;
