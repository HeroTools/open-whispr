import { useState, useCallback, useRef } from "react";
import { formatHotkeyLabel } from "../utils/hotkeys";

export interface UseHotkeyRegistrationOptions {
  /**
   * Callback fired when hotkey is successfully registered
   */
  onSuccess?: (hotkey: string) => void;

  /**
   * Callback fired when hotkey registration fails
   */
  onError?: (error: string, hotkey: string) => void;

  /**
   * Show toast notification on success (default: true)
   */
  showSuccessToast?: boolean;

  /**
   * Show toast notification on error (default: true)
   */
  showErrorToast?: boolean;

  /**
   * Custom toast/alert function for showing messages
   */
  showAlert?: (options: { title: string; description: string }) => void;
}

export interface UseHotkeyRegistrationResult {
  /**
   * Register a new hotkey with the system
   */
  registerHotkey: (hotkey: string) => Promise<boolean>;

  /**
   * Whether a registration is currently in progress
   */
  isRegistering: boolean;

  /**
   * The last error message, if any
   */
  lastError: string | null;

  /**
   * Clear the last error
   */
  clearError: () => void;
}

/**
 * Shared hook for hotkey registration with consistent error handling
 * and success/failure notifications.
 *
 * @example
 * const { registerHotkey, isRegistering } = useHotkeyRegistration({
 *   onSuccess: (hotkey) => setDictationKey(hotkey),
 *   showAlert: showAlertDialog,
 * });
 *
 * // Later, when user selects a hotkey:
 * await registerHotkey("CommandOrControl+Shift+K");
 */
export function useHotkeyRegistration(
  options: UseHotkeyRegistrationOptions = {}
): UseHotkeyRegistrationResult {
  const {
    onSuccess,
    onError,
    showSuccessToast = true,
    showErrorToast = true,
    showAlert,
  } = options;

  const [isRegistering, setIsRegistering] = useState(false);
  const [lastError, setLastError] = useState<string | null>(null);

  // Use ref to track in-flight requests and prevent double registration
  const registrationInFlightRef = useRef(false);

  const clearError = useCallback(() => {
    setLastError(null);
  }, []);

  const registerHotkey = useCallback(
    async (hotkey: string): Promise<boolean> => {
      // Prevent double registration
      if (registrationInFlightRef.current) {
        return false;
      }

      // Validate hotkey format
      if (!hotkey || hotkey.trim() === "") {
        const errorMsg = "Please enter a valid hotkey";
        setLastError(errorMsg);
        if (showErrorToast && showAlert) {
          showAlert({
            title: "Invalid Hotkey",
            description: errorMsg,
          });
        }
        onError?.(errorMsg, hotkey);
        return false;
      }

      // Check if Electron API is available
      if (!window.electronAPI?.updateHotkey) {
        // In non-Electron environment, just succeed silently
        onSuccess?.(hotkey);
        return true;
      }

      try {
        registrationInFlightRef.current = true;
        setIsRegistering(true);
        setLastError(null);

        const result = await window.electronAPI.updateHotkey(hotkey);

        if (!result?.success) {
          const errorMsg =
            result?.message ||
            "This key could not be registered. Please choose a different key.";
          setLastError(errorMsg);

          if (showErrorToast && showAlert) {
            showAlert({
              title: "Hotkey Not Registered",
              description: errorMsg,
            });
          }

          onError?.(errorMsg, hotkey);
          return false;
        }

        // Success!
        if (showSuccessToast && showAlert) {
          const displayLabel = formatHotkeyLabel(hotkey);
          showAlert({
            title: "Hotkey Saved",
            description: `Now using ${displayLabel} for dictation`,
          });
        }

        onSuccess?.(hotkey);
        return true;
      } catch (error) {
        const errorMsg =
          error instanceof Error
            ? error.message
            : "Failed to register hotkey. Please try again.";
        setLastError(errorMsg);

        if (showErrorToast && showAlert) {
          showAlert({
            title: "Hotkey Error",
            description: errorMsg,
          });
        }

        onError?.(errorMsg, hotkey);
        return false;
      } finally {
        setIsRegistering(false);
        registrationInFlightRef.current = false;
      }
    },
    [onSuccess, onError, showSuccessToast, showErrorToast, showAlert]
  );

  return {
    registerHotkey,
    isRegistering,
    lastError,
    clearError,
  };
}

export default useHotkeyRegistration;
