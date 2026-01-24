const { globalShortcut } = require("electron");
const debugLogger = require("./debugLogger");
const PortalHotkeyManager = require("./hotkeyManagerPortal");
const EvdevHotkeyManager = require("./hotkeyManagerEvdev");
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
    // Portal support for Wayland
    this.portalManager = null;
    this.usePortal = false;
    // evdev support for Wayland (fallback)
    this.evdevManager = null;
    this.useEvdev = false;
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
   * Try to initialize Wayland-compatible global shortcuts
   * Priority: GNOME native > XDG Portal > evdev > X11/XWayland
   */
  async initializeWaylandShortcuts(callback) {
    if (process.platform !== "linux" || !isWayland) {
      return false;
    }

    // 1. Try GNOME native keyboard shortcuts (best - no special permissions)
    if (GnomeShortcutManager.isGnome()) {
      try {
        this.gnomeManager = new GnomeShortcutManager();

        // Start D-Bus service to receive toggle commands
        const dbusOk = await this.gnomeManager.initDBusService(callback);
        if (dbusOk) {
          this.useGnome = true;
          this.hotkeyCallback = callback;
          return "gnome";
        }
      } catch (err) {
        this.gnomeManager = null;
        this.useGnome = false;
      }
    }

    // 2. Try XDG Portal (works on KDE, Hyprland, etc.)
    try {
      this.portalManager = new PortalHotkeyManager();
      await this.portalManager.init();
      await this.portalManager.createSession();

      this.usePortal = true;
      this.hotkeyCallback = callback;
      return true;
    } catch (err) {
      if (this.portalManager) {
        this.portalManager.close().catch(() => {});
      }
      this.portalManager = null;
      this.usePortal = false;
    }

    // 3. Try evdev (works if user is in input group)
    if (EvdevHotkeyManager.isAvailable()) {
      try {
        this.evdevManager = new EvdevHotkeyManager();
        await this.evdevManager.start("Alt+R", callback);
        this.useEvdev = true;
        return "evdev";
      } catch (evdevErr) {
        this.evdevManager = null;
        this.useEvdev = false;
      }
    }

    // 4. Fall back to X11/XWayland
    return false;
  }

  async initializeHotkey(mainWindow, callback) {
    if (!mainWindow || !callback) {
      throw new Error("mainWindow and callback are required");
    }

    this.mainWindow = mainWindow;
    this.hotkeyCallback = callback;

    // On Linux Wayland, try native methods first
    if (process.platform === "linux" && isWayland) {
      const result = await this.initializeWaylandShortcuts(callback);

      if (result === "gnome") {
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
          } catch (err) {
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

      if (result === "evdev") {
        // evdev initialized, bind actual hotkey after renderer is ready
        const bindEvdevHotkey = async () => {
          try {
            const savedHotkey = await mainWindow.webContents.executeJavaScript(`
              localStorage.getItem("dictationKey") || ""
            `);
            const hotkey = savedHotkey && savedHotkey.trim() !== "" ? savedHotkey : "Alt+R";

            await this.evdevManager.stop();
            await this.evdevManager.start(hotkey, callback);
            this.currentHotkey = hotkey;
          } catch (err) {
            // Silently fail
          }
        };

        if (mainWindow.webContents.isLoading()) {
          mainWindow.webContents.once("did-finish-load", () => setTimeout(bindEvdevHotkey, 1000));
        } else {
          setTimeout(bindEvdevHotkey, 1000);
        }
        this.isInitialized = true;
        return;
      }

      if (result === true) {
        // XDG Portal initialized, bind hotkey after renderer is ready
        const bindHotkey = () => {
          setTimeout(() => {
            this.loadSavedHotkeyOrDefaultWithPortal(mainWindow, callback);
          }, 1000);
        };

        if (mainWindow.webContents.isLoading()) {
          mainWindow.webContents.once("did-finish-load", bindHotkey);
        } else {
          bindHotkey();
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

  /**
   * Load saved hotkey and bind via portal
   */
  async loadSavedHotkeyOrDefaultWithPortal(mainWindow, callback) {
    try {
      const savedHotkey = await mainWindow.webContents.executeJavaScript(`
        localStorage.getItem("dictationKey") || ""
      `);

      const hotkey = savedHotkey && savedHotkey.trim() !== ""
        ? savedHotkey
        : "Alt+R";  // Default for portal

      debugLogger.log(`[HotkeyManager] Binding hotkey "${hotkey}" via XDG Portal`);

      await this.portalManager.bindShortcut(hotkey, callback);
      this.currentHotkey = hotkey;
      debugLogger.log(`[HotkeyManager] Portal hotkey "${hotkey}" bound successfully`);

      // Notify the user about portal mode
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send("hotkey-portal-mode", {
          hotkey,
          message: `Using native Wayland shortcuts via XDG Portal. Hotkey: ${hotkey}`,
        });
      }
    } catch (err) {
      this.usePortal = false;
      if (this.portalManager) {
        this.portalManager.close().catch(() => {});
      }
      this.portalManager = null;

      // Try evdev as second fallback (works if user has input device access)
      if (EvdevHotkeyManager.isAvailable()) {
        try {
          const hotkey = await mainWindow.webContents.executeJavaScript(`
            localStorage.getItem("dictationKey") || ""
          `);
          const hotkeyToUse = hotkey && hotkey.trim() !== "" ? hotkey : "Alt+R";

          this.evdevManager = new EvdevHotkeyManager();
          await this.evdevManager.start(hotkeyToUse, callback);
          this.useEvdev = true;
          this.currentHotkey = hotkeyToUse;
          return;
        } catch (evdevErr) {
          this.useEvdev = false;
          this.evdevManager = null;
        }
      }

      // Final fallback to X11/XWayland
      this.loadSavedHotkeyOrDefault(mainWindow, callback);
    }
  }

  async loadSavedHotkeyOrDefault(mainWindow, callback) {
    try {
      const savedHotkey = await mainWindow.webContents.executeJavaScript(`
        localStorage.getItem("dictationKey") || ""
      `);

      if (savedHotkey && savedHotkey.trim() !== "") {
        const result = this.setupShortcuts(savedHotkey, callback);
        if (result.success) {
          return;
        }
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
        return;
      }

      const fallbackHotkeys = ["F8", "F9", "CommandOrControl+Shift+Space"];

      for (const fallback of fallbackHotkeys) {
        const fallbackResult = this.setupShortcuts(fallback, callback);
        if (fallbackResult.success) {
          // Save the working fallback to localStorage
          this.saveHotkeyToRenderer(fallback);
          // Notify renderer about the fallback
          this.notifyHotkeyFallback(defaultHotkey, fallback);
          return;
        }
      }

      this.notifyHotkeyFailure(defaultHotkey, result);
    } catch (err) {
      // Failed to initialize hotkey
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
        return { success: true, message: `Hotkey updated to: ${hotkey} (via GNOME native shortcut - works everywhere!)` };
      }

      // If using portal, rebind via portal
      if (this.usePortal && this.portalManager) {
        debugLogger.log(`[HotkeyManager] Updating portal hotkey to "${hotkey}"`);
        // Close existing session and create new one
        await this.portalManager.close();
        await this.portalManager.init();
        await this.portalManager.createSession();
        await this.portalManager.bindShortcut(hotkey, callback);
        this.currentHotkey = hotkey;
        this.saveHotkeyToRenderer(hotkey);
        return { success: true, message: `Hotkey updated to: ${hotkey} (via XDG Portal)` };
      }

      // If using evdev, rebind via evdev
      if (this.useEvdev && this.evdevManager) {
        debugLogger.log(`[HotkeyManager] Updating evdev hotkey to "${hotkey}"`);
        await this.evdevManager.stop();
        await this.evdevManager.start(hotkey, callback);
        this.currentHotkey = hotkey;
        this.saveHotkeyToRenderer(hotkey);
        return { success: true, message: `Hotkey updated to: ${hotkey} (via evdev - works everywhere!)` };
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
    // Close portal session if active
    if (this.portalManager) {
      this.portalManager.close().catch((err) => {
        debugLogger.warn("[HotkeyManager] Error closing portal session:", err.message);
      });
      this.portalManager = null;
      this.usePortal = false;
    }
    // Stop evdev listener if active
    if (this.evdevManager) {
      this.evdevManager.stop().catch((err) => {
        debugLogger.warn("[HotkeyManager] Error stopping evdev listener:", err.message);
      });
      this.evdevManager = null;
      this.useEvdev = false;
    }
    globalShortcut.unregisterAll();
  }

  /**
   * Check if using XDG Portal for shortcuts
   */
  isUsingPortal() {
    return this.usePortal;
  }

  /**
   * Check if using evdev for shortcuts
   */
  isUsingEvdev() {
    return this.useEvdev;
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
