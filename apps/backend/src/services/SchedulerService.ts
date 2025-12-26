import { Post, PostStatus, SchedulePattern } from "../models/Post.js";
import { PostService } from "./PostService.js";
import { postQueue } from "../queue/postQueue.js";
import { logger } from "../config/logger.js";

export class SchedulerService {
  private postService: PostService;
  private isRunning = false;

  constructor() {
    this.postService = new PostService();
  }

  /**
   * Start the scheduler that checks for scheduled posts every minute
   */
  start(): void {
    if (this.isRunning) {
      logger.warn("Scheduler is already running");
      return;
    }

    this.isRunning = true;
    console.log("\n");
    console.log("╔════════════════════════════════════════════╗");
    console.log("║         🕐 SCHEDULER SERVICE STARTED        ║");
    console.log("║   Checking for scheduled posts every 60s   ║");
    console.log("╚════════════════════════════════════════════╝");
    console.log("\n");
    logger.info(
      "🕐 Scheduler started - checking for scheduled posts every 60 seconds"
    );

    // Run immediately on start
    this.processScheduledPosts().catch((error) => {
      logger.error("Error processing scheduled posts:", error);
    });

    // Then run every 60 seconds
    setInterval(() => {
      this.processScheduledPosts().catch((error) => {
        logger.error("Error processing scheduled posts:", error);
      });
    }, 60000); // 60 seconds
  }

  /**
   * Stop the scheduler
   */
  stop(): void {
    this.isRunning = false;
    logger.info("🛑 Scheduler stopped");
  }

  /**
   * Check for scheduled posts that are due and publish them
   */
  private async processScheduledPosts(): Promise<void> {
    try {
      const now = new Date();
      const timestamp = now.toISOString();

      console.log("\n" + "=".repeat(60));
      console.log(
        `[${timestamp}] 🔍 SCHEDULER RUN - Checking for due posts...`
      );
      console.log("=".repeat(60));

      // Find all posts with SCHEDULED status that are due
      const scheduledPosts = await Post.find({
        status: PostStatus.SCHEDULED,
        scheduledAt: { $lte: now },
      }).limit(10); // Process max 10 at a time

      // Also find upcoming scheduled posts for info
      const upcomingPosts = await Post.find({
        status: PostStatus.SCHEDULED,
        scheduledAt: { $gt: now },
      }).limit(5);

      console.log(`\n📊 DATABASE STATUS:`);
      console.log(
        `   Due now (scheduledAt <= ${now.toLocaleTimeString()}): ${
          scheduledPosts.length
        } post(s)`
      );
      console.log(
        `   Upcoming (scheduledAt > now): ${upcomingPosts.length} post(s)`
      );

      if (upcomingPosts.length > 0) {
        console.log(`\n⏳ Next scheduled posts:`);
        upcomingPosts.forEach((p, i) => {
          const waitTime = p.scheduledAt
            ? Math.ceil((p.scheduledAt.getTime() - now.getTime()) / 1000)
            : 0;
          console.log(`   ${i + 1}. "${p.content.substring(0, 40)}..."`);
          console.log(
            `       Scheduled: ${p.scheduledAt?.toISOString()} (UTC)`
          );
          console.log(`       Local: ${p.scheduledAt?.toLocaleString()}`);
          console.log(
            `       Wait time: ${waitTime}s (${Math.floor(
              waitTime / 3600
            )}h ${Math.floor((waitTime % 3600) / 60)}m)`
          );
        });
      }

      if (scheduledPosts.length === 0) {
        console.log(
          `\n✓ No posts due right now. Scheduler will check again in 60 seconds.`
        );
        console.log("=".repeat(60) + "\n");
        return;
      }

      console.log(`\n🎯 PROCESSING ${scheduledPosts.length} post(s):`);
      logger.info(
        `📋 Found ${scheduledPosts.length} scheduled post(s) to process`
      );

      for (const post of scheduledPosts) {
        try {
          // Determine if this is a recurring post
          const isRecurring =
            post.scheduleConfig?.pattern &&
            ["WEEKLY", "MONTHLY", "DATE_RANGE"].includes(
              post.scheduleConfig.pattern
            );

          const pattern = post.scheduleConfig?.pattern || "ONCE";
          const postPreview = post.content.substring(0, 40).replace(/\n/g, " ");

          console.log(`\n   📌 Post: ${post._id}`);
          console.log(`       Content: "${postPreview}..."`);
          console.log(`       Pattern: ${pattern}`);
          console.log(
            `       Scheduled: ${post.scheduledAt?.toLocaleString()}`
          );

          if (isRecurring) {
            // For recurring posts, calculate next run time and keep post SCHEDULED
            const nextRunTime = this.getNextScheduleTime(post.scheduleConfig!);

            if (nextRunTime <= now) {
              // Time to run
              console.log(
                `       ✅ DUE (recurring) - Next: ${nextRunTime.toLocaleString()}`
              );
              logger.info(
                `⏰ Publishing recurring post ${post._id} (${pattern})`
              );

              // Add to queue for publishing
              const jobId = `scheduled-${post._id}-${Date.now()}`;
              console.log(`       ⏳ Queuing... (jobId: ${jobId})`);
              await postQueue.add(
                "publish-post",
                { postId: post._id },
                { jobId }
              );

              // Update post with progress tracking
              post.jobId = jobId;
              post.status = PostStatus.PUBLISHING;
              post.publishingProgress = {
                status: "publishing",
                startedAt: new Date(),
                currentStep: "Queued for publishing (recurring)...",
              };

              // Update next scheduled time
              post.scheduledAt = nextRunTime;
              await post.save();
              console.log(
                `       ✅ Queued! Next run: ${nextRunTime.toLocaleString()}`
              );
            } else {
              console.log(
                `       ⏭️  Not due yet. Next: ${nextRunTime.toLocaleString()}`
              );
            }
          } else {
            // For one-time posts (ONCE), publish and mark as published
            console.log(`       ✅ DUE (one-time)`);
            logger.info(`⏰ Publishing one-time scheduled post ${post._id}`);

            // Add to queue for publishing
            const jobId = `scheduled-${post._id}-${Date.now()}`;
            console.log(`       ⏳ Queuing... (jobId: ${jobId})`);
            await postQueue.add(
              "publish-post",
              { postId: post._id },
              { jobId }
            );

            // Update post status to reflect it's queued with progress tracking
            post.jobId = jobId;
            post.status = PostStatus.PUBLISHING;
            post.publishingProgress = {
              status: "publishing",
              startedAt: new Date(),
              currentStep: "Queued for publishing...",
            };
            await post.save();
            console.log(`       ✅ Queued!`);
          }
        } catch (error) {
          console.log(`\n   ❌ ERROR Processing post ${post._id}:`, error);
          logger.error(`Failed to process scheduled post ${post._id}:`, error);
        }
      }

      console.log("\n" + "=".repeat(60) + "\n");
    } catch (error) {
      logger.error("Error in processScheduledPosts:", error);
      console.log("=".repeat(60) + "\n");
    }
  }

