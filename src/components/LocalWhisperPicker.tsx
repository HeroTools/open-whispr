import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { Button } from "./ui/button";
import { Download, Trash2, Check, X } from "lucide-react";
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
  const hasLoadedRef = useRef(false);
  const downloadingModelRef = useRef<string | null>(null);
  const selectedModelRef = useRef(selectedModel);
  const onModelSelectRef = useRef(onModelSelect);

  const { confirmDialog, showConfirmDialog, hideConfirmDialog } = useDialogs();
  const colorScheme: ColorScheme = variant === "settings" ? "purple" : "blue";
  const styles = useMemo(() => MODEL_PICKER_COLORS[colorScheme], [colorScheme]);

  useEffect(() => {
    selectedModelRef.current = selectedModel;
  }, [selectedModel]);
  useEffect(() => {
    onModelSelectRef.current = onModelSelect;
  }, [onModelSelect]);

  const validateAndSelectModel = useCallback((loadedModels: WhisperModel[]) => {
    const current = selectedModelRef.current;
    if (!current) return;

    const downloaded = loadedModels.filter((m) => m.downloaded);
    const isCurrentDownloaded = loadedModels.find((m) => m.model === current)?.downloaded;

    if (!isCurrentDownloaded && downloaded.length > 0) {
      onModelSelectRef.current(downloaded[0].model);
    } else if (!isCurrentDownloaded && downloaded.length === 0) {
      onModelSelectRef.current("");
    }
  }, []);

  const loadModels = useCallback(async () => {
    try {
      const result = await window.electronAPI?.listWhisperModels();
      if (result?.success) {
        setModels(result.models);
        validateAndSelectModel(result.models);
      }
    } catch (error) {
      console.error("[LocalWhisperPicker] Failed to load models:", error);
      setModels([]);
    }
  }, [validateAndSelectModel]);

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
      if (downloadingModelRef.current && onModelDownloaded) {
        onModelDownloaded(downloadingModelRef.current);
      }
    },
    onModelsCleared: loadModels,
  });

  useEffect(() => {
    downloadingModelRef.current = downloadingModel;
  }, [downloadingModel]);

  const handleDelete = useCallback(
    (modelId: string) => {
      showConfirmDialog({
        title: "Delete Model",
        description:
          "Are you sure you want to delete this model? You'll need to re-download it if you want to use it again.",
        onConfirm: async () => {
          await deleteModel(modelId, async () => {
            const result = await window.electronAPI?.listWhisperModels();
            if (result?.success) {
              setModels(result.models);
              validateAndSelectModel(result.models);
            }
          });
        },
        variant: "destructive",
      });
    },
    [showConfirmDialog, deleteModel, validateAndSelectModel]
  );

  const progressDisplay = useMemo(() => {
    if (!downloadingModel) return null;
    const modelInfo = WHISPER_MODEL_INFO[downloadingModel];
    return (
      <DownloadProgressBar
        modelName={modelInfo?.name || downloadingModel}
        progress={downloadProgress}
      />
    );
  }, [downloadingModel, downloadProgress]);

  return (
    <div className={`${styles.container} ${className}`}>
      {progressDisplay}

      <div className="p-4">
        <h5 className={`${styles.header} mb-3`}>Whisper Models</h5>

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
                      <span className="font-medium text-foreground">{info.name}</span>
                      {isSelected && <span className={styles.badges.selected}>✓ Selected</span>}
                      {info.recommended && (
                        <span className={styles.badges.recommended}>Recommended</span>
                      )}
                    </div>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-xs text-muted-foreground">{info.description}</span>
                      <span className="text-xs text-muted-foreground/70">
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
                        className="text-destructive border-destructive/30 hover:bg-destructive/10"
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
