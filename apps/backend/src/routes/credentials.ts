import { Router } from "express";
import { ThreadsService } from "../services/ThreadsService.js";
import {
  ThreadsCredential,
  CredentialStatus,
} from "../models/ThreadsCredential.js";
import { logger } from "../config/logger.js";
import { credentialService } from "../services/CredentialService.js";

const router = Router();
const threadsService = new ThreadsService();

// Setup endpoint for raw credential entry (from UI form)
router.post("/setup", async (req, res) => {
  try {
    const {
      accountName,
      threadsUserId,
      accessToken,
      refreshToken,
      accountDescription,
    } = req.body;

    // Validate required fields
    if (!accountName || !threadsUserId || !accessToken) {
      return res.status(400).json({
        success: false,
        error:
          "Missing required fields: accountName, threadsUserId, accessToken",
      });
    }

    logger.info(`Setting up credentials for account: ${accountName}`);

    // Get user ID (for simple setup, use a default admin user)
    const userId =
      (req as any).user?.id || process.env.ADMIN_USER_ID || "admin";

    // Check if this Threads account is already registered
    const existing = await ThreadsCredential.findOne({ threadsUserId });

    if (existing && existing.userId !== userId) {
      return res.status(409).json({
        success: false,
        error: "This Threads account is already registered to another user",
      });
    }

    // Store or update credential
    let credential;

    if (existing) {
      // Update existing
      existing.accountName = accountName;
      existing.accountDescription = accountDescription;
      existing.accessToken = accessToken;
      if (refreshToken) {
        existing.refreshToken = refreshToken;
      }
      existing.status = CredentialStatus.ACTIVE;
      existing.lastRefreshedAt = new Date();
      existing.errorCount = 0;

      credential = await existing.save();
      logger.info(`Updated existing credential: ${accountName}`);
    } else {
      // Create new - if first account for user, make it default
      const userAccountCount = await ThreadsCredential.countDocuments({
        userId,
      });

      const isDefault = userAccountCount === 0;

      // If making this default, remove default from others
      if (isDefault) {
        await ThreadsCredential.updateMany({ userId }, { isDefault: false });
      }

      credential = new ThreadsCredential({
        userId,
        accountName,
        accountDescription,
        threadsUserId,
        accessToken,
        refreshToken: refreshToken || undefined,
        status: CredentialStatus.ACTIVE,
        isDefault,
        clientId: process.env.THREADS_CLIENT_ID || "manual-setup",
        clientSecret: process.env.THREADS_CLIENT_SECRET || "manual-setup",
        redirectUri:
          process.env.THREADS_REDIRECT_URI || "http://localhost:3000/callback",
        scope: ["threads_basic_content", "threads_manage_replies"],
        errorCount: 0,
      });

      await credential.save();
      logger.info(`Created new credential: ${accountName}`);
    }

    // Return success with credential info
    res.status(201).json({
      success: true,
      message: "Credentials saved successfully",
      data: {
        id: credential._id,
        accountName: credential.accountName,
        threadsUserId: credential.threadsUserId,
        isDefault: credential.isDefault,
        status: credential.status,
        createdAt: credential.createdAt,
      },
    });
  } catch (error) {
    logger.error("Error setting up credentials:", error);
    res.status(500).json({
      success: false,
      error:
        error instanceof Error ? error.message : "Failed to setup credentials",
    });
  }
});

// Get all credentials for current user
router.get("/", async (req, res) => {
  try {
    const credentials = await threadsService.getAllCredentials();
    // Transform MongoDB _id to id for frontend compatibility
    const transformed = credentials.map((cred) => {
      const obj = cred.toObject ? cred.toObject() : cred;
      return {
        ...obj,
        id: (obj as any)._id,
      };
    });
    res.json(transformed);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    res.status(500).json({ error: message });
  }
});

// Get single credential
router.get("/:userId", async (req, res) => {
  try {
    const credential = await ThreadsCredential.findOne({
      threadsUserId: req.params.userId,
    });
    if (!credential) {
      return res.status(404).json({ error: "Credential not found" });
    }
    // Don't return sensitive secrets
    const safe = credential.toObject ? credential.toObject() : credential;
    delete (safe as any).clientSecret;
    // Add id field for frontend compatibility
    const obj = {
      ...safe,
      id: (safe as any)._id,
    };
    res.json(obj);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    res.status(500).json({ error: message });
  }
});

