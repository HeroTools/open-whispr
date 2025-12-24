import { useCallback } from "react";

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
          title: "Clipboard Paste Failed",
          description: "Could not paste from clipboard. Please try typing or using Cmd+V/Ctrl+V.",
        });
      } else {
        alert("Could not paste from clipboard. Please try typing or using Cmd+V/Ctrl+V.");
      }
    },
    [showAlertDialog]
  );

  return {
    pasteFromClipboard,
    pasteFromClipboardWithFallback,
  };
};
