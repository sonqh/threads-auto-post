import {
  Post,
  PostStatus,
  CommentStatus,
  generateContentHash,
  IPost,
} from "../models/Post.js";
import { log } from "../config/logger.js";
import crypto from "crypto";

// Default duplication check window: 24 hours (configurable via env)
const DUPLICATION_WINDOW_HOURS = parseInt(
  process.env.DUPLICATION_WINDOW_HOURS || "24",
  10
);
// Idempotency window: Prevent duplicate posts within this time (defaults to 3 days)
// Set IDEMPOTENCY_WINDOW_HOURS to control how far back to check for duplicates
const IDEMPOTENCY_WINDOW_HOURS = parseInt(
  process.env.IDEMPOTENCY_WINDOW_HOURS || "72", // 3 days default
  10
);
const LOCK_TIMEOUT_MS = parseInt(
  process.env.EXECUTION_LOCK_TIMEOUT_MS || "300000",
  10
); // 5 minutes default
const ENABLE_IDEMPOTENCY_CHECK =
  process.env.ENABLE_IDEMPOTENCY_CHECK !== "false";
// When enabled, idempotency key is checked to prevent duplicate scheduled jobs
// Set ENABLE_IDEMPOTENCY_CHECK=false to disable this check (useful for development)

export interface DuplicateCheckResult {
  isDuplicate: boolean;
  existingPost?: IPost;
  message?: string;
}

export interface LockResult {
  acquired: boolean;
  reason?: string;
}

export class IdempotencyService {
  /**
   * Generate a unique idempotency key for a post
   * Format: post-{postId}-{scheduledAt timestamp or now}
   * Returns null if idempotency checks are disabled
   */
  generateIdempotencyKey(postId: string, scheduledAt?: Date): string | null {
    if (!ENABLE_IDEMPOTENCY_CHECK) {
      return null;
    }
    const timestamp = scheduledAt ? scheduledAt.getTime() : Date.now();
    return `post-${postId}-${timestamp}`;
  }

  /**
   * Check if a post with similar content was already published recently
   * Uses content hash for comparison within configurable time window
   */
  async checkForDuplicate(
    content: string,
    imageUrls: string[] = [],
    videoUrl?: string,
    excludePostId?: string
  ): Promise<DuplicateCheckResult> {
    const contentHash = generateContentHash(content, imageUrls, videoUrl);
    const windowStart = new Date(
      Date.now() - DUPLICATION_WINDOW_HOURS * 60 * 60 * 1000
    );

    log.debug(`🔍 Checking for duplicates with hash: ${contentHash}`);
    log.debug(`   Window: ${windowStart.toISOString()} to now`);

    const query: any = {
      contentHash,
      status: { $in: [PostStatus.PUBLISHED, PostStatus.PUBLISHING] },
      $or: [
        { publishedAt: { $gte: windowStart } },
        {
          status: PostStatus.PUBLISHING,
          "publishingProgress.startedAt": { $gte: windowStart },
        },
      ],
    };

    // Exclude current post from check (for retries)
    if (excludePostId) {
      query._id = { $ne: excludePostId };
    }

    const existingPost = await Post.findOne(query);

    if (existingPost) {
      const publishedAt =
        existingPost.publishedAt || existingPost.publishingProgress?.startedAt;
      log.warn(
        `Duplicate detected! Existing post ${
          existingPost._id
        } published at ${publishedAt?.toISOString()}`
      );

      return {
        isDuplicate: true,
        existingPost,
        message: `This content was already published ${this.formatTimeAgo(
          publishedAt!
        )}. Please choose different content.`,
      };
    }

    return { isDuplicate: false };
  }

  /**
   * Check if post content was recently posted (within idempotency window)
   * This prevents accidental duplicate posts within recent days
   */
  async checkRecentPostContent(
    content: string,
    imageUrls: string[] = [],
    videoUrl?: string,
    excludePostId?: string
  ): Promise<DuplicateCheckResult> {
    if (!ENABLE_IDEMPOTENCY_CHECK) {
      return { isDuplicate: false };
    }

    const contentHash = generateContentHash(content, imageUrls, videoUrl);
    const windowStart = new Date(
      Date.now() - IDEMPOTENCY_WINDOW_HOURS * 60 * 60 * 1000
    );

    log.debug(`🔐 Checking recent posts within idempotency window...`);
    log.debug(
      `   Content hash: ${contentHash} | Window: ${this.formatTimeAgo(
        windowStart
      )} (${IDEMPOTENCY_WINDOW_HOURS}h)`
    );

    const query: any = {
      contentHash,
      status: {
        $in: [
          PostStatus.PUBLISHED,
          PostStatus.PUBLISHING,
          PostStatus.SCHEDULED,
        ],
      },
      $or: [
        { publishedAt: { $gte: windowStart } },
        { scheduledAt: { $gte: windowStart } },
        {
          status: PostStatus.PUBLISHING,
          "publishingProgress.startedAt": { $gte: windowStart },
        },
      ],
    };

    // Exclude current post from check
    if (excludePostId) {
      query._id = { $ne: excludePostId };
    }

    const recentPost = await Post.findOne(query).sort({
      publishedAt: -1,
      scheduledAt: -1,
    });

    if (recentPost) {
      const postDate = recentPost.publishedAt || recentPost.scheduledAt;
      const timeAgo = this.formatTimeAgo(postDate!);

      log.warn(
        `🚫 Idempotency check: Similar content found in post ${recentPost._id} from ${timeAgo}`
      );

      return {
        isDuplicate: true,
        existingPost: recentPost,
        message: `Similar content was already posted ${timeAgo}. To avoid duplicate posts, please wait or use different content. (Window: ${IDEMPOTENCY_WINDOW_HOURS} hours)`,
      };
    }

    log.debug(`✅ No recent duplicate content found`);
    return { isDuplicate: false };
  }

