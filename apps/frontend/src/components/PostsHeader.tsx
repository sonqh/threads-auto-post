import { useState } from "react";
import { Button } from "./ui/button";
import { SchedulerModal } from "./SchedulerModal";
import { type ScheduleConfig } from "@/types";

interface PostsHeaderProps {
  selectedCount: number;
  onSelectAll: (selected: boolean) => void;
  onBulkDelete: (ids: string[]) => void;
  onBulkSchedule: (ids: string[], config: ScheduleConfig) => void;
  selectedIds: string[];
}

export const PostsHeader = ({
  selectedCount,
  onSelectAll,
  onBulkDelete,
  onBulkSchedule,
  selectedIds,
}: PostsHeaderProps) => {
  const [showSchedulerModal, setShowSchedulerModal] = useState(false);

  const handleSchedulerSubmit = (config: ScheduleConfig) => {
    onBulkSchedule(selectedIds, config);
    setShowSchedulerModal(false);
  };

  return (
    <div className="bg-white rounded-lg border p-4 space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <input
            type="checkbox"
            checked={selectedCount > 0}
            onChange={(e) => onSelectAll(e.target.checked)}
            className="w-4 h-4"
          />
          <span className="text-sm font-medium">
            {selectedCount > 0 ? `${selectedCount} selected` : "Select posts"}
          </span>
        </div>

        {selectedCount > 0 && (
          <div className="flex gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={() => setShowSchedulerModal(true)}
            >
              Schedule {selectedCount}
            </Button>
            <Button
              size="sm"
              variant="destructive"
              onClick={() => {
                if (confirm(`Delete ${selectedCount} post(s)?`)) {
                  onBulkDelete(selectedIds);
                }
              }}
            >
              Delete {selectedCount}
            </Button>
          </div>
        )}
      </div>

      <SchedulerModal
        isOpen={showSchedulerModal}
        onClose={() => setShowSchedulerModal(false)}
        onSchedule={handleSchedulerSubmit}
      />
    </div>
  );
};
