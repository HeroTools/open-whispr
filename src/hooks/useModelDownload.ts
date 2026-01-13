import { useState, useCallback, useEffect, useRef } from "react";
import { useDialogs } from "./useDialogs";
import { useToast } from "../components/ui/Toast";
import type { WhisperDownloadProgressData } from "../types/electron";
import "../types/electron";

export interface DownloadProgress {
  percentage: number;
  downloadedBytes: number;
  totalBytes: number;
  speed?: number;
  eta?: number;
}

export type ModelType = "whisper" | "llm";

interface UseModelDownloadOptions {
  modelType: ModelType;
  onDownloadComplete?: () => void;
  onModelsCleared?: () => void;
}

interface LLMDownloadProgressData {
  modelId: string;
  progress: number;
  downloadedSize: number;
  totalSize: number;
}

export function formatETA(seconds: number): string {
  if (seconds < 60) return `${Math.round(seconds)}s`;
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = Math.round(seconds % 60);
  return `${minutes}m ${remainingSeconds}s`;
}

export function useModelDownload({
  modelType,
  onDownloadComplete,
  onModelsCleared,
}: UseModelDownloadOptions) {
  const [downloadingModel, setDownloadingModel] = useState<string | null>(null);
  const [downloadProgress, setDownloadProgress] = useState<DownloadProgress>({
    percentage: 0,
    downloadedBytes: 0,
    totalBytes: 0,
  });
  const [isCancelling, setIsCancelling] = useState(false);
  const isCancellingRef = useRef(false);

  const { showAlertDialog } = useDialogs();
  const { toast } = useToast();
  const onDownloadCompleteRef = useRef(onDownloadComplete);
  const onModelsClearedRef = useRef(onModelsCleared);

  useEffect(() => {
    onDownloadCompleteRef.current = onDownloadComplete;
  }, [onDownloadComplete]);

  useEffect(() => {
    onModelsClearedRef.current = onModelsCleared;
  }, [onModelsCleared]);

  useEffect(() => {
    const handleModelsCleared = () => onModelsClearedRef.current?.();
    window.addEventListener("openwhispr-models-cleared", handleModelsCleared);
    return () => window.removeEventListener("openwhispr-models-cleared", handleModelsCleared);
  }, []);

  const handleWhisperProgress = useCallback(
    (_event: unknown, data: WhisperDownloadProgressData) => {
      if (data.type === "progress") {
        setDownloadProgress({
          percentage: data.percentage || 0,
          downloadedBytes: data.downloaded_bytes || 0,
          totalBytes: data.total_bytes || 0,
        });
      } else if (data.type === "complete" || data.type === "error") {
        // Skip if cancellation is handling cleanup
        if (isCancellingRef.current) return;
        setDownloadingModel(null);
        setDownloadProgress({ percentage: 0, downloadedBytes: 0, totalBytes: 0 });
        onDownloadCompleteRef.current?.();
      }
    },
    []
  );

  const handleLLMProgress = useCallback((_event: unknown, data: LLMDownloadProgressData) => {
    setDownloadProgress({
      percentage: data.progress || 0,
      downloadedBytes: data.downloadedSize || 0,
      totalBytes: data.totalSize || 0,
    });
  }, []);

  useEffect(() => {
    const dispose =
      modelType === "whisper"
        ? window.electronAPI?.onWhisperDownloadProgress(handleWhisperProgress)
        : window.electronAPI?.onModelDownloadProgress(handleLLMProgress);

    return () => {
      dispose?.();
    };
  }, [handleWhisperProgress, handleLLMProgress, modelType]);

  const downloadModel = useCallback(
    async (modelId: string, onSelectAfterDownload?: (id: string) => void) => {
      try {
        setDownloadingModel(modelId);
        setDownloadProgress({ percentage: 0, downloadedBytes: 0, totalBytes: 0 });

        let success = false;

        if (modelType === "whisper") {
          const result = await window.electronAPI?.downloadWhisperModel(modelId);
          if (!result?.success && !result?.error?.includes("interrupted by user")) {
            showAlertDialog({
              title: "Download Failed",
              description: `Failed to download model: ${result?.error}`,
            });
          } else {
            success = result?.success ?? false;
          }
        } else {
          const result = (await window.electronAPI?.modelDownload?.(modelId)) as
            | { success: boolean; error?: string }
            | undefined;
          if (result && !result.success && result.error) {
            showAlertDialog({
              title: "Download Failed",
              description: `Failed to download model: ${result.error}`,
            });
          } else {
            success = result?.success ?? false;
          }
        }

        if (success) {
          onSelectAfterDownload?.(modelId);
        }

        onDownloadCompleteRef.current?.();
      } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        if (!errorMessage.includes("interrupted by user")) {
          showAlertDialog({
            title: "Download Failed",
            description: `Failed to download model: ${errorMessage}`,
          });
        }
      } finally {
        setDownloadingModel(null);
        setDownloadProgress({ percentage: 0, downloadedBytes: 0, totalBytes: 0 });
      }
    },
    [modelType, showAlertDialog]
  );

  const deleteModel = useCallback(
    async (modelId: string, onComplete?: () => void) => {
      try {
        if (modelType === "whisper") {
          const result = await window.electronAPI?.deleteWhisperModel(modelId);
          if (result?.success) {
            toast({
              title: "Model Deleted",
              description: `Model deleted successfully! Freed ${result.freed_mb}MB of disk space.`,
            });
          }
        } else {
          await window.electronAPI?.modelDelete?.(modelId);
          toast({
            title: "Model Deleted",
            description: "Model deleted successfully!",
          });
        }
        onComplete?.();
      } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        showAlertDialog({
          title: "Delete Failed",
          description: `Failed to delete model: ${errorMessage}`,
        });
      }
    },
    [modelType, toast, showAlertDialog]
  );

  const cancelDownload = useCallback(async () => {
    if (!downloadingModel) return;

    setIsCancelling(true);
    isCancellingRef.current = true;
    try {
      if (modelType === "whisper") {
        await window.electronAPI?.cancelWhisperDownload();
      }
      toast({
        title: "Download Cancelled",
        description: "The download has been cancelled.",
      });
    } catch (error) {
      console.error("Failed to cancel download:", error);
    } finally {
      setIsCancelling(false);
      isCancellingRef.current = false;
      setDownloadingModel(null);
      setDownloadProgress({ percentage: 0, downloadedBytes: 0, totalBytes: 0 });
      onDownloadCompleteRef.current?.();
    }
  }, [downloadingModel, modelType, toast]);

  const isDownloading = downloadingModel !== null;
  const isDownloadingModel = useCallback(
    (modelId: string) => downloadingModel === modelId,
    [downloadingModel]
  );

  return {
    downloadingModel,
    downloadProgress,
    isDownloading,
    isDownloadingModel,
    isCancelling,
    downloadModel,
    deleteModel,
    cancelDownload,
    formatETA,
  };
}
