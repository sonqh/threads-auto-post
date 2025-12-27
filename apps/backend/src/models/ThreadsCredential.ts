import mongoose, { Schema, Document } from "mongoose";

export enum CredentialStatus {
  ACTIVE = "ACTIVE",
  EXPIRED = "EXPIRED",
  REVOKED = "REVOKED",
}

export interface IThreadsCredential extends Document {
  // User ownership (MULTI-ACCOUNT SUPPORT)
  userId: string; // Reference to app user
  accountName: string; // User-friendly account name (e.g., "Brand Main", "Creator Account")
  accountDescription?: string; // Optional description
  isDefault: boolean; // Mark as default account for user

  // OAuth credentials
  clientId: string;
  clientSecret: string; // Should be encrypted in DB
  redirectUri: string;

  // Access tokens
  accessToken: string;
  refreshToken?: string;
  longLivedAccessToken?: string;

  // Metadata
  threadsUserId: string; // The actual Threads user ID from the API
  threadsUserName?: string; // Username from Threads API
  expiresAt?: Date; // When access_token expires
  longLivedExpiresAt?: Date; // When long_lived_access_token expires (60 days)

  // Status
  status: CredentialStatus;
  scope: string[];

  // Audit
  lastRefreshedAt?: Date;
  errorCount: number;
  lastError?: string;

  // Timestamps
  createdAt: Date;
  updatedAt: Date;
}

const ThreadsCredentialSchema = new Schema<IThreadsCredential>(
  {
    // User ownership (MULTI-ACCOUNT SUPPORT)
    userId: {
      type: String,
      required: true,
      index: true,
      description: "Reference to app user",
    },
    accountName: {
      type: String,
      required: true,
      description: "User-friendly account name (e.g., Brand Main)",
    },
    accountDescription: {
      type: String,
      description: "Optional description of the account",
    },
    isDefault: {
      type: Boolean,
      default: false,
      description: "Whether this is the default account for the user",
    },

    clientId: { type: String, required: true, index: true },
    clientSecret: { type: String, required: true }, // Should be encrypted
    redirectUri: { type: String, required: true },

    accessToken: { type: String, required: true },
    refreshToken: { type: String },
    longLivedAccessToken: { type: String },

    threadsUserId: { type: String, required: true, unique: true, index: true },
    threadsUserName: { type: String },
    expiresAt: { type: Date },
    longLivedExpiresAt: { type: Date },

    status: {
      type: String,
      enum: Object.values(CredentialStatus),
      default: CredentialStatus.ACTIVE,
    },
    scope: { type: [String], default: [] },

    lastRefreshedAt: { type: Date },
    errorCount: { type: Number, default: 0 },
    lastError: { type: String },
  },
  {
    timestamps: true,
  }
);

// Indexes for multi-account queries
ThreadsCredentialSchema.index({ userId: 1, createdAt: -1 });
ThreadsCredentialSchema.index({ userId: 1, isDefault: 1 });
ThreadsCredentialSchema.index({ userId: 1, status: 1 });
ThreadsCredentialSchema.index({ status: 1 });
ThreadsCredentialSchema.index({ expiresAt: 1 });

export const ThreadsCredential = mongoose.model<IThreadsCredential>(
  "ThreadsCredential",
  ThreadsCredentialSchema
);
