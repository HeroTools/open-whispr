import { useState, useCallback, useEffect } from "react";
import type { PasteToolsResult } from "../types/electron";

export interface UsePermissionsReturn {
  // State
  micPermissionGranted: boolean;
  accessibilityPermissionGranted: boolean;
  micPermissionError: string | null;
  pasteToolsInfo: PasteToolsResult | null;
  isCheckingPasteTools: boolean;

  requestMicPermission: () => Promise<void>;
  testAccessibilityPermission: () => Promise<void>;
  checkPasteToolsAvailability: () => Promise<PasteToolsResult | null>;
  openMicPrivacySettings: () => Promise<void>;
  openSoundInputSettings: () => Promise<void>;
  openAccessibilitySettings: () => Promise<void>;
  setMicPermissionGranted: (granted: boolean) => void;
  setAccessibilityPermissionGranted: (granted: boolean) => void;
}

export interface UsePermissionsProps {
  showAlertDialog: (dialog: { title: string; description?: string }) => void;
}

const stopTracks = (stream?: MediaStream) => {
  try {
    stream?.getTracks?.().forEach((track) => track.stop());
  } catch {
    // ignore track cleanup errors
  }
};

const getPlatformSettingsPath = (): string => {
  if (typeof navigator !== "undefined") {
    const ua = navigator.userAgent.toLowerCase();
    if (ua.includes("win")) return "Settings → Privacy → Microphone";
    if (ua.includes("linux")) return "your system sound settings";
  }
  return "System Settings → Sound → Input";
};

const getPlatformPrivacyPath = (): string => {
  if (typeof navigator !== "undefined") {
    const ua = navigator.userAgent.toLowerCase();
    if (ua.includes("win")) return "Settings → Privacy → Microphone";
    if (ua.includes("linux")) return "your system privacy settings";
  }
  return "System Settings → Privacy & Security → Microphone";
};

const getPlatform = (): "darwin" | "win32" | "linux" => {
  if (typeof window !== "undefined" && window.electronAPI?.getPlatform) {
    const platform = window.electronAPI.getPlatform();
    if (platform === "darwin" || platform === "win32" || platform === "linux") {
      return platform;
    }
  }
  // Fallback to user agent detection
  if (typeof navigator !== "undefined") {
    const ua = navigator.userAgent.toLowerCase();
    if (ua.includes("mac")) return "darwin";
    if (ua.includes("win")) return "win32";
    if (ua.includes("linux")) return "linux";
  }
  return "darwin"; // Default fallback
};

const describeMicError = (error: unknown): string => {
  if (!error || typeof error !== "object") {
    return "Microphone access failed. Please try again.";
  }

  const err = error as { name?: string; message?: string };
  const name = err.name || "";
  const message = (err.message || "").toLowerCase();
  const settingsPath = getPlatformSettingsPath();
  const privacyPath = getPlatformPrivacyPath();

  if (name === "NotFoundError") {
    return `No microphones were detected. Connect or select a microphone in ${settingsPath}.`;
  }

  if (name === "NotAllowedError" || name === "SecurityError") {
    return `Permission was denied. Open ${privacyPath} and allow OpenWhispr.`;
  }

  if (name === "NotReadableError" || name === "AbortError") {
    return `Could not start the selected microphone. Choose an input device in ${settingsPath}, then rerun the test.`;
  }

  if (message.includes("no audio input") || message.includes("not available")) {
    return `No active audio input was found. Pick a microphone in ${settingsPath}.`;
  }

  return `Microphone access failed: ${err.message || "Unknown error"}. Select a different input device and try again.`;
};