// Save credential (from OAuth callback)
router.post("/", async (req, res) => {
  try {
    const { threadsUserId, clientId, clientSecret, accessToken } = req.body;

    if (!threadsUserId || !clientId || !clientSecret || !accessToken) {
      return res.status(400).json({
        error:
          "threadsUserId, clientId, clientSecret, and accessToken are required",
      });
    }

    const credential = await threadsService.saveCredential({
      threadsUserId,
      clientId,
      clientSecret,
      accessToken,
      refreshToken: req.body.refreshToken,
      longLivedAccessToken: req.body.longLivedAccessToken,
      expiresAt: req.body.expiresAt,
    });

    // Return safe version without secrets
    const safe = credential.toObject ? credential.toObject() : credential;
    delete (safe as any).clientSecret;
    // Add id field for frontend compatibility
    const obj = {
      ...safe,
      id: (safe as any)._id,
    };
    res.status(201).json(obj);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    res.status(400).json({ error: message });
  }
});

// Verify credential validity
router.post("/:userId/verify", async (req, res) => {
  try {
    const credential = await ThreadsCredential.findOne({
      threadsUserId: req.params.userId,
    });
    if (!credential) {
      return res
        .status(404)
        .json({ error: "Credential not found", valid: false });
    }
    const isValid = await threadsService.verifyCredential(credential);
    res.json({ valid: isValid });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    res.status(400).json({ error: message, valid: false });
  }
});

// Revoke credential
router.delete("/:userId", async (req, res) => {
  try {
    await threadsService.revokeCredential(req.params.userId);
    res.json({ message: "Credential revoked successfully" });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    res.status(500).json({ error: message });
  }
});

// Refresh token manually
router.post("/:userId/refresh", async (req, res) => {
  try {
    const credential = await ThreadsCredential.findOne({
      threadsUserId: req.params.userId,
    });
    if (!credential) {
      return res.status(404).json({ error: "Credential not found" });
    }
    await threadsService.refreshToken(credential);
    // Return safe version without secrets
    const safe = credential.toObject();
    delete (safe as any).clientSecret;
    // Add id field for frontend compatibility
    const obj = {
      ...safe,
      id: (safe as any)._id,
    };
    res.json(obj);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    res.status(400).json({ error: message });
  }
});

// Set credential as default
router.patch("/:id/default", async (req, res) => {
  try {
    const userId =
      (req as any).user?.id || process.env.ADMIN_USER_ID || "admin";
    const credentialId = req.params.id;

    logger.info(
      `Setting credential ${credentialId} as default for user: ${userId}`
    );

    // Set this credential as default
    const credential = await ThreadsCredential.findByIdAndUpdate(
      credentialId,
      { isDefault: true },
      { new: true }
    );

    if (!credential) {
      return res.status(404).json({
        success: false,
        error: "Credential not found",
      });
    }

    // Remove default from all other credentials for this user
    await ThreadsCredential.updateMany(
      { userId, _id: { $ne: credentialId } },
      { isDefault: false }
    );

    // Return transformed response with id field
    const obj = credential.toObject ? credential.toObject() : credential;
    res.json({
      success: true,
      message: "Credential set as default",
      data: {
        ...obj,
        id: (obj as any)._id,
      },
    });
  } catch (error: unknown) {
    logger.error(`Error setting credential as default:`, error);
    res.status(500).json({
      success: false,
      error:
        error instanceof Error
          ? error.message
          : "Failed to set default credential",
    });
  }
});

// Delete credential
router.delete("/:id", async (req, res) => {
  try {
    const credentialId = req.params.id;

    logger.info(`Deleting credential ${credentialId}`);

    const credential = await ThreadsCredential.findByIdAndDelete(credentialId);

    if (!credential) {
      return res.status(404).json({
        success: false,
        error: "Credential not found",
      });
    }

    res.json({
      success: true,
      message: "Credential deleted successfully",
    });
  } catch (error: unknown) {
    logger.error(`Error deleting credential:`, error);
    res.status(500).json({
      success: false,
      error:
        error instanceof Error ? error.message : "Failed to delete credential",
    });
  }
});

export default router;
