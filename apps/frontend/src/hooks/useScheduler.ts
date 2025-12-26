import { useState, useCallback, useEffect } from "react";
import { postsApi } from "../lib/api";

interface ScheduleConfig {
  pattern: "ONCE" | "WEEKLY" | "MONTHLY" | "DATE_RANGE";
  scheduledAt: string;
  daysOfWeek?: number[];
  dayOfMonth?: number;
  endDate?: string;
  time?: string;
}

interface PublishingProgress {
  status: "pending" | "publishing" | "published" | "failed";
  startedAt?: string | Date;
  completedAt?: string | Date;
  currentStep?: string;
  error?: string;
}

export const useScheduler = () => {
  const [scheduling, setScheduling] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const schedulePost = useCallback(
    async (postId: string, config: ScheduleConfig) => {
      setScheduling(true);
      setError(null);
      try {
        const result = await postsApi.schedulePost(postId, config);
        return result;
      } catch (err) {
        const message =
          err instanceof Error ? err.message : "Failed to schedule post";
        setError(message);
        throw err;
      } finally {
        setScheduling(false);
      }
    },
    []
  );

  return { schedulePost, scheduling, error };
};

export const usePublishingProgress = (postId: string, pollInterval = 1000) => {
  const [progress, setProgress] = useState<PublishingProgress | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const fetchProgress = async () => {
      setLoading(true);
      try {
        const result = await postsApi.getPublishingProgress(postId);
        setProgress(result as PublishingProgress);
        // Stop polling if completed or failed
        if (
          result?.status &&
          (result.status === "published" || result.status === "failed")
        ) {
          return; // Component will unmount or postId will change
        }
      } catch (err) {
        console.error("Failed to fetch progress:", err);
      } finally {
        setLoading(false);
      }
    };

    // Fetch immediately
    fetchProgress();

    // Then poll periodically
    const intervalId = setInterval(fetchProgress, pollInterval);

    return () => clearInterval(intervalId);
  }, [postId, pollInterval]);

  return { progress, loading };
};
