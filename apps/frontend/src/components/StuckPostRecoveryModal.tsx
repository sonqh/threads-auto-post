import React, { useEffect, useState } from "react";
import {
  AlertCircle,
  CheckCircle,
  Clock,
  RefreshCw,
  Zap,
  XCircle,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { Button } from "./ui/button";
import { postsApi } from "../lib/api";
import type { Post } from "@/types";

interface StuckPostRecoveryModalProps {
  post: Post;
  onClose: () => void;
  onRecovered: (post: Post) => void;
}

type RecoveryState = "checking" | "success" | "failed" | "stuck" | "syncing";

interface BackendCheckResult {
  postId: string;
  currentStatus: string;
  threadsPostId: string | null;
  publishedAt: Date | null;
  error: string | null;
  timeStuck: number; // milliseconds
}

export const StuckPostRecoveryModal: React.FC<StuckPostRecoveryModalProps> = ({
  post,
  onClose,
  onRecovered,
}) => {
  const [state, setState] = useState<RecoveryState>("checking");
  const [checkResult, setCheckResult] = useState<BackendCheckResult | null>(
    null
  );
  const [isRecovering, setIsRecovering] = useState(false);

  useEffect(() => {
    checkPostStatus();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [post._id]);

  const checkPostStatus = async () => {
    try {
      setState("checking");
      const result = await postsApi.getPost(post._id);

      const timeStuck = post.publishingProgress?.startedAt
        ? Date.now() - new Date(post.publishingProgress.startedAt).getTime()
        : 0;

      const checkResult: BackendCheckResult = {
        postId: post._id,
        currentStatus: result.status,
        threadsPostId: result.threadsPostId || null,
        publishedAt: result.publishedAt ? new Date(result.publishedAt) : null,
        error: result.error || null,
        timeStuck,
      };

      setCheckResult(checkResult);

      // Determine state based on backend check
      if (result.status === "PUBLISHED") {
        setState("success");
      } else if (result.status === "FAILED") {
        setState("failed");
      } else if (result.status === "PUBLISHING") {
        setState("stuck");
      }
    } catch (error) {
      console.error("Failed to check post status:", error);
      setState("stuck");
    }
  };

  const handleSync = async () => {
    if (!checkResult) return;

    try {
      setIsRecovering(true);
      setState("syncing");

      const result = await postsApi.fixStuckPost(post._id);
      onRecovered(result.post);
      setState("success");

      setTimeout(() => {
        onClose();
      }, 2000);
    } catch (error) {
      console.error("Failed to recover post:", error);
      setState("stuck");
    } finally {
      setIsRecovering(false);
    }
  };

  const handleRetry = async () => {
    if (!checkResult) return;

    try {
      setIsRecovering(true);
      setState("syncing");

      await postsApi.retryPost(post._id);
      // Refresh to get updated post
      const updatedPost = await postsApi.getPost(post._id);
      onRecovered(updatedPost);

      setTimeout(() => {
        onClose();
      }, 2000);
    } catch (error) {
      console.error("Failed to retry post:", error);
      setState("stuck");
    } finally {
      setIsRecovering(false);
    }
  };

  const handleRefresh = () => {
    checkPostStatus();
  };

  const formatTimeStuck = (ms: number) => {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);

    if (hours > 0) {
      return `${hours}h ${minutes % 60}m`;
    } else if (minutes > 0) {
      return `${minutes}m ${seconds % 60}s`;
    }
    return `${seconds}s`;
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <Card className="w-full max-w-2xl">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            {state === "checking" && (
              <>
                <Clock className="animate-spin text-blue-600" size={24} />
                Checking Post Status...
              </>
            )}
            {state === "success" && (
              <>
                <CheckCircle className="text-green-600" size={24} />
                Post Successfully Recovered
              </>
            )}
            {state === "failed" && (
              <>
                <XCircle className="text-red-600" size={24} />
                Post Publishing Failed
              </>
            )}
            {state === "stuck" && (
              <>
                <AlertCircle className="text-yellow-600" size={24} />
                Post Stuck - Recovery Options
              </>
            )}
            {state === "syncing" && (
              <>
                <RefreshCw className="animate-spin text-blue-600" size={24} />
                Recovering Post...
              </>
            )}
          </CardTitle>
        </CardHeader>

        <CardContent className="space-y-6">
          {/* Post Info */}
          <div className="bg-gray-50 p-4 rounded-lg space-y-2">
            <p className="text-sm font-semibold text-gray-700">Post Content</p>
            <p className="text-sm text-gray-600 line-clamp-2">{post.content}</p>
          </div>

          {/* Status Check Result */}
          {checkResult && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-blue-50 p-3 rounded-lg">
                  <p className="text-xs font-semibold text-blue-900">
                    Time Stuck
                  </p>
                  <p className="text-lg font-bold text-blue-700 mt-1">
                    {formatTimeStuck(checkResult.timeStuck)}
                  </p>
                </div>
                <div className="bg-gray-50 p-3 rounded-lg">
                  <p className="text-xs font-semibold text-gray-700">
                    Backend Status
                  </p>
                  <p className="text-lg font-bold text-gray-700 mt-1">
                    {checkResult.currentStatus}
                  </p>
                </div>
              </div>

              {/* Success State */}
              {state === "success" && (
                <div className="bg-green-50 border border-green-200 p-4 rounded-lg space-y-3">
                  <div className="flex items-start gap-3">
                    <CheckCircle className="text-green-600 flex-shrink-0 mt-0.5" />
                    <div>
                      <p className="font-semibold text-green-900">
                        Great News! 🎉
                      </p>
                      <p className="text-sm text-green-800 mt-1">
                        Your post was successfully published to Threads! The
                        loading indicator was just out of sync. We've updated
                        the status in our system.
                      </p>
                      {checkResult.publishedAt && (
                        <p className="text-xs text-green-700 mt-2">
                          Published at:{" "}
                          {new Date(checkResult.publishedAt).toLocaleString()}
                        </p>
                      )}
                      {checkResult.threadsPostId && (
                        <p className="text-xs text-green-700 mt-1">
                          Threads ID: {checkResult.threadsPostId}
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* Failed State */}
              {state === "failed" && (
                <div className="bg-red-50 border border-red-200 p-4 rounded-lg space-y-3">
                  <div className="flex items-start gap-3">
                    <XCircle className="text-red-600 flex-shrink-0 mt-0.5" />
                    <div>
                      <p className="font-semibold text-red-900">
                        Publishing Failed ❌
                      </p>
                      <p className="text-sm text-red-800 mt-1">
                        The post failed to publish to Threads. Here are your
                        recovery options:
                      </p>
                      {checkResult.error && (
                        <p className="text-xs text-red-700 mt-2 bg-white p-2 rounded border border-red-200">
                          Error: {checkResult.error}
                        </p>
                      )}
                      <div className="mt-3 text-sm text-red-800">
                        <p className="font-medium mb-2">You can:</p>
                        <ul className="list-disc list-inside space-y-1">
                          <li>Edit the post and try publishing again</li>
                          <li>Schedule it for a different time</li>
                          <li>Delete and create a new post</li>
                        </ul>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Stuck State */}
              {state === "stuck" && (
                <div className="bg-yellow-50 border border-yellow-200 p-4 rounded-lg space-y-3">
                  <div className="flex items-start gap-3">
                    <AlertCircle className="text-yellow-600 flex-shrink-0 mt-0.5" />
                    <div>
                      <p className="font-semibold text-yellow-900">
                        Post is Stuck ⏳
                      </p>
                      <p className="text-sm text-yellow-800 mt-1">
                        The post is still in publishing status. This could mean:
                      </p>
                      <div className="mt-3 text-sm text-yellow-800 bg-white p-2 rounded border border-yellow-200">
                        <ul className="list-disc list-inside space-y-1">
                          <li>The background worker stopped responding</li>
                          <li>Network connection was interrupted</li>
                          <li>
                            The publishing process is taking longer than
                            expected
                          </li>
                        </ul>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Syncing State */}
              {state === "syncing" && (
                <div className="bg-blue-50 border border-blue-200 p-4 rounded-lg flex items-center gap-3">
                  <RefreshCw className="text-blue-600 animate-spin flex-shrink-0" />
                  <p className="text-sm text-blue-800">
                    Recovering your post... Please wait.
                  </p>
                </div>
              )}
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex gap-3 justify-end border-t pt-6">
            {state === "checking" || state === "syncing" ? (
              <Button disabled className="gap-2">
                <Clock className="animate-spin" size={16} />
                Please wait...
              </Button>
            ) : state === "success" ? (
              <Button onClick={onClose} className="gap-2">
                <CheckCircle size={16} />
                Close
              </Button>
            ) : state === "failed" ? (
              <>
                <Button
                  onClick={handleRetry}
                  disabled={isRecovering}
                  className="gap-2"
                >
                  <RefreshCw size={16} />
                  Retry Publishing
                </Button>
                <Button onClick={onClose} variant="outline" className="gap-2">
                  Close
                </Button>
              </>
            ) : state === "stuck" ? (
              <>
                <Button
                  onClick={handleSync}
                  disabled={isRecovering}
                  className="gap-2 bg-yellow-600 hover:bg-yellow-700"
                >
                  <Zap size={16} />
                  Force Sync Status
                </Button>
                <Button
                  onClick={handleRefresh}
                  disabled={isRecovering}
                  variant="outline"
                  className="gap-2"
                >
                  <RefreshCw size={16} />
                  Re-check Status
                </Button>
                <Button onClick={onClose} variant="ghost" className="gap-2">
                  Close
                </Button>
              </>
            ) : null}
          </div>

          {/* Info Footer */}
          <div className="bg-gray-50 p-3 rounded-lg text-xs text-gray-600">
            <p>
              💡 <strong>Tip:</strong> This checker looks at your backend
              records to see the actual publishing status. If it shows
              published, we'll sync it instantly. If stuck, you can force a
              status update.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