  /**
   * Acquire an execution lock for a post to prevent concurrent publishing
   * Returns false if another worker is already processing this post
   */
  async acquireExecutionLock(
    postId: string,
    workerId: string
  ): Promise<LockResult> {
    const now = new Date();
    const expiresAt = new Date(now.getTime() + LOCK_TIMEOUT_MS);

    // Use atomic findOneAndUpdate to acquire lock
    const result = await Post.findOneAndUpdate(
      {
        _id: postId,
        $or: [
          { executionLock: { $exists: false } },
          { "executionLock.expiresAt": { $lt: now } }, // Lock expired
        ],
      },
      {
        $set: {
          executionLock: {
            lockedAt: now,
            lockedBy: workerId,
            expiresAt,
          },
        },
      },
      { new: true }
    );

    if (result) {
      log.debug(`🔒 Acquired execution lock for post ${postId}`);
      return { acquired: true };
    }

    // Check who has the lock
    const post = await Post.findById(postId);
    if (post?.executionLock) {
      log.warn(
        `Post ${postId} is locked by ${post.executionLock.lockedBy} until ${post.executionLock.expiresAt}`
      );
      return {
        acquired: false,
        reason: `Locked by ${
          post.executionLock.lockedBy
        } until ${post.executionLock.expiresAt.toISOString()}`,
      };
    }

    return { acquired: false, reason: "Unknown lock state" };
  }

  /**
   * Release execution lock after publishing completes (success or failure)
   */
  async releaseExecutionLock(postId: string): Promise<void> {
    await Post.findByIdAndUpdate(postId, {
      $unset: { executionLock: 1 },
    });
    log.debug(`🔓 Released execution lock for post ${postId}`);
  }

  /**
   * Check if post is safe to publish (not already published, no active lock)
   */
  async canPublish(
    postId: string
  ): Promise<{ canPublish: boolean; reason?: string; post?: IPost }> {
    const post = await Post.findById(postId);

    if (!post) {
      return { canPublish: false, reason: "Post not found" };
    }

    // Already published - skip silently
    if (post.status === PostStatus.PUBLISHED && post.threadsPostId) {
      return {
        canPublish: false,
        reason: "Post already published",
        post,
      };
    }

    // Check for valid execution lock by another worker
    if (post.executionLock && post.executionLock.expiresAt > new Date()) {
      return {
        canPublish: false,
        reason: `Post is being processed by ${post.executionLock.lockedBy}`,
        post,
      };
    }

    return { canPublish: true, post };
  }

  /**
   * Check if comment needs to be retried
   * Returns true if post is published but comment failed
   */
  async shouldRetryComment(
    postId: string
  ): Promise<{ shouldRetry: boolean; post?: IPost }> {
    const post = await Post.findById(postId);

    if (!post) {
      return { shouldRetry: false };
    }

    // Post must be published successfully
    if (post.status !== PostStatus.PUBLISHED || !post.threadsPostId) {
      return { shouldRetry: false, post };
    }

    // Comment must have failed and not exceeded retry limit
    const maxRetries = parseInt(process.env.COMMENT_MAX_RETRIES || "3", 10);
    if (
      post.commentStatus === CommentStatus.FAILED &&
      (post.commentRetryCount || 0) < maxRetries &&
      post.comment // Has a comment to post
    ) {
      return { shouldRetry: true, post };
    }

    return { shouldRetry: false, post };
  }

  /**
   * Update content hash for a post (call when content changes)
   */
  async updateContentHash(postId: string): Promise<void> {
    const post = await Post.findById(postId);
    if (post) {
      post.contentHash = generateContentHash(
        post.content,
        post.imageUrls,
        post.videoUrl
      );
      await post.save();
      log.debug(`Updated content hash for post ${postId}: ${post.contentHash}`);
    }
  }

  /**
   * Initialize comment status when post has a comment
   */
  initializeCommentStatus(post: IPost): void {
    if (post.comment && post.comment.trim()) {
      post.commentStatus = CommentStatus.PENDING;
    } else {
      post.commentStatus = CommentStatus.NONE;
    }
  }

  /**
   * Cleanup expired execution locks (run periodically)
   */
  async cleanupExpiredLocks(): Promise<number> {
    const result = await Post.updateMany(
      { "executionLock.expiresAt": { $lt: new Date() } },
      { $unset: { executionLock: 1 } }
    );

    if (result.modifiedCount > 0) {
      log.info(`🧹 Cleaned up ${result.modifiedCount} expired execution locks`);
    }

    return result.modifiedCount;
  }

  private formatTimeAgo(date: Date): string {
    const seconds = Math.floor((Date.now() - date.getTime()) / 1000);

    if (seconds < 60) return `${seconds} seconds ago`;
    if (seconds < 3600) return `${Math.floor(seconds / 60)} minutes ago`;
    if (seconds < 86400) return `${Math.floor(seconds / 3600)} hours ago`;
    return `${Math.floor(seconds / 86400)} days ago`;
  }
}

export const idempotencyService = new IdempotencyService();
