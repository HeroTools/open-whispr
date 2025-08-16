import { useState, useEffect, useCallback, useMemo } from "react";
import { Button } from "./ui/button";
import { Progress } from "./ui/progress";
import { Alert, AlertDescription } from "./ui/alert";
import { 
  RefreshCw, 
  Download, 
  Trash2, 
  AlertCircle,
  ExternalLink 
} from "lucide-react";
import { useDialogs } from "../hooks/useDialogs";
import { useToast } from "./ui/Toast";
import { formatBytes } from "../utils/formatBytes";
import "../types/electron";

interface Model {
  id: string;
  name: string;
  model?: string; // For Whisper compatibility
  size: string;
  size_mb?: number;
  sizeBytes?: number;
  description: string;
  downloaded?: boolean;
  isDownloaded?: boolean;
  recommended?: boolean;
  type: 'whisper' | 'llm';
}

interface DownloadProgress {
  percentage: number;
  downloadedBytes: number;
  totalBytes: number;
  speed?: number;
  eta?: number;
}

interface UnifiedModelPickerProps {
  selectedModel: string;
  onModelSelect: (modelId: string) => void;
  modelType: 'whisper' | 'llm';
  className?: string;
  variant?: "onboarding" | "settings";
}

const VARIANT_STYLES = {
  onboarding: {
    container: "bg-gray-50 p-4 rounded-lg",
    progress: "bg-blue-50 border-b border-blue-200",
    progressText: "text-blue-900",
    progressBar: "bg-blue-200",
    progressFill: "bg-gradient-to-r from-blue-500 to-blue-600",
    header: "font-medium text-gray-900 mb-3",
    modelCard: {
      selected: "border-blue-500 bg-blue-50",
      default: "border-gray-200 bg-white hover:border-gray-300",
    },
    badges: {
      selected: "text-xs text-blue-600 bg-blue-100 px-2 py-1 rounded-full font-medium",
      downloaded: "text-xs text-green-600 bg-green-100 px-2 py-1 rounded",
    },
    buttons: {
      download: "bg-blue-600 hover:bg-blue-700",
      select: "border-gray-300 text-gray-700 hover:bg-gray-50",
      delete: "text-red-600 hover:text-red-700 hover:bg-red-50 border-red-200",
      refresh: "border-gray-300 text-gray-700 hover:bg-gray-50",
    },
  },
  settings: {
    container: "bg-white border border-purple-200 rounded-lg overflow-hidden",
    progress: "bg-purple-50 border-b border-purple-200",
    progressText: "text-purple-900",
    progressBar: "bg-purple-200",
    progressFill: "bg-gradient-to-r from-purple-500 to-purple-600",
    header: "font-medium text-purple-900",
    modelCard: {
      selected: "border-purple-500 bg-purple-50",
      default: "border-purple-200 bg-white hover:border-purple-300",
    },
    badges: {
      selected: "text-xs text-purple-600 bg-purple-100 px-2 py-1 rounded-full font-medium",
      downloaded: "text-xs text-emerald-600 bg-emerald-100 px-2 py-1 rounded-md",
    },
    buttons: {
      download: "bg-purple-600 hover:bg-purple-700",
      select: "border-purple-300 text-purple-700 hover:bg-purple-50",
      delete: "text-red-600 hover:text-red-700 hover:bg-red-50 border-red-200",
      refresh: "border-purple-300 text-purple-700 hover:bg-purple-50",
    },
  },
};

function formatETA(seconds: number): string {
  if (seconds < 60) return `${Math.round(seconds)}s`;
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = Math.round(seconds % 60);
  return `${minutes}m ${remainingSeconds}s`;
}

