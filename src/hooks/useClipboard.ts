import { useCallback } from "react";
import { useTranslation } from "react-i18next";

export interface UseClipboardReturn {
  pasteFromClipboard: (setter: (value: string) => void) => Promise<void>;
  pasteFromClipboardWithFallback: (setter: (value: string) => void) => Promise<void>;
}

export interface UseClipboardProps {
  showAlertDialog: (dialog: { title: string; description?: string }) => void;
}

export const useClipboard = (
  showAlertDialog?: UseClipboardProps["showAlertDialog"]
): UseClipboardReturn => {
  const { t } = useTranslation();
  const pasteFromClipboard = useCallback(async (setter: (value: string) => void) => {
    try {
      const text = await window.electronAPI.readClipboard();
      if (text && text.trim()) {
        setter(text.trim());
      } else {
        throw new Error("Empty clipboard");
      }
    } catch (err) {
      console.error("Clipboard read failed:", err);
      throw err;
    }
  }, []);

  const pasteFromClipboardWithFallback = useCallback(
    async (setter: (value: string) => void) => {
      try {
        // Try Electron clipboard first
        const text = await window.electronAPI.readClipboard();
        if (text && text.trim()) {
          setter(text.trim());
          return;
        }
      } catch (err) {
        console.warn("Electron clipboard failed, trying web API:", err);
      }

      try {
        // Fallback to web clipboard API
        const webText = await navigator.clipboard.readText();
        if (webText && webText.trim()) {
          setter(webText.trim());
          return;
        }
      } catch (err) {
        console.error("Web clipboard also failed:", err);
      }

      if (showAlertDialog) {
        showAlertDialog({
          title: t("hooks.clipboard.pasteFailed.title"),
          description: t("hooks.clipboard.pasteFailed.description"),
        });
      } else {
        alert(t("hooks.clipboard.pasteFailed.description"));
      }
    },
    [showAlertDialog, t]
  );

  return {
    pasteFromClipboard,
    pasteFromClipboardWithFallback,
  };
};
