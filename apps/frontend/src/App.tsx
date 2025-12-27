import { useState } from "react";
import { ExcelImporter } from "./components/ExcelImporter";
import { JobMonitoring } from "./components/JobMonitoring";
import { PostsList } from "./components/PostsList";
import { FileText, Activity } from "lucide-react";

type TabType = "posts" | "control";

function App() {
  const [activeTab, setActiveTab] = useState<TabType>("posts");

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b sticky top-0 z-40 bg-white">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between mb-4">
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <FileText className="h-6 w-6" />
              Threads Post Scheduler
            </h1>
          </div>
          <p className="text-sm text-muted-foreground mb-4">
            Manage and schedule your Threads posts
          </p>

          {/* Navigation Tabs */}
          <div className="flex gap-2 border-b">
            <button
              onClick={() => setActiveTab("posts")}
              className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                activeTab === "posts"
                  ? "border-blue-600 text-blue-600"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              }`}
            >
              <span className="flex items-center gap-2">
                <FileText size={16} />
                Posts Manager
              </span>
            </button>
            <button
              onClick={() => setActiveTab("control")}
              className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                activeTab === "control"
                  ? "border-blue-600 text-blue-600"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              }`}
            >
              <span className="flex items-center gap-2">
                <Activity size={16} />
                Control Center
              </span>
            </button>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        {/* Posts Manager Tab */}
        {activeTab === "posts" && (
          <div className="space-y-8">
            <ExcelImporter />
            <PostsList />
          </div>
        )}

        {/* Control Center Tab */}
        {activeTab === "control" && <JobMonitoring />}
      </main>

      {/* Debug Panel */}
      {/* <SchedulerDebug /> */}
    </div>
  );
}

export default App;
