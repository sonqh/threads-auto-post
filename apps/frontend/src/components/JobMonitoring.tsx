import React, { useEffect, useState, useCallback } from "react";
import {
  RefreshCw,
  AlertCircle,
  CheckCircle,
  Clock,
  Zap,
  RotateCcw,
  X,
  ChevronRight,
  Filter,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { Button } from "./ui/button";
import { monitoringApi, postsApi } from "../lib/api";

interface JobRecord {
  id: string;
  name: string;
  state: string;
  data: Record<string, unknown>;
  progress?: number;
  returnvalue?: unknown;
  failedReason?: string;
  attemptsMade: number;
  maxAttempts: number;
  timestamp?: number;
  processedOn?: number;
  finishedOn?: number;
}

interface RecentJobsData {
  active: JobRecord[];
  completed: JobRecord[];
  failed: JobRecord[];
  delayed: JobRecord[];
}

interface HealthData {
  status: "healthy" | "degraded" | "unhealthy";
  stats: {
    totalJobs: number;
    activeJobs: number;
    completedJobs: number;
    failedJobs: number;
    delayedJobs: number;
    waitingJobs: number;
  };
  healthScore: number;
  lastCompletedJob?: { id: string; timestamp: number };
  failureRate: number;
}

interface StatsData {
  totalJobs: number;
  activeJobs: number;
  completedJobs: number;
  failedJobs: number;
  delayedJobs: number;
  waitingJobs: number;
}

interface JobDetailsModalProps {
  job: JobRecord;
  onClose: () => void;
  onRetry?: (postId: string) => void;
  onCancel?: (jobId: string) => void;
}

// Job Details Modal Component
const JobDetailsModal: React.FC<JobDetailsModalProps> = ({
  job,
  onClose,
  onRetry,
}) => {
  const postData = job.data as { postId?: string; content?: string };
  const postId = postData.postId;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <Card className="w-full max-w-2xl max-h-96 overflow-y-auto">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Job Details</CardTitle>
          <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded">
            <X size={20} />
          </button>
        </CardHeader>

        <CardContent className="space-y-4">
          {/* Job Metadata */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-xs font-semibold text-muted-foreground">
                Job ID
              </p>
              <p className="font-mono text-sm break-all">{job.id}</p>
            </div>
            <div>
              <p className="text-xs font-semibold text-muted-foreground">
                Status
              </p>
              <p className="text-sm capitalize">
                <span
                  className={`inline-block px-2 py-1 rounded text-xs font-semibold ${
                    job.state === "active"
                      ? "bg-blue-100 text-blue-700"
                      : job.state === "completed"
                      ? "bg-green-100 text-green-700"
                      : job.state === "failed"
                      ? "bg-red-100 text-red-700"
                      : "bg-yellow-100 text-yellow-700"
                  }`}
                >
                  {job.state}
                </span>
              </p>
            </div>
            <div>
              <p className="text-xs font-semibold text-muted-foreground">
                Job Name
              </p>
              <p className="text-sm">{job.name}</p>
            </div>
            <div>
              <p className="text-xs font-semibold text-muted-foreground">
                Progress
              </p>
              <p className="text-sm">{job.progress || 0}%</p>
            </div>
          </div>

          {/* Timing Info */}
          <div className="border-t pt-4 grid grid-cols-3 gap-4">
            {job.timestamp && (
              <div>
                <p className="text-xs font-semibold text-muted-foreground">
                  Scheduled
                </p>
                <p className="text-sm">
                  {new Date(job.timestamp).toLocaleString()}
                </p>
              </div>
            )}
            {job.processedOn && (
              <div>
                <p className="text-xs font-semibold text-muted-foreground">
                  Started
                </p>
                <p className="text-sm">
                  {new Date(job.processedOn).toLocaleString()}
                </p>
              </div>
            )}
            {job.finishedOn && (
              <div>
                <p className="text-xs font-semibold text-muted-foreground">
                  Completed
                </p>
                <p className="text-sm">
                  {new Date(job.finishedOn).toLocaleString()}
                </p>
              </div>
            )}
          </div>

          {/* Retry Info */}
          <div className="border-t pt-4">
            <p className="text-xs font-semibold text-muted-foreground mb-2">
              Retry Information
            </p>
            <div className="flex items-center gap-4">
              <div>
                <p className="text-sm">
                  Attempts: {job.attemptsMade} / {job.maxAttempts}
                </p>
                <div className="w-32 h-2 bg-gray-200 rounded-full mt-1">
                  <div
                    className="h-2 bg-blue-500 rounded-full"
                    style={{
                      width: `${(job.attemptsMade / job.maxAttempts) * 100}%`,
                    }}
                  ></div>
                </div>
              </div>
            </div>
          </div>

          {/* Error Details */}
          {job.failedReason && (
            <div className="border-t pt-4 bg-red-50 p-3 rounded">
              <p className="text-xs font-semibold text-red-900 mb-2">Error</p>
              <p className="text-sm text-red-800 break-words font-mono">
                {job.failedReason}
              </p>
            </div>
          )}

          {/* Post Data */}
          <div className="border-t pt-4">
            <p className="text-xs font-semibold text-muted-foreground mb-2">
              Post Data
            </p>
            <div className="bg-gray-50 p-3 rounded font-mono text-xs break-all max-h-24 overflow-y-auto">
              {postData.content ? (
                <div>
                  <p className="font-semibold mb-1">Content:</p>
                  <p>{postData.content}</p>
                </div>
              ) : (
                <p className="text-muted-foreground">No content preview</p>
              )}
            </div>
          </div>

          {/* Actions */}
          <div className="border-t pt-4 flex gap-2">
            {postId && job.state === "failed" && onRetry && (
              <Button
                size="sm"
                onClick={() => onRetry(postId)}
                className="gap-1"
              >
                <RotateCcw size={14} />
                Retry
              </Button>
            )}
            <Button
              size="sm"
              variant="outline"
              onClick={onClose}
              className="ml-auto"
            >
              Close
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export const JobMonitoring: React.FC = () => {
  const [health, setHealth] = useState<HealthData | null>(null);
  const [stats, setStats] = useState<StatsData | null>(null);
  const [recentJobs, setRecentJobs] = useState<RecentJobsData | null>(null);
  const [loading, setLoading] = useState(false);
  const [retrying, setRetrying] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [activeTab, setActiveTab] = useState<
    "overview" | "active" | "scheduled" | "completed" | "failed"
  >("overview");
  const [selectedJob, setSelectedJob] = useState<JobRecord | null>(null);
  const [showFilters, setShowFilters] = useState(false);

  const fetchMonitoringData = useCallback(async () => {
    try {
      setLoading(true);
      const [healthData, statsData, jobsData] = await Promise.all([
        monitoringApi.getQueueHealth(),
        monitoringApi.getQueueStats(),
        monitoringApi.getRecentJobs(30),
      ]);
      setHealth(healthData);
      setStats(statsData);
      setRecentJobs(jobsData);
      setLastUpdated(new Date());
    } catch (error) {
      console.error("Failed to fetch monitoring data:", error);
    } finally {
      setLoading(false);
    }
  }, []);

  const handleRetry = async (postId: string) => {
    try {
      setRetrying(postId);
      await postsApi.retryPost(postId);
      // Refresh monitoring data after retry
      await fetchMonitoringData();
      setSelectedJob(null);
    } catch (error) {
      console.error("Failed to retry post:", error);
      alert("Failed to retry post. Please try again.");
    } finally {
      setRetrying(null);
    }
  };

  useEffect(() => {
    fetchMonitoringData();
    const interval = setInterval(fetchMonitoringData, 10000);
    return () => clearInterval(interval);
  }, [fetchMonitoringData]);

  const getHealthColor = (status: string): string => {
    switch (status) {
      case "healthy":
        return "text-green-600 bg-green-50";
      case "degraded":
        return "text-yellow-600 bg-yellow-50";
      case "unhealthy":
        return "text-red-600 bg-red-50";
      default:
        return "text-gray-600 bg-gray-50";
    }
  };

  const getJobStatusBadge = (state: string) => {
    switch (state) {
      case "active":
        return "bg-blue-100 text-blue-700";
      case "completed":
        return "bg-green-100 text-green-700";
      case "failed":
        return "bg-red-100 text-red-700";
      case "delayed":
        return "bg-yellow-100 text-yellow-700";
      default:
        return "bg-gray-100 text-gray-700";
    }
  };

  const JobRow: React.FC<{ job: JobRecord }> = ({ job }) => {
    const postData = job.data as { postId?: string; content?: string };
    const contentPreview = postData.content
      ? postData.content.length > 50
        ? postData.content.substring(0, 50) + "..."
        : postData.content
      : "No content";

    return (
      <div
        className="p-3 border rounded-lg hover:bg-gray-50 cursor-pointer transition-colors flex items-center justify-between group"
        onClick={() => setSelectedJob(job)}
      >
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span
              className={`inline-block px-2 py-0.5 rounded text-xs font-semibold ${getJobStatusBadge(
                job.state
              )}`}
            >
              {job.state}
            </span>
            <p className="font-medium text-sm truncate">{job.id}</p>
          </div>
          <p className="text-xs text-muted-foreground truncate">
            {contentPreview}
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            {job.attemptsMade > 0 &&
              `Attempt ${job.attemptsMade}/${job.maxAttempts}`}
            {job.timestamp &&
              ` • ${new Date(job.timestamp).toLocaleTimeString()}`}
          </p>
        </div>

        <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity ml-2">
          <ChevronRight size={16} className="text-muted-foreground" />
        </div>
      </div>
    );
  };

  if (!health || !stats) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Job Queue Control Center</CardTitle>
        </CardHeader>
        <CardContent className="flex items-center justify-center py-12">
          <div className="text-center text-muted-foreground">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900 mx-auto mb-4"></div>
            Loading monitoring data...
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Job Queue Control Center</h1>
          <p className="text-sm text-muted-foreground mt-2">
            Observe and manage all background jobs in one place
          </p>
          {lastUpdated && (
            <p className="text-xs text-muted-foreground mt-1">
              Last updated: {lastUpdated.toLocaleTimeString()}
            </p>
          )}
        </div>
        <div className="flex gap-2">
          <Button
            onClick={() => setShowFilters(!showFilters)}
            variant="outline"
            size="sm"
            className="gap-1"
          >
            <Filter size={16} />
            Filters
          </Button>
          <Button
            onClick={fetchMonitoringData}
            disabled={loading}
            size="sm"
            variant="outline"
            className="gap-2"
          >
            <RefreshCw size={16} className={loading ? "animate-spin" : ""} />
            Refresh
          </Button>
        </div>
      </div>

      {/* System Health */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">System Health</CardTitle>
        </CardHeader>
        <CardContent>
          <div
            className={`rounded-lg p-6 flex items-center gap-4 ${getHealthColor(
              health.status
            )}`}
          >
            {health.status === "healthy" && (
              <CheckCircle size={32} className="flex-shrink-0" />
            )}
            {health.status !== "healthy" && (
              <AlertCircle size={32} className="flex-shrink-0" />
            )}
            <div className="flex-1">
              <p className="font-semibold capitalize">{health.status} Status</p>
              <p className="text-sm opacity-75">
                Health Score: {health.healthScore}% | Failure Rate:{" "}
                {health.failureRate}%
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Quick Stats Grid */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="text-center">
              <div className="text-2xl font-bold text-blue-600">
                {stats.totalJobs}
              </div>
              <div className="text-sm text-muted-foreground mt-1">
                Total Jobs
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="text-center">
              <div className="text-2xl font-bold text-blue-500 flex items-center justify-center gap-2">
                <Zap size={20} />
                {stats.activeJobs}
              </div>
              <div className="text-sm text-muted-foreground mt-1">Active</div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="text-center">
              <div className="text-2xl font-bold text-green-600 flex items-center justify-center gap-2">
                <CheckCircle size={20} />
                {stats.completedJobs}
              </div>
              <div className="text-sm text-muted-foreground mt-1">
                Completed
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="text-center">
              <div className="text-2xl font-bold text-red-600">
                {stats.failedJobs}
              </div>
              <div className="text-sm text-muted-foreground mt-1">Failed</div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="text-center">
              <div className="text-2xl font-bold text-yellow-600 flex items-center justify-center gap-2">
                <Clock size={20} />
                {stats.delayedJobs + stats.waitingJobs}
              </div>
              <div className="text-sm text-muted-foreground mt-1">Pending</div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Jobs Tabs */}
      <Card>
        <CardHeader>
          <div className="flex gap-2 border-b overflow-x-auto">
            {(
              [
                "overview",
                "active",
                "scheduled",
                "completed",
                "failed",
              ] as const
            ).map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
                  activeTab === tab
                    ? "border-blue-600 text-blue-600"
                    : "border-transparent text-muted-foreground hover:text-foreground"
                }`}
              >
                {tab === "overview" && "Overview"}
                {tab === "active" &&
                  `Running (${recentJobs?.active?.length || 0})`}
                {tab === "scheduled" &&
                  `Scheduled (${recentJobs?.delayed?.length || 0})`}
                {tab === "completed" &&
                  `Completed (${recentJobs?.completed?.length || 0})`}
                {tab === "failed" &&
                  `Failed (${recentJobs?.failed?.length || 0})`}
              </button>
            ))}
          </div>
        </CardHeader>

        <CardContent className="pt-6">
          {/* Overview Tab */}
          {activeTab === "overview" && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Queue Health */}
                <div className="p-4 bg-gradient-to-br from-blue-50 to-blue-100 rounded-lg">
                  <p className="text-sm font-medium text-blue-900 mb-2">
                    Queue Health
                  </p>
                  <div className="flex items-center gap-3">
                    <div className="flex-1">
                      <div className="w-full bg-blue-200 rounded-full h-3">
                        <div
                          className={`h-3 rounded-full transition-all ${
                            health.healthScore >= 80
                              ? "bg-green-500"
                              : health.healthScore >= 50
                              ? "bg-yellow-500"
                              : "bg-red-500"
                          }`}
                          style={{ width: `${health.healthScore}%` }}
                        ></div>
                      </div>
                    </div>
                    <span className="text-lg font-bold text-blue-900">
                      {health.healthScore}%
                    </span>
                  </div>
                </div>

                {/* Failure Rate */}
                <div className="p-4 bg-gradient-to-br from-red-50 to-red-100 rounded-lg">
                  <p className="text-sm font-medium text-red-900 mb-2">
                    Failure Rate
                  </p>
                  <div className="text-2xl font-bold text-red-700">
                    {health.failureRate.toFixed(2)}%
                  </div>
                  {health.lastCompletedJob && (
                    <p className="text-xs text-red-700 mt-2">
                      Last completed:{" "}
                      {new Date(
                        health.lastCompletedJob.timestamp
                      ).toLocaleTimeString()}
                    </p>
                  )}
                </div>
              </div>

              {/* Quick Actions */}
              <div className="p-4 bg-gray-50 rounded-lg border border-gray-200">
                <p className="text-sm font-medium text-gray-700 mb-3">
                  Quick Actions
                </p>
                <div className="flex flex-wrap gap-2">
                  <Button
                    size="sm"
                    onClick={() => setActiveTab("active")}
                    disabled={stats.activeJobs === 0}
                  >
                    <Zap size={14} />
                    View Running ({stats.activeJobs})
                  </Button>
                  <Button
                    size="sm"
                    onClick={() => setActiveTab("scheduled")}
                    disabled={stats.delayedJobs === 0}
                    variant="outline"
                  >
                    <Clock size={14} />
                    View Scheduled ({stats.delayedJobs})
                  </Button>
                  <Button
                    size="sm"
                    onClick={() => setActiveTab("failed")}
                    disabled={stats.failedJobs === 0}
                    variant="outline"
                  >
                    <AlertCircle size={14} />
                    View Failed ({stats.failedJobs})
                  </Button>
                </div>
              </div>
            </div>
          )}

          {/* Running Jobs Tab */}
          {activeTab === "active" && (
            <div className="space-y-2 max-h-96 overflow-y-auto">
              {!recentJobs?.active || recentJobs.active.length === 0 ? (
                <p className="text-center text-muted-foreground py-8">
                  No jobs running
                </p>
              ) : (
                recentJobs.active.map((job) => (
                  <JobRow key={job.id} job={job} />
                ))
              )}
            </div>
          )}

          {/* Scheduled Jobs Tab */}
          {activeTab === "scheduled" && (
            <div className="space-y-2 max-h-96 overflow-y-auto">
              {!recentJobs?.delayed || recentJobs.delayed.length === 0 ? (
                <p className="text-center text-muted-foreground py-8">
                  No scheduled jobs
                </p>
              ) : (
                recentJobs.delayed.map((job) => (
                  <JobRow key={job.id} job={job} />
                ))
              )}
            </div>
          )}

          {/* Completed Jobs Tab */}
          {activeTab === "completed" && (
            <div className="space-y-2 max-h-96 overflow-y-auto">
              {!recentJobs?.completed || recentJobs.completed.length === 0 ? (
                <p className="text-center text-muted-foreground py-8">
                  No completed jobs
                </p>
              ) : (
                recentJobs.completed.map((job) => (
                  <JobRow key={job.id} job={job} />
                ))
              )}
            </div>
          )}

          {/* Failed Jobs Tab */}
          {activeTab === "failed" && (
            <div className="space-y-2 max-h-96 overflow-y-auto">
              {!recentJobs?.failed || recentJobs.failed.length === 0 ? (
                <p className="text-center text-muted-foreground py-8">
                  No failed jobs
                </p>
              ) : (
                recentJobs.failed.map((job) => {
                  const postData = job.data as { postId?: string };
                  const postId = postData.postId;

                  return (
                    <div
                      key={job.id}
                      className="p-3 border rounded-lg hover:bg-gray-50 cursor-pointer transition-colors flex items-center justify-between group"
                      onClick={() => setSelectedJob(job)}
                    >
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="inline-block px-2 py-0.5 rounded text-xs font-semibold bg-red-100 text-red-700">
                            failed
                          </span>
                          <p className="font-medium text-sm">{job.id}</p>
                        </div>
                        <p className="text-xs text-red-600">
                          {job.failedReason || "Unknown error"}
                        </p>
                        <p className="text-xs text-muted-foreground mt-1">
                          Attempt {job.attemptsMade}/{job.maxAttempts}
                        </p>
                      </div>
                      <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity ml-2">
                        {postId && (
                          <Button
                            size="sm"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleRetry(postId);
                            }}
                            disabled={retrying === postId}
                            className="gap-1 h-7 px-2 text-xs"
                          >
                            <RotateCcw
                              size={12}
                              className={
                                retrying === postId ? "animate-spin" : ""
                              }
                            />
                            {retrying === postId ? "Retrying..." : "Retry"}
                          </Button>
                        )}
                        <ChevronRight
                          size={16}
                          className="text-muted-foreground"
                        />
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Job Details Modal */}
      {selectedJob && (
        <JobDetailsModal
          job={selectedJob}
          onClose={() => setSelectedJob(null)}
          onRetry={handleRetry}
        />
      )}
    </div>
  );
};
