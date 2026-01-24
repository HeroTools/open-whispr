const { globalShortcut } = require("electron");
const debugLogger = require("./debugLogger");
const GnomeShortcutManager = require("./gnomeShortcut");

// Check if running on Wayland
const isWayland = process.env.XDG_SESSION_TYPE === "wayland";

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
    this.isListeningMode = false;
    // GNOME native shortcut support
    this.gnomeManager = null;
    this.useGnome = false;
    this.hotkeyCallback = null;
  }

  setListeningMode(enabled) {
    this.isListeningMode = enabled;
    debugLogger.log(`[HotkeyManager] Listening mode: ${enabled ? "enabled" : "disabled"}`);
  }

  isInListeningMode() {
    return this.isListeningMode;
  }

  getFailureReason(hotkey) {
    if (globalShortcut.isRegistered(hotkey)) {
      return {
        reason: "already_registered",
        message: `"${hotkey}" is already registered by another application.`,
        suggestions: this.getSuggestions(hotkey),
      };
    }

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

    return {
      reason: "registration_failed",
      message: `Could not register "${hotkey}". It may be in use by another application.`,
      suggestions: this.getSuggestions(hotkey),
    };
  }

  getSuggestions(failedHotkey) {
    const isCompound = failedHotkey.includes("+");
    const suggestions = isCompound
      ? [...SUGGESTED_HOTKEYS.compound]
      : [...SUGGESTED_HOTKEYS.single];

    return suggestions.filter((s) => s !== failedHotkey).slice(0, 3);
  }

  setupShortcuts(hotkey = "`", callback) {
    if (!callback) {
      throw new Error("Callback function is required for hotkey setup");
    }

    debugLogger.log(`[HotkeyManager] Setting up hotkey: "${hotkey}"`);
    debugLogger.log(`[HotkeyManager] Platform: ${process.platform}, Arch: ${process.arch}`);
    debugLogger.log(`[HotkeyManager] Current hotkey: "${this.currentHotkey}"`);

    // If we're already using this hotkey, just return success
    if (hotkey === this.currentHotkey) {
      debugLogger.log(
        `[HotkeyManager] Hotkey "${hotkey}" is already the current hotkey, no change needed`
      );
      return { success: true, hotkey };
    }

    // Unregister the previous hotkey (if it's not GLOBE, which doesn't use globalShortcut)
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

      const alreadyRegistered = globalShortcut.isRegistered(hotkey);
      debugLogger.log(`[HotkeyManager] Is "${hotkey}" already registered? ${alreadyRegistered}`);

      if (process.platform === "linux") {
        globalShortcut.unregister(hotkey);
      }

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

  /**
   * Try to initialize GNOME native shortcuts for Wayland
   */
  async initializeGnomeShortcuts(callback) {
    if (process.platform !== "linux" || !isWayland) {
      return false;
    }

    // Try GNOME native keyboard shortcuts (no special permissions needed)
    if (GnomeShortcutManager.isGnome()) {
      try {
        this.gnomeManager = new GnomeShortcutManager();

        // Start D-Bus service to receive toggle commands
        const dbusOk = await this.gnomeManager.initDBusService(callback);
        if (dbusOk) {
          this.useGnome = true;
          this.hotkeyCallback = callback;
          return true;
        }
      } catch (err) {
        debugLogger.log("[HotkeyManager] GNOME shortcut init failed:", err.message);
        this.gnomeManager = null;
        this.useGnome = false;
      }
    }

    return false;
  }

  async initializeHotkey(mainWindow, callback) {
    if (!mainWindow || !callback) {
      throw new Error("mainWindow and callback are required");
    }

    this.mainWindow = mainWindow;
    this.hotkeyCallback = callback;

    // On Linux Wayland + GNOME, try native shortcuts first
    if (process.platform === "linux" && isWayland) {
      const gnomeOk = await this.initializeGnomeShortcuts(callback);

      if (gnomeOk) {
        // GNOME D-Bus service ready, register keybinding after window loads
        const registerGnomeHotkey = async () => {
          try {
            const savedHotkey = await mainWindow.webContents.executeJavaScript(`
              localStorage.getItem("dictationKey") || ""
            `);
            const hotkey = savedHotkey && savedHotkey.trim() !== "" ? savedHotkey : "Alt+R";
            const gnomeHotkey = GnomeShortcutManager.convertToGnomeFormat(hotkey);

            await this.gnomeManager.registerKeybinding(gnomeHotkey);
            this.currentHotkey = hotkey;
            debugLogger.log(`[HotkeyManager] GNOME hotkey "${hotkey}" registered successfully`);
          } catch (err) {
            debugLogger.log("[HotkeyManager] GNOME keybinding failed, falling back to X11:", err.message);
            // Fall back to X11
            this.useGnome = false;
            this.loadSavedHotkeyOrDefault(mainWindow, callback);
          }
        };

        if (mainWindow.webContents.isLoading()) {
          mainWindow.webContents.once("did-finish-load", () => setTimeout(registerGnomeHotkey, 1000));
        } else {
          setTimeout(registerGnomeHotkey, 1000);
        }
        this.isInitialized = true;
        return;
      }
    }

    if (process.platform === "linux") {
      globalShortcut.unregisterAll();
    }

    mainWindow.webContents.once("did-finish-load", () => {
      setTimeout(() => {
        this.loadSavedHotkeyOrDefault(mainWindow, callback);
      }, 1000);
    });

    this.isInitialized = true;
  }

  async loadSavedHotkeyOrDefault(mainWindow, callback) {
    try {
      const savedHotkey = await mainWindow.webContents.executeJavaScript(`
        localStorage.getItem("dictationKey") || ""
      `);

      if (savedHotkey && savedHotkey.trim() !== "") {
        const result = this.setupShortcuts(savedHotkey, callback);
        if (result.success) {
          debugLogger.log(`[HotkeyManager] Restored saved hotkey: "${savedHotkey}"`);
          return;
        }
        debugLogger.log(`[HotkeyManager] Saved hotkey "${savedHotkey}" failed to register`);
        this.notifyHotkeyFailure(savedHotkey, result);
      }

      const defaultHotkey = process.platform === "darwin" ? "GLOBE" : "`";

      if (defaultHotkey === "GLOBE") {
        this.currentHotkey = "GLOBE";
        debugLogger.log("[HotkeyManager] Using GLOBE key as default on macOS");
        return;
      }

      const result = this.setupShortcuts(defaultHotkey, callback);
      if (result.success) {
        debugLogger.log(
          `[HotkeyManager] Default hotkey "${defaultHotkey}" registered successfully`
        );
        return;
      }

      debugLogger.log(
        `[HotkeyManager] Default hotkey "${defaultHotkey}" failed, trying fallbacks...`
      );
      const fallbackHotkeys = ["F8", "F9", "CommandOrControl+Shift+Space"];

      for (const fallback of fallbackHotkeys) {
        const fallbackResult = this.setupShortcuts(fallback, callback);
        if (fallbackResult.success) {
          debugLogger.log(`[HotkeyManager] Fallback hotkey "${fallback}" registered successfully`);
          // Save the working fallback to localStorage
          this.saveHotkeyToRenderer(fallback);
          // Notify renderer about the fallback
          this.notifyHotkeyFallback(defaultHotkey, fallback);
          return;
        }
      }

      debugLogger.log("[HotkeyManager] All hotkey fallbacks failed");
      this.notifyHotkeyFailure(defaultHotkey, result);
    } catch (err) {
      console.error("Failed to initialize hotkey:", err);
      debugLogger.error("[HotkeyManager] Failed to initialize hotkey:", err);
    }
  }

  saveHotkeyToRenderer(hotkey) {
    if (this.mainWindow && !this.mainWindow.isDestroyed()) {
      this.mainWindow.webContents
        .executeJavaScript(
          `
        localStorage.setItem("dictationKey", "${hotkey}");
      `
        )
        .catch((err) => {
          debugLogger.error("[HotkeyManager] Failed to save hotkey to localStorage:", err);
        });
    }
  }

  notifyHotkeyFallback(originalHotkey, fallbackHotkey) {
    if (this.mainWindow && !this.mainWindow.isDestroyed()) {
      this.mainWindow.webContents.send("hotkey-fallback-used", {
        original: originalHotkey,
        fallback: fallbackHotkey,
        message: `The "${originalHotkey}" key was unavailable. Using "${fallbackHotkey}" instead. You can change this in Settings.`,
      });
    }
  }

  notifyHotkeyFailure(hotkey, result) {
    if (this.mainWindow && !this.mainWindow.isDestroyed()) {
      this.mainWindow.webContents.send("hotkey-registration-failed", {
        hotkey,
        error: result?.error || `Could not register "${hotkey}"`,
        suggestions: result?.suggestions || ["F8", "F9", "CommandOrControl+Shift+Space"],
      });
    }
  }

  async updateHotkey(hotkey, callback) {
    if (!callback) {
      throw new Error("Callback function is required for hotkey update");
    }

    try {
      // If using GNOME, rebind via gsettings
      if (this.useGnome && this.gnomeManager) {
        debugLogger.log(`[HotkeyManager] Updating GNOME hotkey to "${hotkey}"`);
        const gnomeHotkey = GnomeShortcutManager.convertToGnomeFormat(hotkey);
        await this.gnomeManager.updateKeybinding(gnomeHotkey);
        this.currentHotkey = hotkey;
        this.saveHotkeyToRenderer(hotkey);
        return { success: true, message: `Hotkey updated to: ${hotkey} (via GNOME native shortcut)` };
      }

      const result = this.setupShortcuts(hotkey, callback);
      if (result.success) {
        this.saveHotkeyToRenderer(hotkey);
        return { success: true, message: `Hotkey updated to: ${hotkey}` };
      } else {
        return {
          success: false,
          message: result.error,
          suggestions: result.suggestions,
        };
      }
    } catch (error) {
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
    // Close GNOME shortcut if active
    if (this.gnomeManager) {
      this.gnomeManager.unregisterKeybinding().catch((err) => {
        debugLogger.warn("[HotkeyManager] Error unregistering GNOME keybinding:", err.message);
      });
      this.gnomeManager.close();
      this.gnomeManager = null;
      this.useGnome = false;
    }
    globalShortcut.unregisterAll();
  }

  /**
   * Check if using GNOME native shortcuts
   */
  isUsingGnome() {
    return this.useGnome;
  }

  isHotkeyRegistered(hotkey) {
    return globalShortcut.isRegistered(hotkey);
  }
}

module.exports = HotkeyManager;
