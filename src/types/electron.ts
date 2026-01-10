export interface TranscriptionItem {
  id: number;
  text: string;
  timestamp: string;
  created_at: string;
}

export interface WhisperInstallResult {
  success: boolean;
  message: string;
  output: string;
}

export interface WhisperCheckResult {
  installed: boolean;
  working: boolean;
  error?: string;
}

export interface WhisperModelResult {
  success: boolean;
  model: string;
  downloaded: boolean;
  size_mb?: number;
  error?: string;
}

export interface WhisperModelDeleteResult {
  success: boolean;
  model: string;
  deleted: boolean;
  freed_mb?: number;
  error?: string;
}

export interface WhisperModelsListResult {
  success: boolean;
  models: Array<{ model: string; downloaded: boolean; size_mb?: number }>;
  cache_dir: string;
}

export interface UpdateCheckResult {
  updateAvailable: boolean;
  version?: string;
  releaseDate?: string;
  files?: any[];
  releaseNotes?: string;
  message?: string;
}

export interface UpdateStatusResult {
  updateAvailable: boolean;
  updateDownloaded: boolean;
  isDevelopment: boolean;
}

export interface UpdateInfoResult {
  version?: string;
  releaseDate?: string;
  releaseNotes?: string | null;
  files?: any[];
}

export interface UpdateResult {
  success: boolean;
  message: string;
}

export interface AppVersionResult {
  version: string;
}

export interface WhisperDownloadProgressData {
  type: string;
  model: string;
  percentage?: number;
  downloaded_bytes?: number;
  total_bytes?: number;
  error?: string;
  result?: any;
}

export interface WhisperInstallProgressData {
  type: string;
  message: string;
  output?: string;
}

export interface PythonInstallation {
  installed: boolean;
  command?: string;
  version?: number;
}

export interface PythonInstallResult {
  success: boolean;
  method: string;
}

export interface PythonInstallProgressData {
  type: string;
  stage: string;
  percentage: number;
}

// Additional interface missing from preload.js
export interface SaveSettings {
  useLocalWhisper: boolean;
  apiKey: string;
  whisperModel: string;
  hotkey: string;
}