export default function UnifiedModelPicker({
  selectedModel,
  onModelSelect,
  modelType,
  className = "",
  variant = "settings",
}: UnifiedModelPickerProps) {
  const [models, setModels] = useState<Model[]>([]);
  const [downloadingModel, setDownloadingModel] = useState<string | null>(null);
  const [downloadProgress, setDownloadProgress] = useState<DownloadProgress>({
    percentage: 0,
    downloadedBytes: 0,
    totalBytes: 0,
  });
  const [loadingModels, setLoadingModels] = useState(false);
  const [llamaCppStatus, setLlamaCppStatus] = useState<{
    isInstalled: boolean;
    version?: string;
    checking: boolean;
  }>({ isInstalled: true, checking: false }); // Default to true for now

  const {
    showConfirmDialog,
    showAlertDialog,
  } = useDialogs();
  const { toast } = useToast();
  const styles = useMemo(() => VARIANT_STYLES[variant], [variant]);

  // Check llama.cpp installation for LLM models
  // Commented out for now - defaulting to installed
  /*
  useEffect(() => {
    if (modelType === 'llm') {
      const checkLlamaCpp = async () => {
        try {
          const result = await window.electronAPI?.llamaCppCheck();
          setLlamaCppStatus({
            isInstalled: result?.isInstalled || false,
            version: result?.version,
            checking: false,
          });
        } catch {
          setLlamaCppStatus({ isInstalled: false, checking: false });
        }
      };
      checkLlamaCpp();
    }
  }, [modelType]);
  */

  const loadModels = useCallback(async () => {
    try {
      setLoadingModels(true);
      
      if (modelType === 'whisper') {
        const result = await window.electronAPI.listWhisperModels();
        if (result.success) {
          const whisperModels: Model[] = result.models.map((m: any) => ({
            ...m,
            id: m.model,
            name: m.model.charAt(0).toUpperCase() + m.model.slice(1),
            size: m.size_mb ? `${m.size_mb}MB` : 'Unknown',
            description: {
              tiny: "Fastest, lower quality",
              base: "Good balance (recommended)",
              small: "Better quality, slower",
              medium: "High quality",
              large: "Best quality, slowest",
              turbo: "Fast with good quality"
            }[m.model] || "Model",
            type: 'whisper' as const,
            isDownloaded: m.downloaded,
            recommended: m.model === 'base'
          }));
          setModels(whisperModels);
        }
      } else {
        console.log('[UnifiedModelPicker] Loading LLM models...');
        const result = await window.electronAPI.modelGetAll();
        console.log('[UnifiedModelPicker] Got result:', result);
        
        if (!result || !Array.isArray(result)) {
          console.error('[UnifiedModelPicker] Invalid result format:', result);
          setModels([]);
          return;
        }
        
        const llmModels: Model[] = result.map((m: any) => ({
          ...m,
          type: 'llm' as const,
          downloaded: m.isDownloaded
        }));
        console.log('[UnifiedModelPicker] Mapped models:', llmModels);
        setModels(llmModels);
      }
    } catch (error) {
      console.error("[UnifiedModelPicker] Failed to load models:", error);
      setModels([]);
    } finally {
      setLoadingModels(false);
    }
  }, [modelType]);

  useEffect(() => {
    loadModels();
  }, [loadModels]);

  const handleDownloadProgress = useCallback((_event: any, data: any) => {
    if (modelType === 'whisper') {
      // Whisper progress format
      if (data.type === "progress") {
        const progress: DownloadProgress = {
          percentage: data.percentage || 0,
          downloadedBytes: data.downloaded_bytes || 0,
          totalBytes: data.total_bytes || 0,
        };

        if (data.speed_mbps && data.speed_mbps > 0) {
          const remainingBytes = progress.totalBytes - progress.downloadedBytes;
          progress.eta = (remainingBytes * 8) / (data.speed_mbps * 1_000_000);
          progress.speed = data.speed_mbps;
        }

        setDownloadProgress(progress);
      } else if (data.type === "complete" || data.type === "error") {
        setDownloadingModel(null);
        setDownloadProgress({ percentage: 0, downloadedBytes: 0, totalBytes: 0 });
        loadModels();
      }
    } else {
      // LLM progress format
      setDownloadProgress({
        percentage: data.progress || 0,
        downloadedBytes: data.downloadedSize || 0,
        totalBytes: data.totalSize || 0,
      });
    }
  }, [modelType, loadModels]);

  useEffect(() => {
    if (modelType === 'whisper') {
      window.electronAPI.onWhisperDownloadProgress(handleDownloadProgress);
    } else {
      window.electronAPI.onModelDownloadProgress(handleDownloadProgress);
    }
  }, [handleDownloadProgress, modelType]);

  const downloadModel = useCallback(async (modelId: string) => {
    try {
      setDownloadingModel(modelId);
      setDownloadProgress({ percentage: 0, downloadedBytes: 0, totalBytes: 0 });
      onModelSelect(modelId);

      if (modelType === 'whisper') {
        const result = await window.electronAPI.downloadWhisperModel(modelId);
        if (!result.success && !result.error?.includes("interrupted by user")) {
          showAlertDialog({
            title: "Download Failed",
            description: `Failed to download model: ${result.error}`,
          });
        }
      } else {
        await window.electronAPI.modelDownload(modelId);
      }
      
      await loadModels();
    } catch (error: any) {
      if (!error.toString().includes("interrupted by user")) {
        showAlertDialog({
          title: "Download Failed",
          description: `Failed to download model: ${error}`,
        });
      }
    } finally {
      setDownloadingModel(null);
      setDownloadProgress({ percentage: 0, downloadedBytes: 0, totalBytes: 0 });
    }
  }, [modelType, onModelSelect, loadModels, showAlertDialog]);

  const deleteModel = useCallback(async (modelId: string) => {
    showConfirmDialog({
      title: "Delete Model",
      description: `Are you sure you want to delete this model? You'll need to re-download it if you want to use it again.`,
      onConfirm: async () => {
        try {
          if (modelType === 'whisper') {
            const result = await window.electronAPI.deleteWhisperModel(modelId);
            if (result.success) {
              toast({
                title: "Model Deleted",
                description: `Model deleted successfully! Freed ${result.freed_mb}MB of disk space.`,
              });
            }
          } else {
            await window.electronAPI.modelDelete(modelId);
            toast({
              title: "Model Deleted",
              description: "Model deleted successfully!",
            });
          }
          loadModels();
        } catch (error) {
          showAlertDialog({
            title: "Delete Failed",
            description: `Failed to delete model: ${error}`,
          });
        }
      },
      variant: "destructive",
    });
  }, [modelType, loadModels, showConfirmDialog, showAlertDialog, toast]);

  const handleInstallLlamaCpp = async () => {
    try {
      const result = await window.electronAPI?.llamaCppInstall();
      if (result?.success) {
        const status = await window.electronAPI?.llamaCppCheck();
        setLlamaCppStatus({
          isInstalled: status?.isInstalled || false,
          version: status?.version,
          checking: false,
        });
        loadModels();
      }
    } catch (error) {
      console.error("Installation error:", error);
    }
  };

  // Show llama.cpp installation prompt for LLM models
  if (modelType === 'llm' && !llamaCppStatus.isInstalled && !llamaCppStatus.checking) {
    return (
      <div className={`${styles.container} ${className}`}>
        <div className="p-4">
          <h3 className="text-lg font-semibold mb-4">Local AI Models</h3>
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription className="space-y-3">
              <p>llama.cpp is required to run local AI models.</p>
              <div className="flex items-center gap-3">
                <Button onClick={handleInstallLlamaCpp} size="sm">
                  Install llama.cpp
                </Button>
                <Button
                  variant="link"
                  className="p-0 h-auto text-primary"
                  onClick={() => window.electronAPI?.openExternal("https://github.com/ggerganov/llama.cpp#installation")}
                >
                  Manual installation
                  <ExternalLink className="ml-1 h-3 w-3" />
                </Button>
              </div>
            </AlertDescription>
          </Alert>
        </div>
      </div>
    );
  }

  const progressDisplay = useMemo(() => {
    if (!downloadingModel) return null;

    const { percentage, speed, eta } = downloadProgress;
    const progressText = `${Math.round(percentage)}%`;
    const speedText = speed ? ` • ${speed.toFixed(1)} MB/s` : "";
    const etaText = eta ? ` • ETA: ${formatETA(eta)}` : "";

    return (
      <div className={`${styles.progress} p-3`}>
        <div className="flex items-center justify-between mb-2">
          <span className={`text-sm font-medium ${styles.progressText}`}>
            Downloading {models.find(m => m.id === downloadingModel)?.name || downloadingModel}...
          </span>
          <span className={`text-xs ${styles.progressText}`}>
            {progressText}{speedText}{etaText}
          </span>
        </div>
        <div className={`w-full ${styles.progressBar} rounded-full h-2`}>
          <div
            className={`${styles.progressFill} h-2 rounded-full transition-all duration-300 ease-out`}
            style={{ width: `${Math.min(percentage, 100)}%` }}
          />
        </div>
      </div>
    );
  }, [downloadingModel, downloadProgress, models, styles]);

  return (
    <div className={`${styles.container} ${className}`}>
      {progressDisplay}

      <div className="p-4">
        <div className="flex items-center justify-between mb-3">
          <h5 className={styles.header}>
            {modelType === 'whisper' ? 'Whisper Models' : 'Local AI Models'}
          </h5>
          <Button
            onClick={loadModels}
            variant="outline"
            size="sm"
            disabled={loadingModels}
            className={styles.buttons.refresh}
          >
            <RefreshCw size={14} className={loadingModels ? "animate-spin" : ""} />
            <span className="ml-1">{loadingModels ? "Checking..." : "Refresh"}</span>
          </Button>
        </div>

        <div className="space-y-2">
          {models.map((model) => {
            const modelId = model.id || model.model || '';
            const isSelected = modelId === selectedModel;
            const isDownloading = downloadingModel === modelId;
            const isDownloaded = model.downloaded || model.isDownloaded;

            return (
              <div
                key={modelId}
                className={`flex items-center justify-between p-3 rounded-lg border-2 transition-all ${
                  isSelected ? styles.modelCard.selected : styles.modelCard.default
                }`}
              >
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-medium">{model.name}</span>
                    {isSelected && (
                      <span className={styles.badges.selected}>✓ Selected</span>
                    )}
                    {model.recommended && (
                      <span className="text-xs bg-primary/10 text-primary px-2 py-1 rounded">
                        Recommended
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2 mt-1">
                    <p className="text-xs text-gray-600">{model.description}</p>
                    <span className="text-xs text-gray-500">• {model.size}</span>
                    {isDownloaded && (
                      <span className={styles.badges.downloaded}>✓ Downloaded</span>
                    )}
                  </div>
                </div>

                <div className="flex gap-2">
                  {isDownloaded && (
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
                        onClick={() => deleteModel(modelId)}
                        size="sm"
                        variant="outline"
                        className={styles.buttons.delete}
                      >
                        <Trash2 size={14} />
                        <span className="ml-1">Delete</span>
                      </Button>
                    </>
                  )}
                  {!isDownloaded && !isDownloading && (
                    <Button
                      onClick={() => downloadModel(modelId)}
                      size="sm"
                      className={styles.buttons.download}
                    >
                      <Download size={14} />
                      <span className="ml-1">Download</span>
                    </Button>
                  )}
                  {isDownloading && (
                    <Button disabled size="sm" className={styles.buttons.download}>
                      {`${Math.round(downloadProgress.percentage)}%`}
                    </Button>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {modelType === 'llm' && (
          <div className="mt-6 text-xs text-muted-foreground">
            <p>Models are stored in: ~/.cache/openwispr/models/</p>
          </div>
        )}
      </div>
    </div>
  );
}