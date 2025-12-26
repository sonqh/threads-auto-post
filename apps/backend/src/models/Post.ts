import mongoose, { Schema, Document } from "mongoose";

export enum PostType {
  TEXT = "TEXT",
  IMAGE = "IMAGE",
  CAROUSEL = "CAROUSEL",
  VIDEO = "VIDEO",
}

export enum PostStatus {
  DRAFT = "DRAFT",
  SCHEDULED = "SCHEDULED",
  PUBLISHING = "PUBLISHING",
  PUBLISHED = "PUBLISHED",
  FAILED = "FAILED",
}

export enum SchedulePattern {
  ONCE = "ONCE",
  WEEKLY = "WEEKLY",
  MONTHLY = "MONTHLY",
  DATE_RANGE = "DATE_RANGE",
}

export interface ScheduleConfig {
  pattern: SchedulePattern;
  scheduledAt: Date; // For ONCE and DATE_RANGE start date
  endDate?: Date; // For DATE_RANGE: when to stop recurring
  daysOfWeek?: number[]; // For WEEKLY: 0=Sunday, 1=Monday, etc.
  dayOfMonth?: number; // For MONTHLY: 1-31
  time?: string; // HH:mm format (defaults to 09:00)
}

export interface IPost extends Document {
  // Excel columns mapping
  excelId?: string; // ID
  topic?: string; // Chủ đề
  content: string; // Nội dung bài post
  status: PostStatus; // Trạng thái
  skipAI?: boolean; // Skip AI
  threadsPostId?: string; // Post ID (after publishing)
  postType: PostType; // Loại bài viết
  comment?: string; // Comment
  videoUrl?: string; // Link Video
  imageUrls: string[]; // Link ảnh 1-10
  mergeLinks?: string; // Gộp Link

  // Scheduling
  scheduledAt?: Date;
  scheduleConfig?: ScheduleConfig; // Flexible schedule pattern
  publishedAt?: Date;

  // Job tracking
  jobId?: string;
  publishingProgress?: {
    status: "pending" | "publishing" | "published" | "failed";
    startedAt?: Date;
    completedAt?: Date;
    currentStep?: string; // e.g., "Creating image container", "Publishing post", "Creating comment"
    error?: string;
  };

  // Error tracking
  error?: string;

  // Timestamps
  createdAt: Date;
  updatedAt: Date;
}

const PostSchema = new Schema<IPost>(
  {
    excelId: { type: String },
    topic: { type: String },
    content: { type: String, required: true },
    status: {
      type: String,
      enum: Object.values(PostStatus),
      default: PostStatus.DRAFT,
    },
    skipAI: { type: Boolean, default: false },
    threadsPostId: { type: String },
    postType: {
      type: String,
      enum: Object.values(PostType),
      required: true,
    },
    comment: { type: String },
    videoUrl: { type: String },
    imageUrls: { type: [String], default: [] },
    mergeLinks: { type: String },
    scheduledAt: { type: Date },
    scheduleConfig: {
      pattern: {
        type: String,
        enum: Object.values(SchedulePattern),
      },
      scheduledAt: Date,
      endDate: Date,
      daysOfWeek: [Number],
      dayOfMonth: Number,
      time: { type: String, default: "09:00" },
    },
    publishedAt: { type: Date },
    jobId: { type: String },
    publishingProgress: {
      status: {
        type: String,
        enum: ["pending", "publishing", "published", "failed"],
      },
      startedAt: Date,
      completedAt: Date,
      currentStep: String,
      error: String,
    },
    error: { type: String },
  },
  {
    timestamps: true,
  }
);

// Indexes
PostSchema.index({ status: 1, scheduledAt: 1 });
PostSchema.index({ threadsPostId: 1 });

export const Post = mongoose.model<IPost>("Post", PostSchema);