declare global {
  interface Window {
    electronAPI: {
      // Basic window operations
      pasteText: (text: string) => Promise<void>;
      hideWindow: () => Promise<void>;
      showDictationPanel: () => Promise<void>;
      onToggleDictation: (callback: () => void) => (() => void) | void;

      // Database operations
      saveTranscription: (
        text: string
      ) => Promise<{ id: number; success: boolean }>;
      getTranscriptions: (limit?: number) => Promise<TranscriptionItem[]>;
      clearTranscriptions: () => Promise<{ cleared: number; success: boolean }>;
      deleteTranscription: (id: number) => Promise<{ success: boolean }>;
      onTranscriptionAdded?: (
        callback: (item: TranscriptionItem) => void
      ) => (() => void) | void;
      onTranscriptionDeleted?: (
        callback: (payload: { id: number }) => void
      ) => (() => void) | void;
      onTranscriptionsCleared?: (
        callback: (payload: { cleared: number }) => void
      ) => (() => void) | void;

      // API key management
      getOpenAIKey: () => Promise<string>;
      saveOpenAIKey: (key: string) => Promise<{ success: boolean }>;
      createProductionEnvFile: (key: string) => Promise<void>;
      getAnthropicKey: () => Promise<string | null>;
      saveAnthropicKey: (key: string) => Promise<void>;

      // Clipboard operations
      readClipboard: () => Promise<string>;
      writeClipboard: (text: string) => Promise<{ success: boolean }>;
      pasteFromClipboard: () => Promise<{ success: boolean; error?: string }>;
      pasteFromClipboardWithFallback: () => Promise<{ success: boolean; error?: string }>;

      // Settings
      getSettings: () => Promise<any>;
      updateSettings: (settings: any) => Promise<void>;

      // Audio
      getAudioDevices: () => Promise<MediaDeviceInfo[]>;
      transcribeAudio: (audioData: ArrayBuffer) => Promise<{
        success: boolean;
        text?: string;
        error?: string;
      }>;
      onNoAudioDetected: (
        callback: (event: any, data?: any) => void
      ) => (() => void) | void;

      // Python operations
      checkPythonInstallation: () => Promise<PythonInstallation>;
      installPython: () => Promise<PythonInstallResult>;
      onPythonInstallProgress: (
        callback: (event: any, data: PythonInstallProgressData) => void
      ) => (() => void) | void;

      // Whisper operations
      transcribeLocalWhisper: (
        audioBlob: Blob | ArrayBuffer,
        options?: any
      ) => Promise<any>;
      checkWhisperInstallation: () => Promise<WhisperCheckResult>;
      installWhisper: () => Promise<WhisperInstallResult>;
      onWhisperInstallProgress: (
        callback: (event: any, data: WhisperInstallProgressData) => void
      ) => (() => void) | void;
      downloadWhisperModel: (modelName: string) => Promise<WhisperModelResult>;
      onWhisperDownloadProgress: (
        callback: (event: any, data: WhisperDownloadProgressData) => void
      ) => (() => void) | void;
      checkModelStatus: (modelName: string) => Promise<WhisperModelResult>;
      listWhisperModels: () => Promise<WhisperModelsListResult>;
      deleteWhisperModel: (
        modelName: string
      ) => Promise<WhisperModelDeleteResult>;
      cancelWhisperDownload: () => Promise<{
        success: boolean;
        message?: string;
        error?: string;
      }>;

      // Local AI model management
      modelGetAll: () => Promise<any[]>;
      modelCheck: (modelId: string) => Promise<boolean>;
      modelDownload: (modelId: string) => Promise<void>;
      modelDelete: (modelId: string) => Promise<void>;
      modelDeleteAll: () => Promise<{ success: boolean; error?: string; code?: string }>;
      modelCheckRuntime: () => Promise<boolean>;
      onModelDownloadProgress: (
        callback: (event: any, data: any) => void
      ) => (() => void) | void;
      
      // Local reasoning
      processLocalReasoning: (text: string, modelId: string, agentName: string | null, config: any) => Promise<{ success: boolean; text?: string; error?: string }>;
      checkLocalReasoningAvailable: () => Promise<boolean>;
      
      // Anthropic reasoning
      processAnthropicReasoning: (text: string, modelId: string, agentName: string | null, config: any) => Promise<{ success: boolean; text?: string; error?: string }>;
      
      // llama.cpp management
      llamaCppCheck: () => Promise<{ isInstalled: boolean; version?: string }>;
      llamaCppInstall: () => Promise<{ success: boolean; error?: string }>;
      llamaCppUninstall: () => Promise<{ success: boolean; error?: string }>;

      // Window control operations
      windowMinimize: () => Promise<void>;
      windowMaximize: () => Promise<void>;
      windowClose: () => Promise<void>;
      windowIsMaximized: () => Promise<boolean>;
      getPlatform: () => string;
      startWindowDrag: () => Promise<void>;
      stopWindowDrag: () => Promise<void>;
      setMainWindowInteractivity: (interactive: boolean) => Promise<void>;

      // App management
      appQuit: () => Promise<void>;
      cleanupApp: () => Promise<{ success: boolean; message: string }>;
      getTranscriptionHistory: () => Promise<any[]>;
      clearTranscriptionHistory: () => Promise<void>;

      // Update operations
      checkForUpdates: () => Promise<UpdateCheckResult>;
      downloadUpdate: () => Promise<UpdateResult>;
      installUpdate: () => Promise<UpdateResult>;
      getAppVersion: () => Promise<AppVersionResult>;
      getUpdateStatus: () => Promise<UpdateStatusResult>;
      getUpdateInfo: () => Promise<UpdateInfoResult | null>;

      // Update event listeners
      onUpdateAvailable: (
        callback: (event: any, info: any) => void
      ) => (() => void) | void;
      onUpdateNotAvailable: (
        callback: (event: any, info: any) => void
      ) => (() => void) | void;
      onUpdateDownloaded: (
        callback: (event: any, info: any) => void
      ) => (() => void) | void;
      onUpdateDownloadProgress: (
        callback: (event: any, progressObj: any) => void
      ) => (() => void) | void;
      onUpdateError: (
        callback: (event: any, error: any) => void
      ) => (() => void) | void;

      // Settings management (used by OnboardingFlow but not in preload.js)
      saveSettings?: (settings: SaveSettings) => Promise<void>;

      // External URL operations
      openExternal: (
        url: string
      ) => Promise<{ success: boolean; error?: string } | void>;

      // Event listener cleanup
      removeAllListeners: (channel: string) => void;

      // Hotkey management
      updateHotkey: (key: string) => Promise<{ success: boolean; message: string }>;
      
      // Gemini API key management
      getGeminiKey: () => Promise<string | null>;
      saveGeminiKey: (key: string) => Promise<void>;
      
      // Debug logging
      getLogLevel?: () => Promise<string>;
      log?: (entry: {
        level: string;
        message: string;
        meta?: any;
        scope?: string;
        source?: string;
      }) => Promise<void>;
      
      // FFmpeg availability
      checkFFmpegAvailability: () => Promise<boolean>;
    };
    
    api?: {
      sendDebugLog: (message: string) => void;
    };
  }
}
