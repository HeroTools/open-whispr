import { useState, useEffect, useCallback, useRef } from "react";

/**
 * Centralized hook for managing app updates.
 * Prevents EventEmitter memory leaks by ensuring update listeners
 * are only registered once globally using a singleton pattern.
 */

interface UpdateStatus {
  updateAvailable: boolean;
  updateDownloaded: boolean;
  isDevelopment: boolean;
}

interface UpdateInfo {
  version?: string;
  releaseDate?: string;
  releaseNotes?: string;
  files?: any[];
}

interface UpdateProgress {
  percent: number;
  transferred: number;
  total: number;
}

interface UpdateState {
  status: UpdateStatus;
  info: UpdateInfo | null;
  downloadProgress: number;
  isChecking: boolean;
  isDownloading: boolean;
  isInstalling: boolean;
  error: Error | null;
}

// Global state shared across all hook instances
let globalState: UpdateState = {
  status: {
    updateAvailable: false,
    updateDownloaded: false,
    isDevelopment: false,
  },
  info: null,
  downloadProgress: 0,
  isChecking: false,
  isDownloading: false,
  isInstalling: false,
  error: null,
};

// Listeners registry for global state updates
const stateListeners = new Set<(state: UpdateState) => void>();

// Flag to track if event listeners have been registered
let listenersRegistered = false;
const cleanupFunctions: Array<() => void> = [];

/**
 * Notify all hook instances of state changes
 */
function notifyListeners() {
  stateListeners.forEach((listener) => listener({ ...globalState }));
}

/**
 * Update global state and notify all listeners
 */
function updateGlobalState(updates: Partial<UpdateState>) {
  globalState = { ...globalState, ...updates };
  notifyListeners();
}

/**
 * Register IPC event listeners (only once globally)
 */
function registerEventListeners() {
  if (listenersRegistered || !window.electronAPI) {
    return;
  }

  listenersRegistered = true;

  // Update available
  if (window.electronAPI.onUpdateAvailable) {
    const dispose = window.electronAPI.onUpdateAvailable((_event, info) => {
      updateGlobalState({
        status: { ...globalState.status, updateAvailable: true },
        info: info || globalState.info,
      });
    });
    if (dispose) cleanupFunctions.push(dispose);
  }

  // Update not available
  if (window.electronAPI.onUpdateNotAvailable) {
    const dispose = window.electronAPI.onUpdateNotAvailable(() => {
      updateGlobalState({
        status: {
          ...globalState.status,
          updateAvailable: false,
          updateDownloaded: false,
        },
        info: null,
        isChecking: false,
      });
    });
    if (dispose) cleanupFunctions.push(dispose);
  }

  // Update downloaded
  if (window.electronAPI.onUpdateDownloaded) {
    const dispose = window.electronAPI.onUpdateDownloaded((_event, info) => {
      updateGlobalState({
        status: { ...globalState.status, updateDownloaded: true },
        info: info || globalState.info,
        downloadProgress: 100,
        isDownloading: false,
        isInstalling: false,
      });
    });
    if (dispose) cleanupFunctions.push(dispose);
  }

  // Download progress
  if (window.electronAPI.onUpdateDownloadProgress) {
    const dispose = window.electronAPI.onUpdateDownloadProgress((_event, progressObj) => {
      updateGlobalState({
        downloadProgress: progressObj?.percent || 0,
        isDownloading: true,
      });
    });
    if (dispose) cleanupFunctions.push(dispose);
  }

  // Update error
  if (window.electronAPI.onUpdateError) {
    const dispose = window.electronAPI.onUpdateError((_event, error) => {
      updateGlobalState({
        isChecking: false,
        isDownloading: false,
        isInstalling: false,
        error: error instanceof Error ? error : new Error(String(error)),
      });
    });
    if (dispose) cleanupFunctions.push(dispose);
  }
}

/**
 * Cleanup function (called when last hook instance unmounts)
 */
