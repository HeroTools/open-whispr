import { useState, useCallback, useEffect, useRef } from "react";
import { useDialogs } from "./useDialogs";
import { useToast } from "../components/ui/Toast";
import type { WhisperDownloadProgressData } from "../types/electron";
import "../types/electron";

const PROGRESS_THROTTLE_MS = 100;

export interface DownloadProgress {
  percentage: number;
  downloadedBytes: number;
  totalBytes: number;
  speed?: number;
  eta?: number;
}

export type ModelType = "whisper" | "llm" | "parakeet";

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

function getDownloadErrorMessage(error: string, code?: string): string {
  if (code === "ETIMEDOUT" || error.includes("timeout") || error.includes("stalled"))
    return "Download timed out. Check your internet connection and try again.";
  if (code === "ENOTFOUND" || error.includes("ENOTFOUND"))
    return "Could not reach the download server. Check your internet connection.";
  if (error.includes("disk space")) return error;
  if (error.includes("corrupted") || error.includes("incomplete") || error.includes("too small"))
    return "Download was incomplete or corrupted. Please try again.";
  if (error.includes("HTTP 429") || error.includes("rate limit"))
    return "Download server is rate limiting. Please wait a few minutes and try again.";
  if (error.includes("HTTP 4") || error.includes("HTTP 5"))
    return `Server error (${error}). Please try again later.`;
  return `Download failed: ${error}`;
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
  const [isInstalling, setIsInstalling] = useState(false);
  const [downloadError, setDownloadError] = useState<string | null>(null);
  const isCancellingRef = useRef(false);
  const lastProgressUpdateRef = useRef(0);

  const { showAlertDialog } = useDialogs();
  const { toast } = useToast();
  const showAlertDialogRef = useRef(showAlertDialog);
  const onDownloadCompleteRef = useRef(onDownloadComplete);
  const onModelsClearedRef = useRef(onModelsCleared);

  useEffect(() => {
    showAlertDialogRef.current = showAlertDialog;
  }, [showAlertDialog]);

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
        const now = Date.now();
        if (now - lastProgressUpdateRef.current < PROGRESS_THROTTLE_MS) return;
        lastProgressUpdateRef.current = now;
        setDownloadProgress({
          percentage: data.percentage || 0,
          downloadedBytes: data.downloaded_bytes || 0,
          totalBytes: data.total_bytes || 0,
        });
      } else if (data.type === "installing") {
        setIsInstalling(true);
      } else if (data.type === "complete") {
        if (isCancellingRef.current) return;
        setIsInstalling(false);
        setDownloadingModel(null);
        setDownloadProgress({ percentage: 0, downloadedBytes: 0, totalBytes: 0 });
        onDownloadCompleteRef.current?.();
      } else if (data.type === "error") {
        if (isCancellingRef.current) return;
        const msg = getDownloadErrorMessage(data.error || "Unknown error", data.code);
        setDownloadError(msg);
        showAlertDialogRef.current({ title: "Download Failed", description: msg });
        setIsInstalling(false);
        setDownloadingModel(null);
        setDownloadProgress({ percentage: 0, downloadedBytes: 0, totalBytes: 0 });
      }
    },
    []
  );

  const handleLLMProgress = useCallback((_event: unknown, data: LLMDownloadProgressData) => {
    if (isCancellingRef.current) return;

    const now = Date.now();
    const isComplete = data.progress >= 100;
    if (!isComplete && now - lastProgressUpdateRef.current < PROGRESS_THROTTLE_MS) {
      return;
    }
    lastProgressUpdateRef.current = now;

    setDownloadProgress({
      percentage: data.progress || 0,
      downloadedBytes: data.downloadedSize || 0,
      totalBytes: data.totalSize || 0,
    });
  }, []);

  useEffect(() => {
    let dispose: (() => void) | undefined;

    if (modelType === "whisper") {
      dispose = window.electronAPI?.onWhisperDownloadProgress(handleWhisperProgress);
    } else if (modelType === "parakeet") {
      dispose = window.electronAPI?.onParakeetDownloadProgress(handleWhisperProgress);
    } else {
      dispose = window.electronAPI?.onModelDownloadProgress(handleLLMProgress);
    }

    return () => {
      dispose?.();
    };
  }, [handleWhisperProgress, handleLLMProgress, modelType]);

  const downloadModel = useCallback(
    async (modelId: string, onSelectAfterDownload?: (id: string) => void) => {
      if (downloadingModel) {
        toast({
          title: "Download in Progress",
          description: "Please wait for the current download to complete or cancel it first.",
        });
        return;
      }

      try {
        setDownloadingModel(modelId);
        setDownloadError(null);
        setDownloadProgress({ percentage: 0, downloadedBytes: 0, totalBytes: 0 });
        lastProgressUpdateRef.current = 0; // Reset throttle timer

        let success = false;

        if (modelType === "whisper") {
          const result = await window.electronAPI?.downloadWhisperModel(modelId);
          if (!result?.success && !result?.error?.includes("interrupted by user")) {
            const msg = getDownloadErrorMessage(result?.error || "Unknown error", result?.code);
            setDownloadError(msg);
            showAlertDialog({ title: "Download Failed", description: msg });
          } else {
            success = result?.success ?? false;
          }
        } else if (modelType === "parakeet") {
          const result = await window.electronAPI?.downloadParakeetModel(modelId);
          if (!result?.success && !result?.error?.includes("interrupted by user")) {
            const msg = getDownloadErrorMessage(result?.error || "Unknown error", result?.code);
            setDownloadError(msg);
            showAlertDialog({ title: "Download Failed", description: msg });
          } else {
            success = result?.success ?? false;
          }
        } else {
          const result = (await window.electronAPI?.modelDownload?.(modelId)) as unknown as
            | { success: boolean; error?: string; code?: string }
            | undefined;
          if (result && !result.success && result.error) {
            const msg = getDownloadErrorMessage(result.error, result.code);
            setDownloadError(msg);
            showAlertDialog({ title: "Download Failed", description: msg });
          } else {
            success = result?.success ?? false;
          }
        }

        if (success) {
          onSelectAfterDownload?.(modelId);
        }

        onDownloadCompleteRef.current?.();
      } catch (error: unknown) {
        if (isCancellingRef.current) return;

        const errorMessage = error instanceof Error ? error.message : String(error);
        if (
          !errorMessage.includes("interrupted by user") &&
          !errorMessage.includes("cancelled by user") &&
          !errorMessage.includes("DOWNLOAD_CANCELLED")
        ) {
          const msg = getDownloadErrorMessage(errorMessage);
          setDownloadError(msg);
          showAlertDialog({ title: "Download Failed", description: msg });
        }
      } finally {
        setIsInstalling(false);
        setDownloadingModel(null);
        setDownloadProgress({ percentage: 0, downloadedBytes: 0, totalBytes: 0 });
      }
    },
    [downloadingModel, modelType, showAlertDialog, toast]
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
        } else if (modelType === "parakeet") {
          const result = await window.electronAPI?.deleteParakeetModel(modelId);
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
    if (!downloadingModel || isCancelling) return;

    setIsCancelling(true);
    isCancellingRef.current = true;
    try {
      if (modelType === "whisper") {
        await window.electronAPI?.cancelWhisperDownload();
      } else if (modelType === "parakeet") {
        await window.electronAPI?.cancelParakeetDownload();
      } else {
        await window.electronAPI?.modelCancelDownload?.(downloadingModel);
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
  }, [downloadingModel, isCancelling, modelType, toast]);

  const isDownloading = downloadingModel !== null;
  const isDownloadingModel = useCallback(
    (modelId: string) => downloadingModel === modelId,
    [downloadingModel]
  );

  return {
    downloadingModel,
    downloadProgress,
    downloadError,
    isDownloading,
    isDownloadingModel,
    isInstalling,
    isCancelling,
    downloadModel,
    deleteModel,
    cancelDownload,
    formatETA,
  };
}
