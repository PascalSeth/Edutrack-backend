import { supabaseAdmin, STORAGE_BUCKETS, type StorageBucket } from "../config/supabase"
import { prisma } from "./setup"
import type { FileCategory } from "@prisma/client"

interface UploadFileOptions {
  file: Buffer
  fileName: string
  mimeType: string
  bucket: StorageBucket
  schoolId?: string
  uploadedById: string
  category: FileCategory
}

interface UploadResult {
  fileUrl: string
  fileName: string
  fileId: string
}

export class FileUploadService {
  static async uploadFile(options: UploadFileOptions): Promise<UploadResult> {
    const { file, fileName, mimeType, bucket, schoolId, uploadedById, category } = options

    // Generate unique filename
    const timestamp = Date.now()
    const uniqueFileName = `${timestamp}-${fileName}`
    const filePath = schoolId ? `${schoolId}/${uniqueFileName}` : uniqueFileName

    try {
      // Upload to Supabase Storage
      const { data, error } = await supabaseAdmin.storage.from(bucket).upload(filePath, file, {
        contentType: mimeType,
        upsert: false,
      })

      if (error) {
        throw new Error(`Upload failed: ${error.message}`)
      }

      // Get public URL
      const { data: urlData } = supabaseAdmin.storage.from(bucket).getPublicUrl(filePath)

      // Save file record to database
      const fileRecord = await prisma.fileStorage.create({
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
      })

      return {
        fileUrl: urlData.publicUrl,
        fileName: uniqueFileName,
        fileId: fileRecord.id,
      }
    } catch (error) {
      throw new Error(`File upload failed: ${error instanceof Error ? error.message : "Unknown error"}`)
    }
  }

  static async deleteFile(fileUrl: string, bucket: StorageBucket): Promise<void> {
    try {
      // Extract file path from URL
      const url = new URL(fileUrl)
      const pathParts = url.pathname.split("/")
      const filePath = pathParts.slice(-2).join("/") // Get last two parts (schoolId/filename or just filename)

      // Delete from Supabase Storage
      const { error } = await supabaseAdmin.storage.from(bucket).remove([filePath])

      if (error) {
        throw new Error(`Delete failed: ${error.message}`)
      }

      // Delete from database
      await prisma.fileStorage.deleteMany({
        where: { fileUrl },
      })
    } catch (error) {
      throw new Error(`File deletion failed: ${error instanceof Error ? error.message : "Unknown error"}`)
    }
  }

  static async getFilesByCategory(category: FileCategory, schoolId?: string): Promise<any[]> {
    return prisma.fileStorage.findMany({
      where: {
        fileCategory: category,
        ...(schoolId && { schoolId }),
      },
      orderBy: { createdAt: "desc" },
    })
  }

  static getBucketForCategory(category: FileCategory): StorageBucket {
    const categoryToBucket: Record<FileCategory, StorageBucket> = {
      PROFILE_IMAGE: STORAGE_BUCKETS.PROFILE_IMAGES,
      SCHOOL_LOGO: STORAGE_BUCKETS.SCHOOL_DOCUMENTS,
      DOCUMENT: STORAGE_BUCKETS.SCHOOL_DOCUMENTS,
      ASSIGNMENT: STORAGE_BUCKETS.ASSIGNMENTS,
      EXAM_QUESTION: STORAGE_BUCKETS.EXAM_QUESTIONS,
      RESULT: STORAGE_BUCKETS.RESULTS,
      TIMETABLE: STORAGE_BUCKETS.TIMETABLES,
      CALENDAR: STORAGE_BUCKETS.CALENDARS,
      ANNOUNCEMENT: STORAGE_BUCKETS.ANNOUNCEMENTS,
      EVENT_IMAGE: STORAGE_BUCKETS.EVENTS,
      CHAT_ATTACHMENT: STORAGE_BUCKETS.CHAT_ATTACHMENTS,
      RECEIPT: STORAGE_BUCKETS.RECEIPTS,
      ACCREDITATION: STORAGE_BUCKETS.SCHOOL_DOCUMENTS,
      OTHER: STORAGE_BUCKETS.SCHOOL_DOCUMENTS,
    }

    return categoryToBucket[category]
  }
}
