import { useState, useCallback } from "react";

export interface UsePermissionsReturn {
  // State
  micPermissionGranted: boolean;
  accessibilityPermissionGranted: boolean;
  micPermissionError: string | null;

  requestMicPermission: () => Promise<void>;
  testAccessibilityPermission: () => Promise<void>;
  openMicPrivacySettings: () => Promise<void>;
  openSoundInputSettings: () => Promise<void>;
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
  const [micPermissionError, setMicPermissionError] = useState<string | null>(
    null
  );
  const [accessibilityPermissionGranted, setAccessibilityPermissionGranted] =
    useState(false);

  const openMicPrivacySettings = useCallback(async () => {
    try {
      await window.electronAPI?.openMicrophoneSettings?.();
    } catch (error) {
      console.error("Failed to open microphone privacy settings:", error);
    }
  }, []);

  const openSoundInputSettings = useCallback(async () => {
    try {
      await window.electronAPI?.openSoundInputSettings?.();
    } catch (error) {
      console.error("Failed to open sound input settings:", error);
    }
  }, []);

  const requestMicPermission = useCallback(async () => {
    if (
      !navigator?.mediaDevices ||
      typeof navigator.mediaDevices.getUserMedia !== "function"
    ) {
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

  const testAccessibilityPermission = useCallback(async () => {
    try {
      await window.electronAPI.pasteText("OpenWhispr accessibility test");
      setAccessibilityPermissionGranted(true);
      if (showAlertDialog) {
        showAlertDialog({
          title: "✅ Accessibility Test Successful",
          description:
            "Accessibility permissions working! Check if the test text appeared in another app.",
        });
      } else {
        alert(
          "✅ Accessibility permissions working! Check if the test text appeared in another app."
        );
      }
    } catch (err) {
      console.error("Accessibility permission test failed:", err);
      if (showAlertDialog) {
        showAlertDialog({
          title: "❌ Accessibility Permissions Needed",
          description:
            "Please grant accessibility permissions in System Settings to enable automatic text pasting.",
        });
      } else {
        alert(
          "❌ Accessibility permissions needed! Please grant them in System Settings."
        );
      }
    }
  }, [showAlertDialog]);

  return {
    micPermissionGranted,
    accessibilityPermissionGranted,
    micPermissionError,
    requestMicPermission,
    testAccessibilityPermission,
    openMicPrivacySettings,
    openSoundInputSettings,
    setMicPermissionGranted,
    setAccessibilityPermissionGranted,
  };
};