export const usePermissions = (
  showAlertDialog?: UsePermissionsProps["showAlertDialog"]
): UsePermissionsReturn => {
  const [micPermissionGranted, setMicPermissionGranted] = useState(false);
  const [micPermissionError, setMicPermissionError] = useState<string | null>(null);
  const [accessibilityPermissionGranted, setAccessibilityPermissionGranted] = useState(false);
  const [pasteToolsInfo, setPasteToolsInfo] = useState<PasteToolsResult | null>(null);
  const [isCheckingPasteTools, setIsCheckingPasteTools] = useState(false);

  const openSystemSettings = useCallback(
    async (
      settingType: "microphone" | "sound" | "accessibility",
      apiMethod: () => Promise<{ success: boolean; error?: string } | undefined> | undefined
    ) => {
      const titles = {
        microphone: "Microphone Settings",
        sound: "Sound Settings",
        accessibility: "Accessibility Settings",
      };
      try {
        const result = await apiMethod?.();
        if (result && !result.success && result.error) {
          showAlertDialog?.({ title: titles[settingType], description: result.error });
        }
      } catch (error) {
        console.error(`Failed to open ${settingType} settings:`, error);
        showAlertDialog?.({
          title: titles[settingType],
          description: `Unable to open ${settingType} settings. Please open your system settings manually.`,
        });
      }
    },
    [showAlertDialog]
  );

  const openMicPrivacySettings = useCallback(
    () => openSystemSettings("microphone", window.electronAPI?.openMicrophoneSettings),
    [openSystemSettings]
  );

  const openSoundInputSettings = useCallback(
    () => openSystemSettings("sound", window.electronAPI?.openSoundInputSettings),
    [openSystemSettings]
  );

  const openAccessibilitySettings = useCallback(
    () => openSystemSettings("accessibility", window.electronAPI?.openAccessibilitySettings),
    [openSystemSettings]
  );

  const requestMicPermission = useCallback(async () => {
    if (!navigator?.mediaDevices || typeof navigator.mediaDevices.getUserMedia !== "function") {
      const message =
        "Microphone APIs are unavailable in this environment. Please restart the app.";
      setMicPermissionError(message);
      if (showAlertDialog) {
        showAlertDialog({
          title: "Microphone Unavailable",
          description: message,
        });
      } else {
        alert(message);
      }
      return;
    }

    setMicPermissionError(null);

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      stopTracks(stream);
      setMicPermissionGranted(true);
      setMicPermissionError(null);
    } catch (err) {
      console.error("Microphone permission denied:", err);
      const message = describeMicError(err);
      setMicPermissionError(message);
      if (showAlertDialog) {
        showAlertDialog({
          title: "Microphone Permission Required",
          description: message,
        });
      } else {
        alert(message);
      }
    }
  }, [showAlertDialog]);

  const checkPasteToolsAvailability = useCallback(async (): Promise<PasteToolsResult | null> => {
    setIsCheckingPasteTools(true);
    try {
      if (window.electronAPI?.checkPasteTools) {
        const result = await window.electronAPI.checkPasteTools();
        setPasteToolsInfo(result);

        // On Windows and Linux with tools available, auto-grant accessibility
        if (result.platform === "win32") {
          setAccessibilityPermissionGranted(true);
        } else if (result.platform === "linux" && result.available) {
          setAccessibilityPermissionGranted(true);
        }
        return result;
      }
      return null;
    } catch (error) {
      console.error("Failed to check paste tools:", error);
      return null;
    } finally {
      setIsCheckingPasteTools(false);
    }
  }, []);

  // Check paste tools on mount
  useEffect(() => {
    checkPasteToolsAvailability();
  }, [checkPasteToolsAvailability]);

  const testAccessibilityPermission = useCallback(async () => {
    const platform = getPlatform();

    // On macOS, actually test the accessibility permission
    if (platform === "darwin") {
      try {
        await window.electronAPI.pasteText("OpenWhispr accessibility test");
        setAccessibilityPermissionGranted(true);
      } catch (err) {
        console.error("Accessibility permission test failed:", err);
        if (showAlertDialog) {
          showAlertDialog({
            title: "Accessibility Permissions Needed",
            description:
              "Please grant accessibility permissions in System Settings to enable automatic text pasting.",
          });
        } else {
          alert("Accessibility permissions needed! Please grant them in System Settings.");
        }
      }
      return;
    }

    // On Windows, PowerShell SendKeys is always available
    if (platform === "win32") {
      setAccessibilityPermissionGranted(true);
      if (showAlertDialog) {
        showAlertDialog({
          title: "Ready to Go!",
          description:
            "Windows doesn't require special permissions for automatic pasting. You're all set!",
        });
      }
      return;
    }

    // On Linux, check if paste tools are available
    if (platform === "linux") {
      const result = await checkPasteToolsAvailability();

      if (result?.available) {
        setAccessibilityPermissionGranted(true);
        if (showAlertDialog) {
          const method = result.method || "xdotool";
          const methodLabel =
            result.isWayland && method === "xdotool" ? `${method} (XWayland apps)` : method;
          showAlertDialog({
            title: "Ready to Go!",
            description: `Automatic pasting is available using ${methodLabel}. You're all set!`,
          });
        }
      } else {
        // Don't block, but inform the user
        const isWayland = result?.isWayland;
        const xwaylandAvailable = result?.xwaylandAvailable;
        const recommendedTool = result?.recommendedInstall;
        const installCmd =
          recommendedTool === "wtype"
            ? "sudo dnf install wtype  # Fedora\nsudo apt install wtype  # Debian/Ubuntu"
            : "sudo apt install xdotool  # Debian/Ubuntu/Mint\nsudo dnf install xdotool  # Fedora";

        if (showAlertDialog) {
          if (isWayland && !xwaylandAvailable && !recommendedTool) {
            showAlertDialog({
              title: "Clipboard Mode on Wayland",
              description:
                "Automatic pasting isn't available on this Wayland session. OpenWhispr will copy text to your clipboard and you can paste with Ctrl+V.",
            });
          } else {
            const waylandNote = isWayland
              ? recommendedTool === "wtype"
                ? "\n\nNote: For XWayland apps, xdotool also works."
                : "\n\nNote: Automatic pasting works for XWayland apps only."
              : "";
            showAlertDialog({
              title: "Optional: Install Paste Tool",
              description: `For automatic pasting, install ${recommendedTool || "xdotool"}:\n\n${installCmd}${waylandNote}\n\nWithout this, you can still use OpenWhispr - text will be copied to your clipboard and you can paste with Ctrl+V.`,
            });
          }
        }
        // Still allow proceeding - this is optional
        setAccessibilityPermissionGranted(true);
      }
    }
  }, [showAlertDialog, checkPasteToolsAvailability]);

  return {
    micPermissionGranted,
    accessibilityPermissionGranted,
    micPermissionError,
    pasteToolsInfo,
    isCheckingPasteTools,
    requestMicPermission,
    testAccessibilityPermission,
    checkPasteToolsAvailability,
    openMicPrivacySettings,
    openSoundInputSettings,
    openAccessibilitySettings,
    setMicPermissionGranted,
    setAccessibilityPermissionGranted,
  };
};
