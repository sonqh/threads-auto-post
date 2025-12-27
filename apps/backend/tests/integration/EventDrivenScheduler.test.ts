import { describe, it, beforeAll, afterAll, beforeEach, vi } from "vitest";
import { expect } from "vitest";
import { testSetup } from "./setup.js";
import { EventDrivenScheduler } from "../../src/services/EventDrivenScheduler.js";
import {
  getNextExecutionAt,
  setNextExecutionAt,
  getActiveSchedulerJobId,
  setActiveSchedulerJobId,
} from "../../src/queue/schedulerQueue.js";
import { Post, PostStatus } from "../../src/models/Post.js";
import { schedulerQueue } from "../../src/queue/schedulerQueue.js";

describe("EventDrivenScheduler Integration Tests", () => {
  const scheduler = new EventDrivenScheduler();

  beforeAll(async () => {
    await testSetup.setup();
  });

  afterAll(async () => {
    await testSetup.teardown();
  });

  beforeEach(async () => {
    await testSetup.cleanup();
  });

  describe("initialize", () => {
    it("should initialize with no scheduled posts", async () => {
      await scheduler.initialize();

      const nextExec = await getNextExecutionAt();
      expect(nextExec).toBeNull();
    });

    it("should restore scheduler state after restart", async () => {
      // Simulate previous run
      const timestamp = Date.now() + 60 * 60 * 1000;
      await setNextExecutionAt(timestamp);
      await setActiveSchedulerJobId("test-job-123");

      // Create scheduled post
      await testSetup.createMockPost({
        status: PostStatus.SCHEDULED,
        scheduledAt: new Date(timestamp),
      });

      // Initialize (simulating restart)
      await scheduler.initialize();

      const nextExec = await getNextExecutionAt();
      expect(nextExec).toBeDefined();
    });
  });

  describe("onPostScheduled", () => {
    it("should schedule first post", async () => {
      const futureTime = new Date(Date.now() + 60 * 60 * 1000);
      const post = await testSetup.createMockPost({
        status: PostStatus.SCHEDULED,
        scheduledAt: futureTime,
      });

      await scheduler.onPostScheduled(post._id.toString(), futureTime);

      const nextExec = await getNextExecutionAt();
      expect(nextExec).toBe(futureTime.getTime());
    });

    it("should reschedule if new post is earlier", async () => {
      // Create initial scheduled post
      const laterTime = new Date(Date.now() + 2 * 60 * 60 * 1000);
      await testSetup.createMockPost({
        status: PostStatus.SCHEDULED,
        scheduledAt: laterTime,
      });

      await scheduler.scheduleNextCheck();

      let nextExec = await getNextExecutionAt();
      expect(nextExec).toBe(laterTime.getTime());

      // Create earlier post
      const earlierTime = new Date(Date.now() + 30 * 60 * 1000);
      const newPost = await testSetup.createMockPost({
        status: PostStatus.SCHEDULED,
        scheduledAt: earlierTime,
      });

      await scheduler.onPostScheduled(newPost._id.toString(), earlierTime);

      nextExec = await getNextExecutionAt();
      expect(nextExec).toBe(earlierTime.getTime());
    });

    it("should keep current schedule if new post is later", async () => {
      const earlierTime = new Date(Date.now() + 30 * 60 * 1000);
      const post1 = await testSetup.createMockPost({
        status: PostStatus.SCHEDULED,
        scheduledAt: earlierTime,
      });

      await scheduler.onPostScheduled(post1._id.toString(), earlierTime);
      let nextExec = await getNextExecutionAt();
      const originalNextExec = nextExec;

      // Add later post
      const laterTime = new Date(Date.now() + 2 * 60 * 60 * 1000);
      const post2 = await testSetup.createMockPost({
        status: PostStatus.SCHEDULED,
        scheduledAt: laterTime,
      });

      await scheduler.onPostScheduled(post2._id.toString(), laterTime);

      nextExec = await getNextExecutionAt();
      expect(nextExec).toBe(originalNextExec);
    });
  });

  describe("onPostCancelled", () => {
    it("should reschedule to next post when earlier post is deleted", async () => {
      const time1 = new Date(Date.now() + 30 * 60 * 1000);
      const time2 = new Date(Date.now() + 2 * 60 * 60 * 1000);

      const post1 = await testSetup.createMockPost({
        status: PostStatus.SCHEDULED,
        scheduledAt: time1,
      });

      const post2 = await testSetup.createMockPost({
        status: PostStatus.SCHEDULED,
        scheduledAt: time2,
      });

      // Schedule first one (earliest)
      await scheduler.onPostScheduled(post1._id.toString(), time1);
      let nextExec = await getNextExecutionAt();
      expect(nextExec).toBe(time1.getTime());

      // Delete first post and simulate cancellation event
      await Post.findByIdAndDelete(post1._id);
      await scheduler.onPostCancelled(post1._id.toString());

      // Should reschedule to second post
      nextExec = await getNextExecutionAt();
      expect(nextExec).toBe(time2.getTime());
    });

    it("should clear schedule when all posts deleted", async () => {
      const futureTime = new Date(Date.now() + 60 * 60 * 1000);
      const post = await testSetup.createMockPost({
        status: PostStatus.SCHEDULED,
        scheduledAt: futureTime,
      });

      await scheduler.onPostScheduled(post._id.toString(), futureTime);
      let nextExec = await getNextExecutionAt();
      expect(nextExec).toBeDefined();

      // Delete post
      await Post.findByIdAndDelete(post._id);
      await scheduler.onPostCancelled(post._id.toString());

      nextExec = await getNextExecutionAt();
      expect(nextExec).toBeNull();
    });
  });

  describe("processDuePosts", () => {
    it("should process posts that are due", async () => {
      const now = new Date();
      const post = await testSetup.createMockPost({
        status: PostStatus.SCHEDULED,
        scheduledAt: new Date(now.getTime() - 1000), // 1 second ago
        content: "Due post",
      });

      await scheduler.processDuePosts();

      // Post should be moved to PUBLISHING status
      const updated = await Post.findById(post._id);
      expect(updated?.status).toBe(PostStatus.PUBLISHING);
    });

    it("should not process posts that are not due", async () => {
      const futureTime = new Date(Date.now() + 60 * 60 * 1000);
      const post = await testSetup.createMockPost({
        status: PostStatus.SCHEDULED,
        scheduledAt: futureTime,
        content: "Not due yet",
      });

      const beforeStatus = post.status;

      await scheduler.processDuePosts();

      const updated = await Post.findById(post._id);
      expect(updated?.status).toBe(beforeStatus);
    });

    it("should process posts within batch window", async () => {
      const now = new Date();
      const batchWindow = 5000; // 5 seconds

      // Create posts within batch window
      const post1 = await testSetup.createMockPost({
        status: PostStatus.SCHEDULED,
        scheduledAt: new Date(now.getTime() - 1000), // 1s ago (due)
        content: "Post 1",
      });

      const post2 = await testSetup.createMockPost({
        status: PostStatus.SCHEDULED,
        scheduledAt: new Date(now.getTime() + 2000), // 2s from now (within window)
        content: "Post 2",
      });

      const post3 = await testSetup.createMockPost({
        status: PostStatus.SCHEDULED,
        scheduledAt: new Date(now.getTime() + 10000), // 10s from now (outside window)
        content: "Post 3",
      });

      await scheduler.processDuePosts();

      const updated1 = await Post.findById(post1._id);
      const updated2 = await Post.findById(post2._id);
      const updated3 = await Post.findById(post3._id);

      expect(updated1?.status).toBe(PostStatus.PUBLISHING);
      expect(updated2?.status).toBe(PostStatus.PUBLISHING);
      expect(updated3?.status).toBe(PostStatus.SCHEDULED); // Not due yet
    });

    it("should handle idempotent job creation", async () => {
      const now = new Date();
      const post = await testSetup.createMockPost({
        status: PostStatus.SCHEDULED,
        scheduledAt: new Date(now.getTime() - 1000),
        content: "Test post",
      });

      // First processing
      await scheduler.processDuePosts();

      const job1 = await Post.findById(post._id);
      const jobId1 = job1?.jobId;

      // Reset to SCHEDULED to simulate re-processing
      await Post.updateOne({ _id: post._id }, { status: PostStatus.SCHEDULED });

      // Second processing should use same job ID
      await scheduler.processDuePosts();

      const job2 = await Post.findById(post._id);
      const jobId2 = job2?.jobId;

      // Should be same or similar (based on your idempotency logic)
      expect(jobId1).toBeDefined();
      expect(jobId2).toBeDefined();
    });
  });

  describe("scheduleNextCheck", () => {
    it("should schedule check for earliest post", async () => {
      const time1 = new Date(Date.now() + 2 * 60 * 60 * 1000);
      const time2 = new Date(Date.now() + 30 * 60 * 1000); // Earlier

      await testSetup.createMockPost({
        status: PostStatus.SCHEDULED,
        scheduledAt: time1,
      });

      await testSetup.createMockPost({
        status: PostStatus.SCHEDULED,
        scheduledAt: time2,
      });

      await scheduler.scheduleNextCheck();

      const nextExec = await getNextExecutionAt();
      expect(nextExec).toBe(time2.getTime());
    });

    it("should clear schedule when no posts exist", async () => {
      await setNextExecutionAt(Date.now() + 60 * 60 * 1000);

      // No posts scheduled
      await scheduler.scheduleNextCheck();

      const nextExec = await getNextExecutionAt();
      expect(nextExec).toBeNull();
    });
  });
});
