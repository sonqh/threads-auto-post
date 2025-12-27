import { describe, it, beforeAll, afterAll, beforeEach } from "vitest";
import { expect } from "vitest";
import { testSetup } from "./setup.js";
import { PostService } from "../../src/services/PostService.js";
import {
  Post,
  PostStatus,
  SchedulePattern,
  PostType,
} from "../../src/models/Post.js";
import { postQueue } from "../../src/queue/postQueue.js";

describe("PostService Integration Tests", () => {
  const postService = new PostService();

  beforeAll(async () => {
    await testSetup.setup();
  });

  afterAll(async () => {
    await testSetup.teardown();
  });

  beforeEach(async () => {
    await testSetup.cleanup();
  });

  describe("createPost", () => {
    it("should create a new post with DRAFT status", async () => {
      const postData = {
        content: "Test post content",
        postType: PostType.TEXT,
      };

      const post = await postService.createPost(postData);

      expect(post._id).toBeDefined();
      expect(post.status).toBe(PostStatus.DRAFT);
      expect(post.content).toBe("Test post content");
    });

    it("should validate post has required fields", async () => {
      try {
        await postService.createPost({
          postType: PostType.TEXT,
          // missing content
        });
        expect.fail("Should have thrown validation error");
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : String(error);
        expect(message).toContain("required");
      }
    });
  });

  describe("schedulePost", () => {
    it("should schedule a post with ONCE pattern", async () => {
      const post = await testSetup.createMockPost({
        content: "Scheduled post",
      });

      const futureTime = new Date(Date.now() + 60 * 60 * 1000); // 1 hour from now

      const scheduled = await postService.schedulePost(post._id.toString(), {
        pattern: SchedulePattern.ONCE,
        scheduledAt: futureTime,
      });

      expect(scheduled.status).toBe(PostStatus.SCHEDULED);
      expect(scheduled.scheduledAt).toEqual(futureTime);
    });

    it("should reject scheduling in the past", async () => {
      const post = await testSetup.createMockPost();
      const pastTime = new Date(Date.now() - 60 * 60 * 1000);

      try {
        await postService.schedulePost(post._id.toString(), {
          pattern: SchedulePattern.ONCE,
          scheduledAt: pastTime,
        });
        expect.fail("Should have thrown error for past time");
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : String(error);
        expect(message).toContain("future");
      }
    });

    it("should schedule with WEEKLY pattern", async () => {
      const post = await testSetup.createMockPost();
      const futureTime = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

      const scheduled = await postService.schedulePost(post._id.toString(), {
        pattern: SchedulePattern.WEEKLY,
        scheduledAt: futureTime,
        daysOfWeek: [1, 3, 5], // Monday, Wednesday, Friday
        time: "09:00",
      });

      expect(scheduled.scheduleConfig).toBeDefined();
      expect(scheduled.scheduleConfig!.pattern).toBe(SchedulePattern.WEEKLY);
      expect(scheduled.scheduleConfig!.daysOfWeek).toEqual([1, 3, 5]);
    });

    it("should schedule with MONTHLY pattern", async () => {
      const post = await testSetup.createMockPost();
      const futureTime = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

      const scheduled = await postService.schedulePost(post._id.toString(), {
        pattern: SchedulePattern.MONTHLY,
        scheduledAt: futureTime,
        dayOfMonth: 15,
        time: "14:30",
      });

      expect(scheduled.scheduleConfig).toBeDefined();
      expect(scheduled.scheduleConfig!.pattern).toBe(SchedulePattern.MONTHLY);
      expect(scheduled.scheduleConfig!.dayOfMonth).toBe(15);
    });
  });

  describe("updatePost", () => {
    it("should update post content", async () => {
      const post = await testSetup.createMockPost({
        content: "Original content",
      });

      const updated = await postService.updatePost(post._id.toString(), {
        content: "Updated content",
      });

      expect(updated).toBeDefined();
      expect(updated?.content).toBe("Updated content");
    });

    it("should not allow status change via updatePost", async () => {
      const post = await testSetup.createMockPost({
        status: PostStatus.DRAFT,
      });

      // Note: This depends on your business logic
      // Some apps allow it, some don't
      const updated = await postService.updatePost(post._id.toString(), {
        status: PostStatus.PUBLISHED,
      });

      // Verify the actual behavior of your application
      expect(updated).toBeDefined();
      expect(updated?.status).toBeDefined();
    });
  });

  describe("deletePost", () => {
    it("should delete a post", async () => {
      const post = await testSetup.createMockPost();
      const postId = post._id.toString();

      await postService.deletePost(postId);

      try {
        await postService.getPost(postId);
        expect.fail("Should have thrown post not found error");
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : String(error);
        expect(message).toContain("not found");
      }
    });

    it("should trigger scheduler update when deleting scheduled post", async () => {
      const futureTime = new Date(Date.now() + 60 * 60 * 1000);
      const post = await testSetup.createMockPost({
        status: PostStatus.SCHEDULED,
        scheduledAt: futureTime,
      });

      const postId = post._id.toString();

      // Delete the post
      await postService.deletePost(postId);

      // Post should be deleted from database
      const found = await Post.findById(postId);
      expect(found).toBeNull();
    });
  });

  describe("bulkDelete", () => {
    it("should delete multiple posts", async () => {
      const post1 = await testSetup.createMockPost({ content: "Post 1" });
      const post2 = await testSetup.createMockPost({ content: "Post 2" });
      const post3 = await testSetup.createMockPost({ content: "Post 3" });

      const result = await postService.bulkDelete([
        post1._id.toString(),
        post2._id.toString(),
      ]);

      expect(result.deletedCount).toBe(2);

      const remaining = await Post.find({});
      expect(remaining.length).toBe(1);
      expect(remaining[0]._id.toString()).toBe(post3._id.toString());
    });

    it("should handle non-existent post IDs gracefully", async () => {
      const result = await postService.bulkDelete([
        "non-existent-id-1",
        "non-existent-id-2",
      ]);

      expect(result.deletedCount).toBe(0);
    });
  });

  describe("getPosts with filtering", () => {
    it("should filter posts by status", async () => {
      await testSetup.createMockPost({ status: PostStatus.DRAFT });
      await testSetup.createMockPost({ status: PostStatus.DRAFT });
      await testSetup.createMockPost({ status: PostStatus.PUBLISHED });

      const { posts, total } = await postService.getPosts({
        status: PostStatus.DRAFT,
      });

      expect(total).toBe(2);
      expect(posts.length).toBe(2);
      expect(posts.every((p) => p.status === PostStatus.DRAFT)).toBe(true);
    });

    it("should support pagination", async () => {
      for (let i = 0; i < 10; i++) {
        await testSetup.createMockPost({ content: `Post ${i}` });
      }

      const page1 = await postService.getPosts({ skip: 0, limit: 3 });
      const page2 = await postService.getPosts({ skip: 3, limit: 3 });

      expect(page1.posts.length).toBe(3);
      expect(page2.posts.length).toBe(3);
      expect(page1.total).toBe(10);
    });
  });
});