  /**
   * Calculate next run time for recurring schedule
   */
  private getNextScheduleTime(config: any): Date {
    const now = new Date();
    const nextRun = new Date(config.scheduledAt);
    const [hours, minutes] = (config.time || "09:00").split(":").map(Number);

    switch (config.pattern) {
      case SchedulePattern.ONCE:
        return config.scheduledAt;

      case SchedulePattern.WEEKLY: {
        const daysOfWeek = config.daysOfWeek || [1]; // Default: Monday
        // Find next occurrence in specified days of week
        nextRun.setDate(nextRun.getDate() + 1);
        while (!daysOfWeek.includes(nextRun.getDay())) {
          nextRun.setDate(nextRun.getDate() + 1);
        }
        nextRun.setHours(hours, minutes, 0, 0);
        return nextRun;
      }

      case SchedulePattern.MONTHLY: {
        const dayOfMonth = config.dayOfMonth || 1;
        nextRun.setMonth(nextRun.getMonth() + 1);
        nextRun.setDate(dayOfMonth);
        nextRun.setHours(hours, minutes, 0, 0);
        return nextRun;
      }

      case SchedulePattern.DATE_RANGE: {
        // Daily within date range
        const endDate = config.endDate ? new Date(config.endDate) : null;
        nextRun.setDate(nextRun.getDate() + 1);
        nextRun.setHours(hours, minutes, 0, 0);

        // If next run is past end date, return end date
        if (endDate && nextRun > endDate) {
          return endDate;
        }
        return nextRun;
      }

      default:
        return config.scheduledAt;
    }
  }
}

export const schedulerService = new SchedulerService();
