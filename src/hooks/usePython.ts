import { useState, useEffect, useCallback } from "react";

interface PythonInstallation {
  installed: boolean;
  command?: string;
  version?: number;
}

interface PythonInstallProgress {
  stage: string;
  percentage: number;
}

interface ShowAlertDialog {
  (options: { title: string; description: string }): void;
}

const ERROR_MESSAGES: Record<string, string> = {
  "Permission denied": "Please run the application as administrator and try again.",
  "access is denied": "Please run the application as administrator and try again.",
  Network: "Please check your internet connection and try again.",
  "No supported package manager": "Please install Python manually from python.org",
  "not found in PATH": "Python installed but not found in PATH. Please restart the application.",
};

function getPythonInstallErrorMessage(error: Error): string {
  const errorMessage = error.message || "";

  for (const [key, message] of Object.entries(ERROR_MESSAGES)) {
    if (errorMessage.includes(key)) {
      return message;
    }
  }

  return `Python installation failed: ${errorMessage}`;
}

export function usePython(showAlertDialog: ShowAlertDialog) {
  const [pythonInstalled, setPythonInstalled] = useState<boolean>(false);
  const [installingPython, setInstallingPython] = useState<boolean>(false);
  const [installProgress, setInstallProgress] = useState<string>("");
  const [pythonInfo, setPythonInfo] = useState<PythonInstallation | null>(null);
  const [isChecking, setIsChecking] = useState<boolean>(false);

  const checkPythonInstallation = useCallback(async () => {
    if (isChecking) {
      return pythonInfo || { installed: false };
    }

    try {
      setIsChecking(true);

      if (!window.electronAPI) {
        return { installed: false };
      }

      const result = await window.electronAPI.checkPythonInstallation();

      if (result) {
        setPythonInstalled(result.installed);
        setPythonInfo(result);
        return result;
      }
      return { installed: false };
    } catch (error) {
      setPythonInstalled(false);
      return { installed: false };
    } finally {
      setIsChecking(false);
    }
  }, [isChecking, pythonInfo]);

  const installPython = useCallback(async () => {
    if (!window.electronAPI) {
      showAlertDialog({
        title: "Installation Error",
        description: "Unable to communicate with the main process. Please restart the application.",
      });
      return;
    }

    let progressListener: ((event: any, data: PythonInstallProgress) => void) | null = null;

    try {
      setInstallingPython(true);
      setInstallProgress("Starting Python installation...");

      progressListener = (_event: any, data: any) => {
        if (data?.type === "progress" && data?.stage && data?.percentage !== undefined) {
          setInstallProgress(`${data.stage} (${data.percentage}%)`);
        }
      };

      // Listen for progress updates
      if (window.electronAPI.onPythonInstallProgress) {
        window.electronAPI.onPythonInstallProgress(progressListener);
      }

      const result = await window.electronAPI.installPython();

      if (result?.success) {
        setPythonInstalled(true);
        setInstallProgress("Python installed successfully!");

        // Re-check installation to get updated info
        await checkPythonInstallation();

        showAlertDialog({
          title: "Python Installed",
          description: `Python has been installed successfully using ${result.method}!`,
        });
      }

      return result;
    } catch (error: any) {
      const errorMessage = getPythonInstallErrorMessage(error);

      showAlertDialog({
        title: "Installation Failed",
        description: errorMessage,
      });

      throw error;
    } finally {
      setInstallingPython(false);
      // Clean up the listener
      if (progressListener) {
        window.electronAPI?.removeAllListeners?.("python-install-progress");
      }
    }
  }, [showAlertDialog, checkPythonInstallation]);

  // Check Python installation on mount with a small delay to ensure preload is ready
  useEffect(() => {
    // In development, there might be a race condition where React loads before preload
    const timer = setTimeout(() => {
      checkPythonInstallation();
    }, 100); // Small delay to ensure preload script is ready

    return () => clearTimeout(timer);
  }, [checkPythonInstallation]);

  return {
    pythonInstalled,
    installingPython,
    installProgress,
    pythonInfo,
    installPython,
    checkPythonInstallation,
    isChecking,
  };
}
