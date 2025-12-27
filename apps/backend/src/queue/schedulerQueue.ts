import { Queue } from "bullmq";
import { createRedisConnection } from "../config/redis.js";
import { log } from "../config/logger.js";

const connection = createRedisConnection();

/**
 * Dedicated queue for scheduler meta-jobs
 * This queue only manages the "check for due posts" job
 */
export const schedulerQueue = new Queue("scheduler-meta", {
  connection,
  defaultJobOptions: {
    attempts: 3,
    backoff: {
      type: "exponential",
      delay: 5000,
    },
    removeOnComplete: {
      count: 10,
      age: 3600, // 1 hour
    },
    removeOnFail: {
      count: 50,
    },
  },
});

/**
 * Redis keys for scheduler state
 */
export const SCHEDULER_KEYS = {
  NEXT_EXECUTION_AT: "scheduler:nextExecutionAt",
  ACTIVE_JOB_ID: "scheduler:activeJobId",
  LAST_CHECK: "scheduler:lastCheck",
} as const;

/**
 * Get the next execution timestamp from Redis
 */
export async function getNextExecutionAt(): Promise<number | null> {
  const value = await connection.get(SCHEDULER_KEYS.NEXT_EXECUTION_AT);
  return value ? parseInt(value, 10) : null;
}

/**
 * Set the next execution timestamp in Redis
 */
export async function setNextExecutionAt(timestamp: number): Promise<void> {
  await connection.set(SCHEDULER_KEYS.NEXT_EXECUTION_AT, timestamp.toString());
  log.info(
    `📅 Next scheduler run set for: ${new Date(timestamp).toISOString()}`
  );
}

/**
 * Get the active scheduler job ID
 */
export async function getActiveSchedulerJobId(): Promise<string | null> {
  return connection.get(SCHEDULER_KEYS.ACTIVE_JOB_ID);
}

/**
 * Set the active scheduler job ID
 */
export async function setActiveSchedulerJobId(jobId: string): Promise<void> {
  await connection.set(SCHEDULER_KEYS.ACTIVE_JOB_ID, jobId);
}

/**
 * Clear scheduler state
 */
export async function clearSchedulerState(): Promise<void> {
  await connection.del(SCHEDULER_KEYS.NEXT_EXECUTION_AT);
  await connection.del(SCHEDULER_KEYS.ACTIVE_JOB_ID);
  log.info("🧹 Scheduler state cleared");
}
