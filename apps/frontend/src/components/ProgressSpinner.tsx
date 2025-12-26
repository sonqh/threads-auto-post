import React from "react";
import { Loader2 } from "lucide-react";

interface ProgressSpinnerProps {
  isActive: boolean;
  currentStep?: string;
  size?: "sm" | "md" | "lg";
}

export const ProgressSpinner: React.FC<ProgressSpinnerProps> = ({
  isActive,
  currentStep,
  size = "md",
}) => {
  if (!isActive) {
    return null;
  }

  const sizeClasses = {
    sm: "w-4 h-4",
    md: "w-6 h-6",
    lg: "w-8 h-8",
  };

  const containerClasses = {
    sm: "flex items-center gap-1",
    md: "flex items-center gap-2",
    lg: "flex flex-col items-center gap-2",
  };

  return (
    <div className={containerClasses[size]}>
      <Loader2 className={`${sizeClasses[size]} animate-spin text-blue-500`} />
      {currentStep && size !== "sm" && (
        <span
          className={`${
            size === "lg" ? "text-sm text-center" : "text-xs"
          } text-gray-600`}
        >
          {currentStep}
        </span>
      )}
    </div>
  );
};
