import {
  connectDatabase,
  disconnectDatabase,
} from "../../src/config/database.js";
import { createRedisConnection } from "../../src/config/redis.js";
import { postQueue } from "../../src/queue/postQueue.js";
import { schedulerQueue } from "../../src/queue/schedulerQueue.js";
import { Post, PostStatus, PostType } from "../../src/models/Post.js";
import { ThreadsCredential } from "../../src/models/ThreadsCredential.js";
import dotenv from "dotenv";
import { resolve } from "path";

// Load test environment variables
dotenv.config({ path: resolve(process.cwd(), ".env.test") });

/**
 * Test setup and teardown utilities
 */
export const testSetup = {
  /**
   * Initialize test environment
   */
  async setup() {
    await connectDatabase();
  },

  /**
   * Clean up test environment
   */
  async teardown() {
    await disconnectDatabase();
  },

  /**
   * Clear all queues
   */
  async clearQueues() {
    await postQueue.clean(0, 100000);
    await schedulerQueue.clean(0, 100000);
    await postQueue.obliterate();
    await schedulerQueue.obliterate();
  },

  /**
   * Clear all database collections
   */
  async clearDatabase() {
    await Post.deleteMany({});
    await ThreadsCredential.deleteMany({});
  },

  /**
   * Clear Redis
   */
  async clearRedis() {
    const redis = createRedisConnection();
    await redis.flushdb();
    await redis.quit();
  },

  /**
   * Full cleanup
   */
  async cleanup() {
    await this.clearQueues();
    await this.clearDatabase();
    await this.clearRedis();
  },

  /**
   * Create mock credential
   */
  async createMockCredential(overrides?: any) {
    const credential = new ThreadsCredential({
      userId: "user-123",
      threadsUserId: "threads-123",
      accessToken: "mock-access-token-" + Date.now(),
      refreshToken: "mock-refresh-token",
      expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      ...overrides,
    });
    return credential.save();
  },

  /**
   * Create mock post
   */
  async createMockPost(overrides?: any) {
    const post = new Post({
      content: "Test post content",
      postType: PostType.TEXT,
      status: PostStatus.DRAFT,
      ...overrides,
    });
    return post.save();
  },

  /**
   * Wait for job to complete
   */
  async waitForJobCompletion(
    jobId: string,
    maxWaitMs = 10000,
    pollIntervalMs = 100
  ) {
    const startTime = Date.now();

    while (Date.now() - startTime < maxWaitMs) {
      const job = await postQueue.getJob(jobId);

      if (!job) {
        return null;
      }

      const state = await job.getState();

      if (state === "completed") {
        return job.returnvalue;
      }

      if (state === "failed") {
        throw new Error(`Job ${jobId} failed: ${job.failedReason}`);
      }

      await new Promise((resolve) => setTimeout(resolve, pollIntervalMs));
    }

    throw new Error(`Job ${jobId} did not complete within ${maxWaitMs}ms`);
  },
};
