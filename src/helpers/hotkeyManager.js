const { globalShortcut } = require("electron");
const debugLogger = require("./debugLogger");

// Suggested alternative hotkeys when registration fails
const SUGGESTED_HOTKEYS = {
  single: ["F8", "F9", "F10", "Pause", "ScrollLock"],
  compound: [
    "CommandOrControl+Shift+Space",
    "CommandOrControl+Shift+D",
    "Alt+Space",
    "CommandOrControl+`",
  ],
};

class HotkeyManager {
  constructor() {
    this.currentHotkey = "`";
    this.isInitialized = false;
  }

  /**
   * Get a helpful error message based on the failure reason
   */
  getFailureReason(hotkey) {
    // Check if the hotkey is already registered by us
    if (globalShortcut.isRegistered(hotkey)) {
      return {
        reason: "already_registered",
        message: `"${hotkey}" is already registered by another application.`,
        suggestions: this.getSuggestions(hotkey),
      };
    }

    // Platform-specific checks
    if (process.platform === "win32") {
      // Windows reserves certain keys
      const winReserved = ["PrintScreen", "Win", "Super"];
      if (winReserved.some((k) => hotkey.includes(k))) {
        return {
          reason: "os_reserved",
          message: `"${hotkey}" is reserved by Windows.`,
          suggestions: this.getSuggestions(hotkey),
        };
      }
    }

    if (process.platform === "linux") {
      // Linux DE's often reserve Super/Meta combinations
      if (hotkey.includes("Super") || hotkey.includes("Meta")) {
        return {
          reason: "os_reserved",
          message: `"${hotkey}" may be reserved by your desktop environment.`,
          suggestions: this.getSuggestions(hotkey),
        };
      }
    }

    // Generic failure - could be another app holding it
    return {
      reason: "registration_failed",
      message: `Could not register "${hotkey}". It may be in use by another application.`,
      suggestions: this.getSuggestions(hotkey),
    };
  }

  /**
   * Get alternative hotkey suggestions based on what the user tried
   */
  getSuggestions(failedHotkey) {
    const isCompound = failedHotkey.includes("+");
    const suggestions = isCompound
      ? [...SUGGESTED_HOTKEYS.compound]
      : [...SUGGESTED_HOTKEYS.single];

    // Filter out the failed hotkey if it's in the suggestions
    return suggestions.filter((s) => s !== failedHotkey).slice(0, 3);
  }

  setupShortcuts(hotkey = "`", callback) {
    if (!callback) {
      throw new Error("Callback function is required for hotkey setup");
    }

    debugLogger.log(`[HotkeyManager] Setting up hotkey: "${hotkey}"`);
    debugLogger.log(`[HotkeyManager] Platform: ${process.platform}, Arch: ${process.arch}`);

    if (this.currentHotkey && this.currentHotkey !== "GLOBE") {
      debugLogger.log(`[HotkeyManager] Unregistering previous hotkey: "${this.currentHotkey}"`);
      globalShortcut.unregister(this.currentHotkey);
    }

    try {
      if (hotkey === "GLOBE") {
        if (process.platform !== "darwin") {
          debugLogger.log("[HotkeyManager] GLOBE key rejected - not on macOS");
          return {
            success: false,
            error: "The Globe key is only available on macOS.",
          };
        }
        this.currentHotkey = hotkey;
        debugLogger.log("[HotkeyManager] GLOBE key set successfully");
        return { success: true, hotkey };
      }

      // Check if already registered before attempting
      const alreadyRegistered = globalShortcut.isRegistered(hotkey);
      debugLogger.log(`[HotkeyManager] Is "${hotkey}" already registered? ${alreadyRegistered}`);

      // Register the new hotkey
      const success = globalShortcut.register(hotkey, callback);
      debugLogger.log(`[HotkeyManager] Registration result for "${hotkey}": ${success}`);

      if (success) {
        this.currentHotkey = hotkey;
        debugLogger.log(`[HotkeyManager] Hotkey "${hotkey}" registered successfully`);
        return { success: true, hotkey };
      } else {
        const failureInfo = this.getFailureReason(hotkey);
        console.error(`[HotkeyManager] Failed to register hotkey: ${hotkey}`, failureInfo);
        debugLogger.log(`[HotkeyManager] Registration failed:`, failureInfo);

        // Build user-friendly error message with suggestions
        let errorMessage = failureInfo.message;
        if (failureInfo.suggestions.length > 0) {
          errorMessage += ` Try: ${failureInfo.suggestions.join(", ")}`;
        }

        return {
          success: false,
          error: errorMessage,
          reason: failureInfo.reason,
          suggestions: failureInfo.suggestions,
        };
      }
    } catch (error) {
      console.error("[HotkeyManager] Error setting up shortcuts:", error);
      debugLogger.log(`[HotkeyManager] Exception during registration:`, error.message);
      return { success: false, error: error.message };
    }
  }

  async initializeHotkey(mainWindow, callback) {
    if (!mainWindow || !callback) {
      throw new Error("mainWindow and callback are required");
    }

    // Set up default hotkey first
    this.setupShortcuts("`", callback);

    // Listen for window to be ready, then get saved hotkey
    mainWindow.webContents.once("did-finish-load", () => {
      setTimeout(() => {
        this.loadSavedHotkey(mainWindow, callback);
      }, 1000);
    });

    this.isInitialized = true;
  }

  async loadSavedHotkey(mainWindow, callback) {
    try {
      const savedHotkey = await mainWindow.webContents.executeJavaScript(`
        localStorage.getItem("dictationKey") || "\`"
      `);

      if (savedHotkey && savedHotkey !== "`") {
        const result = this.setupShortcuts(savedHotkey, callback);
        if (result.success) {
          // Hotkey initialized from localStorage
        }
      }
    } catch (err) {
      console.error("Failed to get saved hotkey:", err);
    }
  }

  async updateHotkey(hotkey, callback) {
    if (!callback) {
      throw new Error("Callback function is required for hotkey update");
    }

    try {
      const result = this.setupShortcuts(hotkey, callback);
      if (result.success) {
        return { success: true, message: `Hotkey updated to: ${hotkey}` };
      } else {
        return {
          success: false,
          message: result.error,
          suggestions: result.suggestions,
        };
      }
    } catch (error) {
      console.error("Failed to update hotkey:", error);
      return {
        success: false,
        message: `Failed to update hotkey: ${error.message}`,
      };
    }
  }

  getCurrentHotkey() {
    return this.currentHotkey;
  }

  unregisterAll() {
    globalShortcut.unregisterAll();
  }

  isHotkeyRegistered(hotkey) {
    return globalShortcut.isRegistered(hotkey);
  }
}

module.exports = HotkeyManager;