function cleanup() {
  if (stateListeners.size === 0 && listenersRegistered) {
    cleanupFunctions.forEach((fn) => fn());
    cleanupFunctions.length = 0;
    listenersRegistered = false;
  }
}

/**
 * Custom hook for app update management
 *
 * Features:
 * - Singleton pattern prevents duplicate event listeners
 * - Shared state across all component instances
 * - Automatic cleanup when no components are using it
 *
 * @returns Update state and control functions
 */
export function useUpdater() {
  const [state, setState] = useState<UpdateState>(globalState);
  const isInstallingRef = useRef(false);

  useEffect(() => {
    // Register this component as a state listener
    stateListeners.add(setState);

    // Register global event listeners (only once)
    registerEventListeners();

    // Initialize update status from main process
    const initializeUpdateStatus = async () => {
      try {
        if (window.electronAPI?.getUpdateStatus) {
          const status = await window.electronAPI.getUpdateStatus();
          updateGlobalState({ status });
        }

        if (window.electronAPI?.getUpdateInfo) {
          const info = await window.electronAPI.getUpdateInfo();
          if (info) {
            updateGlobalState({ info });
          }
        }
      } catch (error) {
        console.error("Failed to initialize update status:", error);
      }
    };

    initializeUpdateStatus();

    // Cleanup on unmount
    return () => {
      stateListeners.delete(setState);
      cleanup();
    };
  }, []);

  /**
   * Check for updates manually
   */
  const checkForUpdates = useCallback(async () => {
    updateGlobalState({ isChecking: true, error: null });
    try {
      const result = await window.electronAPI.checkForUpdates();
      updateGlobalState({ isChecking: false });
      return result;
    } catch (error) {
      updateGlobalState({
        isChecking: false,
        error: error instanceof Error ? error : new Error(String(error)),
      });
      throw error;
    }
  }, []);

  /**
   * Download the available update
   */
  const downloadUpdate = useCallback(async () => {
    if (state.status.updateDownloaded) {
      return { success: true, message: "Update already downloaded" };
    }

    updateGlobalState({ isDownloading: true, downloadProgress: 0, error: null });
    try {
      const result = await window.electronAPI.downloadUpdate();
      return result;
    } catch (error) {
      updateGlobalState({
        isDownloading: false,
        error: error instanceof Error ? error : new Error(String(error)),
      });
      throw error;
    }
  }, [state.status.updateDownloaded]);

  /**
   * Install the downloaded update and restart the app
   */
  const installUpdate = useCallback(async () => {
    if (!state.status.updateDownloaded) {
      throw new Error("No update available to install");
    }

    updateGlobalState({ isInstalling: true, error: null });
    isInstallingRef.current = true;

    try {
      await window.electronAPI.installUpdate();

      // Set a timeout to reset state if app doesn't quit
      setTimeout(() => {
        if (isInstallingRef.current) {
          isInstallingRef.current = false;
          updateGlobalState({ isInstalling: false });
        }
      }, 10000);
    } catch (error) {
      isInstallingRef.current = false;
      updateGlobalState({
        isInstalling: false,
        error: error instanceof Error ? error : new Error(String(error)),
      });
      throw error;
    }
  }, [state.status.updateDownloaded]);

  /**
   * Get the current app version
   */
  const getAppVersion = useCallback(async () => {
    try {
      const result = await window.electronAPI.getAppVersion();
      return result.version;
    } catch (error) {
      console.error("Failed to get app version:", error);
      return null;
    }
  }, []);

  return {
    // State
    status: state.status,
    info: state.info,
    downloadProgress: state.downloadProgress,
    isChecking: state.isChecking,
    isDownloading: state.isDownloading,
    isInstalling: state.isInstalling,
    error: state.error,

    // Actions
    checkForUpdates,
    downloadUpdate,
    installUpdate,
    getAppVersion,
  };
}
