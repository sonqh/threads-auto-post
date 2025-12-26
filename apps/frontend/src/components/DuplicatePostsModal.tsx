import { AlertCircle, X } from "lucide-react";
import { Button } from "./ui/button";
import { Card } from "./ui/card";
import type { DuplicatePost } from "@/lib/duplicateDetection";

interface DuplicatePostsModalProps {
  duplicateGroups: Array<{
    index: number;
    matches: DuplicatePost[];
    description?: string;
    topic?: string;
    imageUrls?: string[];
  }>;
  onContinue: () => void;
  onCancel: () => void;
  isContinuing?: boolean;
}

export const DuplicatePostsModal: React.FC<DuplicatePostsModalProps> = ({
  duplicateGroups,
  onContinue,
  onCancel,
  isContinuing = false,
}) => {
  const totalDuplicates = duplicateGroups.length;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <Card className="w-full max-w-2xl max-h-[80vh] overflow-y-auto">
        <div className="p-6 space-y-4">
          {/* Header */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <AlertCircle className="h-5 w-5 text-amber-600" />
              <h2 className="text-lg font-semibold">
                {totalDuplicates} Duplicate{totalDuplicates !== 1 ? "s" : ""} Detected
              </h2>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={onCancel}
              disabled={isContinuing}
              className="h-8 w-8 p-0"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>

          {/* Warning Message */}
          <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-sm text-amber-900">
            <p className="font-medium mb-1">
              The following posts already exist in your system
            </p>
            <p className="text-xs">
              Posts with matching Description, Topics, and Image URLs will not be
              imported. Click "Continue Anyway" to skip duplicates and import only new
              posts.
            </p>
          </div>

          {/* Duplicates List */}
          <div className="space-y-3 max-h-96 overflow-y-auto">
            {duplicateGroups.map((group, idx) => (
              <div key={idx} className="p-3 bg-gray-50 border rounded-lg space-y-2">
                <div className="text-xs font-medium text-gray-600">
                  Row {group.index + 2} (Duplicate with {group.matches.length} existing
                  post{group.matches.length !== 1 ? "s" : ""})
                </div>

                {/* New Post Info */}
                {group.description && (
                  <div className="text-sm">
                    <span className="font-medium text-gray-700">Description:</span>
                    <p className="text-gray-600 line-clamp-2 mt-0.5">
                      {group.description}
                    </p>
                  </div>
                )}

                {group.topic && (
                  <div className="text-sm">
                    <span className="font-medium text-gray-700">Topics:</span>
                    <div className="flex flex-wrap gap-1 mt-1">
                      {group.topic.split(",").map((topic, i) => (
                        <span
                          key={i}
                          className="inline-block px-2 py-1 text-xs bg-gray-200 text-gray-700 rounded"
                        >
                          {topic.trim()}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {group.imageUrls && group.imageUrls.length > 0 && (
                  <div className="text-sm">
                    <span className="font-medium text-gray-700">
                      Image URLs: ({group.imageUrls.length})
                    </span>
                    <div className="flex flex-wrap gap-2 mt-1">
                      {group.imageUrls.map((url, i) => (
                        <a
                          key={i}
                          href={url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-block px-2 py-1 text-xs bg-blue-100 text-blue-700 rounded truncate max-w-xs hover:underline"
                          title={url}
                        >
                          Link {i + 1}
                        </a>
                      ))}
                    </div>
                  </div>
                )}

                {/* Matching Posts Info */}
                <div className="pt-2 border-t">
                  <p className="text-xs font-medium text-gray-600 mb-1">
                    Matches:
                  </p>
                  {group.matches.map((match, i) => (
                    <div key={i} className="text-xs text-gray-600 bg-white p-2 rounded mb-1">
                      <p className="font-medium">Post {i + 1}:</p>
                      <p className="text-gray-500 line-clamp-1 mt-0.5">
                        {match.comment || match.content}
                      </p>
                      {match.topic && (
                        <p className="text-gray-500 mt-0.5">
                          Topics: {match.topic}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>

          {/* Actions */}
          <div className="flex gap-3 pt-4 border-t">
            <Button
              onClick={onContinue}
              disabled={isContinuing}
              className="flex-1 bg-amber-600 hover:bg-amber-700"
            >
              {isContinuing ? "Importing..." : "Continue Anyway"}
            </Button>
            <Button
              variant="outline"
              onClick={onCancel}
              disabled={isContinuing}
              className="flex-1"
            >
              Cancel
            </Button>
          </div>
        </div>
      </Card>
    </div>
  );
};
