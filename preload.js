const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("electronAPI", {
  pasteText: (text) => ipcRenderer.invoke("paste-text", text),
  hideWindow: () => ipcRenderer.invoke("hide-window"),
  showDictationPanel: () => ipcRenderer.invoke("show-dictation-panel"),
  onToggleDictation: (callback) => ipcRenderer.on("toggle-dictation", callback),

  // Database functions
  saveTranscription: (text) =>
    ipcRenderer.invoke("db-save-transcription", text),
  getTranscriptions: (limit) =>
    ipcRenderer.invoke("db-get-transcriptions", limit),
  clearTranscriptions: () => ipcRenderer.invoke("db-clear-transcriptions"),
  deleteTranscription: (id) =>
    ipcRenderer.invoke("db-delete-transcription", id),
  onTranscriptionAdded: (callback) =>
    ipcRenderer.on("transcription-added", callback),

  // Environment variables
  getOpenAIKey: () => ipcRenderer.invoke("get-openai-key"),
  saveOpenAIKey: (key) => ipcRenderer.invoke("save-openai-key", key),
  createProductionEnvFile: (key) =>
    ipcRenderer.invoke("create-production-env-file", key),

  // Settings management
  saveSettings: (settings) => ipcRenderer.invoke("save-settings", settings),

  // Clipboard functions
  readClipboard: () => ipcRenderer.invoke("read-clipboard"),
  writeClipboard: (text) => ipcRenderer.invoke("write-clipboard", text),

  // Python installation functions
  checkPythonInstallation: () =>
    ipcRenderer.invoke("check-python-installation"),
  installPython: () => ipcRenderer.invoke("install-python"),
  onPythonInstallProgress: (callback) =>
    ipcRenderer.on("python-install-progress", callback),

  // Local Whisper functions
  transcribeLocalWhisper: (audioBlob, options) =>
    ipcRenderer.invoke("transcribe-local-whisper", audioBlob, options),
  checkWhisperInstallation: () =>
    ipcRenderer.invoke("check-whisper-installation"),
  installWhisper: () => ipcRenderer.invoke("install-whisper"),
  onWhisperInstallProgress: (callback) =>
    ipcRenderer.on("whisper-install-progress", callback),
  downloadWhisperModel: (modelName) =>
    ipcRenderer.invoke("download-whisper-model", modelName),
  onWhisperDownloadProgress: (callback) =>
    ipcRenderer.on("whisper-download-progress", callback),
  checkModelStatus: (modelName) =>
    ipcRenderer.invoke("check-model-status", modelName),
  listWhisperModels: () => ipcRenderer.invoke("list-whisper-models"),
  deleteWhisperModel: (modelName) =>
    ipcRenderer.invoke("delete-whisper-model", modelName),
  cancelWhisperDownload: () => ipcRenderer.invoke("cancel-whisper-download"),
  checkFFmpegAvailability: () =>
    ipcRenderer.invoke("check-ffmpeg-availability"),

  // Window control functions
  windowMinimize: () => ipcRenderer.invoke("window-minimize"),
  windowMaximize: () => ipcRenderer.invoke("window-maximize"),
  windowClose: () => ipcRenderer.invoke("window-close"),
  windowIsMaximized: () => ipcRenderer.invoke("window-is-maximized"),
  getPlatform: () => process.platform,

  // Cleanup function
  cleanupApp: () => ipcRenderer.invoke("cleanup-app"),
  updateHotkey: (hotkey) => ipcRenderer.invoke("update-hotkey", hotkey),
  startWindowDrag: () => ipcRenderer.invoke("start-window-drag"),
  stopWindowDrag: () => ipcRenderer.invoke("stop-window-drag"),
  setMainWindowInteractivity: (interactive) =>
    ipcRenderer.invoke("set-main-window-interactivity", interactive),

  // Update functions
  checkForUpdates: () => ipcRenderer.invoke("check-for-updates"),
  downloadUpdate: () => ipcRenderer.invoke("download-update"),
  installUpdate: () => ipcRenderer.invoke("install-update"),
  getAppVersion: () => ipcRenderer.invoke("get-app-version"),
  getUpdateStatus: () => ipcRenderer.invoke("get-update-status"),
  getUpdateInfo: () => ipcRenderer.invoke("get-update-info"),

  // Update event listeners
  onUpdateAvailable: (callback) => ipcRenderer.on("update-available", callback),
  onUpdateNotAvailable: (callback) =>
    ipcRenderer.on("update-not-available", callback),
  onUpdateDownloaded: (callback) =>
    ipcRenderer.on("update-downloaded", callback),
  onUpdateDownloadProgress: (callback) =>
    ipcRenderer.on("update-download-progress", callback),
  onUpdateError: (callback) => ipcRenderer.on("update-error", callback),

  // Audio event listeners
  onNoAudioDetected: (callback) =>
    ipcRenderer.on("no-audio-detected", callback),

  // External link opener
  openExternal: (url) => ipcRenderer.invoke("open-external", url),
  
  // Model management functions
  modelGetAll: () => ipcRenderer.invoke("model-get-all"),
  modelCheck: (modelId) => ipcRenderer.invoke("model-check", modelId),
  modelDownload: (modelId) => ipcRenderer.invoke("model-download", modelId),
  modelDelete: (modelId) => ipcRenderer.invoke("model-delete", modelId),
  modelDeleteAll: () => ipcRenderer.invoke("model-delete-all"),
  modelCheckRuntime: () => ipcRenderer.invoke("model-check-runtime"),
  onModelDownloadProgress: (callback) => ipcRenderer.on("model-download-progress", callback),
  
  // Anthropic API
  getAnthropicKey: () => ipcRenderer.invoke("get-anthropic-key"),
  saveAnthropicKey: (key) => ipcRenderer.invoke("save-anthropic-key", key),

  // Gemini API
  getGeminiKey: () => ipcRenderer.invoke("get-gemini-key"),
  saveGeminiKey: (key) => ipcRenderer.invoke("save-gemini-key", key),
  
  // Local reasoning
  processLocalReasoning: (text, modelId, agentName, config) => 
    ipcRenderer.invoke("process-local-reasoning", text, modelId, agentName, config),
  checkLocalReasoningAvailable: () => 
    ipcRenderer.invoke("check-local-reasoning-available"),
  
  // Anthropic reasoning
  processAnthropicReasoning: (text, modelId, agentName, config) =>
    ipcRenderer.invoke("process-anthropic-reasoning", text, modelId, agentName, config),

  // Anthropic generic request (for translation)
  anthropicRequest: (requestBody) =>
    ipcRenderer.invoke("anthropic-request", requestBody),

  // llama.cpp
  llamaCppCheck: () => ipcRenderer.invoke("llama-cpp-check"),
  llamaCppInstall: () => ipcRenderer.invoke("llama-cpp-install"),
  llamaCppUninstall: () => ipcRenderer.invoke("llama-cpp-uninstall"),
  
  // Debug logging for reasoning pipeline
  logReasoning: (stage, details) =>
    ipcRenderer.invoke("log-reasoning", stage, details),

  // DevTools
  openDevTools: () => ipcRenderer.invoke("open-devtools"),

  // Remove all listeners for a channel
  removeAllListeners: (channel) => {
    ipcRenderer.removeAllListeners(channel);
  },
});
