import { useState, useEffect, useCallback, useMemo } from "react";
import { Button } from "./ui/button";
import { RefreshCw, Download, Trash2, Check } from "lucide-react";
import { ProviderIcon } from "./ui/ProviderIcon";
import { ProviderTabs } from "./ui/ProviderTabs";
import { DownloadProgressBar } from "./ui/DownloadProgressBar";
import { ConfirmDialog } from "./ui/dialog";
import { useDialogs } from "../hooks/useDialogs";
import { useModelDownload, type ModelType } from "../hooks/useModelDownload";
import { MODEL_PICKER_COLORS, type ColorScheme } from "../utils/modelPickerStyles";

export interface LocalModel {
  id: string;
  name: string;
  size: string;
  sizeBytes?: number;
  description: string;
  isDownloaded?: boolean;
  downloaded?: boolean;
  recommended?: boolean;
}

export interface LocalProvider {
  id: string;
  name: string;
  models: LocalModel[];
}

interface LocalModelPickerProps {
  providers: LocalProvider[];
  selectedModel: string;
  selectedProvider: string;
  onModelSelect: (modelId: string) => void;
  onProviderSelect: (providerId: string) => void;
  modelType: ModelType;
  colorScheme?: Exclude<ColorScheme, "blue">;
  className?: string;
  onDownloadComplete?: () => void;
}

export default function LocalModelPicker({
  providers,
  selectedModel,
  selectedProvider,
  onModelSelect,
  onProviderSelect,
  modelType,
  colorScheme = "purple",
  className = "",
  onDownloadComplete,
}: LocalModelPickerProps) {
  const [downloadedModels, setDownloadedModels] = useState<Set<string>>(new Set());
  const [loadingModels, setLoadingModels] = useState(false);

  const { confirmDialog, showConfirmDialog, hideConfirmDialog } = useDialogs();
  const styles = useMemo(() => MODEL_PICKER_COLORS[colorScheme], [colorScheme]);

  const loadDownloadedModels = useCallback(async () => {
    setLoadingModels(true);
    try {
      let downloaded = new Set<string>();
      if (modelType === "whisper") {
        const result = await window.electronAPI?.listWhisperModels();
        if (result?.success) {
          downloaded = new Set(
            result.models
              .filter((m: { downloaded?: boolean }) => m.downloaded)
              .map((m: { model: string }) => m.model)
          );
        }
      } else {
        const result = await window.electronAPI?.modelGetAll?.();
        if (result && Array.isArray(result)) {
          downloaded = new Set(
            result
              .filter((m: { isDownloaded?: boolean }) => m.isDownloaded)
              .map((m: { id: string }) => m.id)
          );
        }
      }
      setDownloadedModels(downloaded);
      return downloaded;
    } catch (error) {
      console.error("Failed to load downloaded models:", error);
      return new Set<string>();
    } finally {
      setLoadingModels(false);
    }
  }, [modelType]);

  useEffect(() => {
    const initAndValidate = async () => {
      const downloaded = await loadDownloadedModels();
      if (selectedModel && !downloaded.has(selectedModel)) {
        onModelSelect("");
      }
    };
    initAndValidate();
  }, [loadDownloadedModels, selectedModel, onModelSelect]);

  const handleDownloadComplete = useCallback(() => {
    loadDownloadedModels();
    onDownloadComplete?.();
  }, [loadDownloadedModels, onDownloadComplete]);

  const { downloadingModel, downloadProgress, downloadModel, deleteModel, isDownloadingModel } =
    useModelDownload({
      modelType,
      onDownloadComplete: handleDownloadComplete,
      onModelsCleared: loadDownloadedModels,
    });

  const handleDownload = useCallback(
    (modelId: string) => {
      downloadModel(modelId, onModelSelect);
    },
    [downloadModel, onModelSelect]
  );

  const handleDelete = useCallback(
    (modelId: string) => {
      showConfirmDialog({
        title: "Delete Model",
        description:
          "Are you sure you want to delete this model? You'll need to re-download it if you want to use it again.",
        onConfirm: () => deleteModel(modelId, loadDownloadedModels),
        variant: "destructive",
      });
    },
    [showConfirmDialog, deleteModel, loadDownloadedModels]
  );

  const currentProvider = providers.find((p) => p.id === selectedProvider);
  const models = currentProvider?.models || [];

  const progressDisplay = useMemo(() => {
    if (!downloadingModel) return null;

    const modelName = models.find((m) => m.id === downloadingModel)?.name || downloadingModel;

    return (
      <DownloadProgressBar modelName={modelName} progress={downloadProgress} styles={styles} />
    );
  }, [downloadingModel, downloadProgress, models, styles]);

  return (
    <div className={`${styles.container} ${className}`}>
      <ProviderTabs
        providers={providers}
        selectedId={selectedProvider}
        onSelect={onProviderSelect}
        colorScheme={colorScheme}
        scrollable
      />

      {progressDisplay}

      <div className="p-4">
        <div className="flex items-center justify-between mb-3">
          <h5 className={styles.header}>Available Models</h5>
          <Button
            onClick={loadDownloadedModels}
            variant="outline"
            size="sm"
            disabled={loadingModels}
            className={`${styles.buttons.refresh} min-w-[105px] transition-colors`}
          >
            <RefreshCw size={14} className={loadingModels ? "animate-spin" : ""} />
            <span className="ml-1">{loadingModels ? "Checking..." : "Refresh"}</span>
          </Button>
        </div>

        <div className="space-y-2">
          {models.length === 0 ? (
            <p className="text-sm text-gray-500">No models available for this provider</p>
          ) : (
            models.map((model) => {
              const isSelected = model.id === selectedModel;
              const isDownloading = isDownloadingModel(model.id);
              const isDownloaded =
                downloadedModels.has(model.id) || model.isDownloaded || model.downloaded;

              return (
                <div
                  key={model.id}
                  className={`p-3 rounded-lg border-2 transition-all ${
                    isSelected ? styles.modelCard.selected : styles.modelCard.default
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <ProviderIcon provider={selectedProvider} className="w-4 h-4" />
                        <span className="font-medium text-gray-900">{model.name}</span>
                        {isSelected && <span className={styles.badges.selected}>✓ Selected</span>}
                        {model.recommended && (
                          <span className={styles.badges.recommended}>Recommended</span>
                        )}
                      </div>
                      <div className="text-xs text-gray-600 mt-1">{model.description}</div>
                      <div className="flex items-center gap-2 mt-1">
                        <span className="text-xs text-gray-500">Size: {model.size}</span>
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
                              onClick={() => onModelSelect(model.id)}
                              size="sm"
                              variant="outline"
                              className={styles.buttons.select}
                            >
                              Select
                            </Button>
                          )}
                          <Button
                            onClick={() => handleDelete(model.id)}
                            size="sm"
                            variant="outline"
                            className={styles.buttons.delete}
                          >
                            <Trash2 size={14} />
                            <span className="ml-1">Delete</span>
                          </Button>
                        </>
                      ) : (
                        <Button
                          onClick={() => handleDownload(model.id)}
                          size="sm"
                          disabled={isDownloading}
                          className={styles.buttons.download}
                        >
                          {isDownloading ? (
                            `${Math.round(downloadProgress.percentage)}%`
                          ) : (
                            <>
                              <Download size={14} />
                              <span className="ml-1">Download</span>
                            </>
                          )}
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })
          )}
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
