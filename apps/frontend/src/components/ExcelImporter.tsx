import React, { useState, useCallback } from "react";
import { Upload, FileUp, AlertCircle, CheckCircle2 } from "lucide-react";
import { Button } from "./ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "./ui/card";
import { excelApi } from "../lib/api";
import { DuplicatePostsModal } from "./DuplicatePostsModal";
import type { Post } from "@/types";

export const ExcelImporter: React.FC<{ onImportComplete?: () => void }> = ({
  onImportComplete,
}) => {
  const [file, setFile] = useState<File | null>(null);
  const [importing, setImporting] = useState(false);
  const [checkingDuplicates, setCheckingDuplicates] = useState(false);
  const [showDuplicateModal, setShowDuplicateModal] = useState(false);
  const [duplicateGroups, setDuplicateGroups] = useState<
    Array<{
      index: number;
      matches: any[];
      description?: string;
      topic?: string;
      imageUrls?: string[];
    }>
  >([]);
  const [result, setResult] = useState<{
    success?: boolean;
    imported?: number;
    errors?: number;
    posts?: Post[];
    errorDetails?: Array<{
      row: number;
      column?: string;
      value?: unknown;
      error: string;
    }>;
  } | null>(null);

  const handleFileChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const selectedFile = e.target.files?.[0];
      if (selectedFile) {
        setFile(selectedFile);
        setResult(null);
        setShowDuplicateModal(false);
      }
    },
    []
  );

  const handleCheckDuplicates = useCallback(async () => {
    if (!file) return;

    setCheckingDuplicates(true);
    try {
      const response = await excelApi.checkDuplicates(file);
      if (response.duplicates && response.duplicates.length > 0) {
        // Show duplicates modal
        setDuplicateGroups(response.duplicates);
        setShowDuplicateModal(true);
      } else {
        // No duplicates, proceed with import
        await handleImportAfterDuplicateCheck();
      }
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error ? error.message : "Failed to check duplicates";
      setResult({
        success: false,
        imported: 0,
        errors: 1,
        errorDetails: [{ row: 0, error: errorMessage }],
      });
    } finally {
      setCheckingDuplicates(false);
    }
  }, [file]);

  const handleImportAfterDuplicateCheck = useCallback(async () => {
    if (!file) return;

    setImporting(true);
    try {
      const response = await excelApi.importExcel(file);
      setResult(response);
      if (onImportComplete) {
        onImportComplete();
      }
      setFile(null);
      setShowDuplicateModal(false);
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error ? error.message : "An unknown error occurred";
      setResult({
        success: false,
        imported: 0,
        errors: 1,
        errorDetails: [{ row: 0, error: errorMessage }],
      });
    } finally {
      setImporting(false);
    }
  }, [file, onImportComplete]);

  const handleImport = useCallback(async () => {
    await handleCheckDuplicates();
  }, [handleCheckDuplicates]);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <FileUp className="h-5 w-5" />
          Import from Excel
        </CardTitle>
        <CardDescription>
          Upload an Excel file with sheet "Danh Sách Bài Post"
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center gap-4">
          <label className="flex-1">
            <input
              type="file"
              accept=".xlsx,.xls"
              onChange={handleFileChange}
              className="hidden"
              disabled={importing}
            />
            <div className="flex items-center gap-2 px-4 py-2 border border-input rounded-md cursor-pointer hover:bg-accent">
              <Upload className="h-4 w-4" />
              <span className="text-sm">
                {file ? file.name : "Choose file..."}
              </span>
            </div>
          </label>
          <Button
            onClick={handleImport}
            disabled={!file || importing || checkingDuplicates}
          >
            {checkingDuplicates
              ? "Checking for duplicates..."
              : importing
              ? "Importing..."
              : "Import"}
          </Button>
        </div>

        {result && (
          <div className="space-y-2">
            <div
              className={`flex items-center gap-2 p-3 rounded-md ${
                (result.imported || 0) > 0
                  ? "bg-green-50 text-green-900"
                  : "bg-red-50 text-red-900"
              }`}
            >
              {(result.imported || 0) > 0 ? (
                <CheckCircle2 className="h-4 w-4" />
              ) : (
                <AlertCircle className="h-4 w-4" />
              )}
              <div className="text-sm">
                <strong>{result.imported || 0}</strong> posts imported
                successfully
                {(result.errors || 0) > 0 && (
                  <>
                    , <strong>{result.errors}</strong> errors
                  </>
                )}
              </div>
            </div>

            {result.errorDetails && result.errorDetails.length > 0 && (
              <div className="max-h-40 overflow-y-auto space-y-1">
                {result.errorDetails.map(
                  (error: { row: number; error: string }, idx: number) => (
                    <div
                      key={idx}
                      className="text-xs text-red-600 bg-red-50 p-2 rounded"
                    >
                      Row {error.row}: {error.error}
                    </div>
                  )
                )}
              </div>
            )}
          </div>
        )}

        {showDuplicateModal && duplicateGroups.length > 0 && (
          <DuplicatePostsModal
            duplicateGroups={duplicateGroups}
            onContinue={handleImportAfterDuplicateCheck}
            onCancel={() => setShowDuplicateModal(false)}
            isContinuing={importing}
          />
        )}
      </CardContent>
    </Card>
  );
};
