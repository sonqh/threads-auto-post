import { Router } from "express";
import { PostService } from "../services/PostService.js";
import { monitoringService } from "../services/MonitoringService.js";
import { Post } from "../models/Post.js";
import type { ScheduleConfig, IPost } from "../models/Post.js";

const router = Router();
const postService = new PostService();

// Get all posts
router.get("/", async (req, res) => {
  try {
    const { status, limit = 50, skip = 0 } = req.query;
    const options = {
      status: status as string | undefined,
      limit: Number(limit),
      skip: Number(skip),
    };
    const result = await postService.getPosts(options);
    res.json({
      posts: result.posts,
      total: result.total,
      limit: options.limit,
      skip: options.skip,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    res.status(500).json({ error: message });
  }
});

// Get single post
router.get("/:id", async (req, res) => {
  try {
    const post = await postService.getPost(req.params.id);
    if (!post) {
      return res.status(404).json({ error: "Post not found" });
    }
    res.json(post);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    res.status(500).json({ error: message });
  }
});

// Create post
router.post("/", async (req, res) => {
  try {
    const post = await postService.createPost(req.body);
    res.status(201).json(post);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    res.status(400).json({ error: message });
  }
});

// Update post
router.put("/:id", async (req, res) => {
  try {
    const post = await postService.updatePost(req.params.id, req.body);
    res.json(post);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    res.status(400).json({ error: message });
  }
});

// Delete post
router.delete("/:id", async (req, res) => {
  try {
    await postService.deletePost(req.params.id);
    res.json({ message: "Post deleted successfully" });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    res.status(500).json({ error: message });
  }
});

// Bulk delete posts
router.post("/bulk-delete", async (req, res) => {
  try {
    const { ids } = req.body;
    if (!ids || !Array.isArray(ids)) {
      return res.status(400).json({ error: "ids array is required" });
    }
    await postService.bulkDelete(ids);
    res.json({ message: "Posts deleted successfully" });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    res.status(500).json({ error: message });
  }
});

// Publish post to Threads
router.post("/:id/publish", async (req, res) => {
  try {
    const post = await postService.publishPost(req.params.id);
    res.json(post);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    res.status(400).json({ error: message });
  }
});

// Get publishing progress
router.get("/:id/progress", async (req, res) => {
  try {
    const progress = await postService.getPublishingProgress(req.params.id);
    res.json(progress || { status: "idle" });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    res.status(404).json({ error: message });
  }
});

// Schedule post with flexible patterns
// Body: { pattern: "ONCE" | "WEEKLY" | "MONTHLY" | "DATE_RANGE", scheduledAt, daysOfWeek?, dayOfMonth?, endDate?, time? }
router.post("/:id/schedule", async (req, res) => {
  try {
    const postId = req.params.id;
    const { pattern, scheduledAt, daysOfWeek, dayOfMonth, endDate, time } =
      req.body;

    console.log(`\n📅 SCHEDULE REQUEST RECEIVED:`);
    console.log(`   Post ID: ${postId}`);
    console.log(`   Pattern: ${pattern}`);
    console.log(`   Scheduled At: ${scheduledAt}`);
    console.log(`   Time: ${time}`);
    console.log(`   Days of Week: ${daysOfWeek || "N/A"}`);

    if (!pattern || !scheduledAt) {
      console.log(`❌ Invalid request: missing pattern or scheduledAt`);
      return res
        .status(400)
        .json({ error: "pattern and scheduledAt are required" });
    }

    // Validate pattern
    const validPatterns = ["ONCE", "WEEKLY", "MONTHLY", "DATE_RANGE"];
    if (!validPatterns.includes(pattern)) {
      console.log(`❌ Invalid pattern: ${pattern}`);
      return res.status(400).json({
        error: `Invalid pattern. Must be one of: ${validPatterns.join(", ")}`,
      });
    }

    const scheduledDate = new Date(scheduledAt);
    if (isNaN(scheduledDate.getTime())) {
      console.log(`❌ Invalid date format: ${scheduledAt}`);
      return res.status(400).json({ error: "Invalid scheduledAt date format" });
    }

    console.log(`   Parsed Date: ${scheduledDate.toISOString()}`);
    console.log(`   Now: ${new Date().toISOString()}`);
    console.log(`   Is Future: ${scheduledDate > new Date()}`);

    if (scheduledDate <= new Date() && pattern === "ONCE") {
      console.log(`❌ ONCE pattern requires future date`);
      return res
        .status(400)
        .json({ error: "Scheduled time must be in the future" });
    }

    const scheduleConfig: ScheduleConfig = {
      pattern,
      scheduledAt: scheduledDate,
      daysOfWeek,
      dayOfMonth,
      endDate: endDate ? new Date(endDate) : undefined,
      time: time || "09:00",
    };

    const post = await postService.schedulePost(req.params.id, scheduleConfig);
    console.log(`✅ Post scheduled successfully`);
    console.log(`   Updated Status: ${post.status}`);
    console.log(`   Job ID: ${post.jobId || "Not set yet"}`);
    res.json(post);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error(`❌ Schedule error: ${message}`, req.body);
    res.status(400).json({ error: message });
  }
});

// Cancel scheduled post
router.post("/:id/cancel", async (req, res) => {
  try {
    const post = await postService.cancelSchedule(req.params.id);
    res.json(post);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    res.status(500).json({ error: message });
  }
});

// ============================================
// Job Monitoring Endpoints
// ============================================

// Get queue statistics
router.get("/monitoring/stats", async (req, res) => {
  try {
    const stats = await monitoringService.getQueueStats();
    res.json(stats);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    res.status(500).json({ error: message });
  }
});

// Get queue health
router.get("/monitoring/health", async (req, res) => {
  try {
    const health = await monitoringService.getQueueHealth();
    res.json(health);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    res.status(500).json({ error: message });
  }
});

// Get recent jobs
router.get("/monitoring/jobs/recent", async (req, res) => {
  try {
    const limit = Math.min(Number(req.query.limit) || 50, 100);
    const jobs = await monitoringService.getRecentJobs(limit);
    res.json(jobs);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    res.status(500).json({ error: message });
  }
});

// Get jobs by state
router.get("/monitoring/jobs/state/:state", async (req, res) => {
  try {
    const state = req.params.state as
      | "active"
      | "completed"
      | "failed"
      | "delayed"
      | "waiting";
    const validStates = ["active", "completed", "failed", "delayed", "waiting"];
    if (!validStates.includes(state)) {
      return res.status(400).json({ error: "Invalid state" });
    }
    const limit = Math.min(Number(req.query.limit) || 20, 100);
    const jobs = await monitoringService.getJobsByState(state, limit);
    res.json(jobs);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    res.status(500).json({ error: message });
  }
});

// Get specific job details
router.get("/monitoring/jobs/:jobId", async (req, res) => {
  try {
    const job = await monitoringService.getJobDetails(req.params.jobId);
    if (!job) {
      return res.status(404).json({ error: "Job not found" });
    }
    res.json(job);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    res.status(500).json({ error: message });
  }
});

// Debug: Check scheduler status and SCHEDULED posts
router.get("/debug/scheduler-status", async (req, res) => {
  try {
    const scheduledPosts = await Post.find({ status: "SCHEDULED" }).limit(5);
    const now = new Date();

    const postsInfo = scheduledPosts.map((post: IPost) => {
      const scheduledTime = post.scheduledAt;
      const isDue = scheduledTime && scheduledTime <= now;
      const timeDiff = scheduledTime
        ? scheduledTime.getTime() - now.getTime()
        : 0;
      const secondsDiff = Math.floor(timeDiff / 1000);

      return {
        id: post._id,
        content: post.content.substring(0, 50),
        scheduledAt: {
          iso: scheduledTime?.toISOString(),
          local: scheduledTime?.toLocaleString(),
        },
        isDue,
        timeDiffSeconds: secondsDiff,
        timeDiffFormatted: isDue
          ? `${Math.abs(secondsDiff)}s ago`
          : `in ${Math.floor(secondsDiff / 3600)}h ${Math.floor(
              (secondsDiff % 3600) / 60
            )}m`,
        pattern: post.scheduleConfig?.pattern || "ONCE",
      };
    });

    res.json({
      schedulerMessage: "Current scheduled posts status",
      totalScheduledPosts: scheduledPosts.length,
      now: {
        iso: now.toISOString(),
        local: now.toLocaleString(),
      },
      posts: postsInfo,
      instructions: [
        "✓ isDue = true: Post should be published immediately",
        "✓ isDue = false: Post is waiting for its scheduled time",
        "✓ Check timeDiffFormatted to see how long until it runs",
      ],
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    res.status(500).json({ error: message });
  }
});

export default router;
