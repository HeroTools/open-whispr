import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { Button } from "./ui/button";
import { RefreshCw, Download, Trash2, Check, X } from "lucide-react";
import { ProviderIcon } from "./ui/ProviderIcon";
import { DownloadProgressBar } from "./ui/DownloadProgressBar";
import { ConfirmDialog } from "./ui/dialog";
import { useDialogs } from "../hooks/useDialogs";
import { useModelDownload } from "../hooks/useModelDownload";
import { WHISPER_MODEL_INFO } from "../models/ModelRegistry";
import { MODEL_PICKER_COLORS, type ColorScheme } from "../utils/modelPickerStyles";

interface WhisperModel {
  model: string;
  size_mb?: number;
  downloaded?: boolean;
}

interface LocalWhisperPickerProps {
  selectedModel: string;
  onModelSelect: (modelId: string) => void;
  onModelDownloaded?: (modelId: string) => void;
  className?: string;
  variant?: "onboarding" | "settings";
}

export default function LocalWhisperPicker({
  selectedModel,
  onModelSelect,
  onModelDownloaded,
  className = "",
  variant = "settings",
}: LocalWhisperPickerProps) {
  const [models, setModels] = useState<WhisperModel[]>([]);
  const [loadingModels, setLoadingModels] = useState(false);
  const hasLoadedRef = useRef(false);
  const downloadingModelRef = useRef<string | null>(null);

  const { confirmDialog, showConfirmDialog, hideConfirmDialog } = useDialogs();
  const colorScheme: ColorScheme = variant === "settings" ? "purple" : "blue";
  const styles = useMemo(() => MODEL_PICKER_COLORS[colorScheme], [colorScheme]);

  const loadModels = useCallback(async () => {
    try {
      setLoadingModels(true);
      const result = await window.electronAPI?.listWhisperModels();
      if (result?.success) {
        setModels(result.models);
      }
    } catch (error) {
      console.error("[LocalWhisperPicker] Failed to load models:", error);
      setModels([]);
    } finally {
      setLoadingModels(false);
    }
  }, []);

  // Only load models once on mount to prevent re-renders
  useEffect(() => {
    if (!hasLoadedRef.current) {
      hasLoadedRef.current = true;
      loadModels();
    }
  }, [loadModels]);

  const {
    downloadingModel,
    downloadProgress,
    downloadModel,
    deleteModel,
    isDownloadingModel,
    cancelDownload,
    isCancelling,
  } = useModelDownload({
    modelType: "whisper",
    onDownloadComplete: () => {
      loadModels();
      // Notify parent when a model is downloaded (use ref to avoid stale closure)
      if (downloadingModelRef.current && onModelDownloaded) {
        onModelDownloaded(downloadingModelRef.current);
      }
    },
    onModelsCleared: loadModels,
  });

  // Keep ref in sync with downloadingModel to avoid stale closure in onDownloadComplete
  useEffect(() => {
    downloadingModelRef.current = downloadingModel;
  }, [downloadingModel]);

  const handleDelete = useCallback(
    (modelId: string) => {
      showConfirmDialog({
        title: "Delete Model",
        description:
          "Are you sure you want to delete this model? You'll need to re-download it if you want to use it again.",
        onConfirm: () => deleteModel(modelId, loadModels),
        variant: "destructive",
      });
    },
    [showConfirmDialog, deleteModel, loadModels]
  );

  const progressDisplay = useMemo(() => {
    if (!downloadingModel) return null;

    const modelInfo = WHISPER_MODEL_INFO[downloadingModel];
    const modelName = modelInfo?.name || downloadingModel;

    return (
      <DownloadProgressBar modelName={modelName} progress={downloadProgress} styles={styles} />
    );
  }, [downloadingModel, downloadProgress, styles]);

  return (
    <div className={`${styles.container} ${className}`}>
      {progressDisplay}

      <div className="p-4">
        <div className="flex items-center justify-between mb-3">
          <h5 className={styles.header}>Whisper Models</h5>
          <Button
            onClick={loadModels}
            variant="outline"
            size="sm"
            disabled={loadingModels}
            className={`${styles.buttons.refresh} min-w-[105px] justify-center transition-colors`}
          >
            <RefreshCw size={14} className={loadingModels ? "animate-spin" : ""} />
            <span>{loadingModels ? "Checking..." : "Refresh"}</span>
          </Button>
        </div>

        <div className="space-y-2">
          {models.map((model) => {
            const modelId = model.model;
            const info = WHISPER_MODEL_INFO[modelId] || {
              name: modelId,
              description: "Model",
              size: "Unknown",
            };
            const isSelected = modelId === selectedModel;
            const isDownloading = isDownloadingModel(modelId);
            const isDownloaded = model.downloaded;

            return (
              <div
                key={modelId}
                className={`p-3 rounded-lg border-2 transition-all ${
                  isSelected ? styles.modelCard.selected : styles.modelCard.default
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <ProviderIcon provider="whisper" className="w-4 h-4" />
                      <span className="font-medium text-gray-900">{info.name}</span>
                      {isSelected && <span className={styles.badges.selected}>✓ Selected</span>}
                      {info.recommended && (
                        <span className={styles.badges.recommended}>Recommended</span>
                      )}
                    </div>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-xs text-gray-600">{info.description}</span>
                      <span className="text-xs text-gray-500">
                        • {model.size_mb ? `${model.size_mb}MB` : info.size}
                      </span>
                      {isDownloaded && (
                        <span className={styles.badges.downloaded}>
                          <Check className="inline w-3 h-3 mr-1" />
                          Downloaded
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="flex gap-2">
                    {isDownloaded ? (
                      <>
                        {!isSelected && (
                          <Button
                            onClick={() => onModelSelect(modelId)}
                            size="sm"
                            variant="outline"
                            className={styles.buttons.select}
                          >
                            Select
                          </Button>
                        )}
                        <Button
                          onClick={() => handleDelete(modelId)}
                          size="sm"
                          variant="outline"
                          className={styles.buttons.delete}
                        >
                          <Trash2 size={14} />
                          <span className="ml-1">Delete</span>
                        </Button>
                      </>
                    ) : isDownloading ? (
                      <Button
                        onClick={cancelDownload}
                        disabled={isCancelling}
                        size="sm"
                        variant="outline"
                        className="text-red-600 border-red-300 hover:bg-red-50"
                      >
                        <X size={14} />
                        <span className="ml-1">{isCancelling ? "..." : "Cancel"}</span>
                      </Button>
                    ) : (
                      <Button
                        onClick={() => downloadModel(modelId, onModelSelect)}
                        size="sm"
                        className={styles.buttons.download}
                      >
                        <Download size={14} />
                        <span className="ml-1">Download</span>
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <ConfirmDialog
        open={confirmDialog.open}
        onOpenChange={(open) => !open && hideConfirmDialog()}
        title={confirmDialog.title}
        description={confirmDialog.description}
        confirmText={confirmDialog.confirmText}
        cancelText={confirmDialog.cancelText}
        onConfirm={confirmDialog.onConfirm}
        variant={confirmDialog.variant}
      />
    </div>
  );
}
