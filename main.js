const { app, globalShortcut, BrowserWindow, dialog, ipcMain } = require("electron");

// Enable native Wayland global shortcuts: https://github.com/electron/electron/pull/45171
if (process.platform === "linux" && process.env.XDG_SESSION_TYPE === "wayland") {
  app.commandLine.appendSwitch("enable-features", "GlobalShortcutsPortal");
}

// Group all windows under single taskbar entry on Windows
if (process.platform === "win32") {
  app.setAppUserModelId("com.herotools.openwispr");
}

const gotSingleInstanceLock = app.requestSingleInstanceLock();

if (!gotSingleInstanceLock) {
  app.exit(0);
}

const isLiveWindow = (window) => window && !window.isDestroyed();

// Ensure macOS menus use the proper casing for the app name
if (process.platform === "darwin" && app.getName() !== "OpenWhispr") {
  app.setName("OpenWhispr");
}

// Add global error handling for uncaught exceptions
process.on("uncaughtException", (error) => {
  console.error("Uncaught Exception:", error);
  // Don't exit the process for EPIPE errors as they're harmless
  if (error.code === "EPIPE") {
    return;
  }
  // For other errors, log and continue
  console.error("Error stack:", error.stack);
});

process.on("unhandledRejection", (reason, promise) => {
  console.error("Unhandled Rejection at:", promise, "reason:", reason);
});

// Import helper module classes (but don't instantiate yet - wait for app.whenReady())
const EnvironmentManager = require("./src/helpers/environment");
const WindowManager = require("./src/helpers/windowManager");
const DatabaseManager = require("./src/helpers/database");
const ClipboardManager = require("./src/helpers/clipboard");
const WhisperManager = require("./src/helpers/whisper");
const ParakeetManager = require("./src/helpers/parakeet");
const TrayManager = require("./src/helpers/tray");
const IPCHandlers = require("./src/helpers/ipcHandlers");
const UpdateManager = require("./src/updater");
const GlobeKeyManager = require("./src/helpers/globeKeyManager");
const WindowsKeyManager = require("./src/helpers/windowsKeyManager");

// Manager instances - initialized after app.whenReady()
let debugLogger = null;
let environmentManager = null;
let windowManager = null;
let hotkeyManager = null;
let databaseManager = null;
let clipboardManager = null;
let whisperManager = null;
let parakeetManager = null;
let trayManager = null;
let updateManager = null;
let globeKeyManager = null;
let windowsKeyManager = null;
let globeKeyAlertShown = false;

// Set up PATH for production builds to find system tools (whisper.cpp, ffmpeg)
function setupProductionPath() {
  if (process.platform === "darwin" && process.env.NODE_ENV !== "development") {
    const commonPaths = [
      "/usr/local/bin",
      "/opt/homebrew/bin",
      "/usr/bin",
      "/bin",
      "/usr/sbin",
      "/sbin",
    ];

    const currentPath = process.env.PATH || "";
    const pathsToAdd = commonPaths.filter((p) => !currentPath.includes(p));

    if (pathsToAdd.length > 0) {
      process.env.PATH = `${currentPath}:${pathsToAdd.join(":")}`;
    }
  }
}

// Initialize all managers - called after app.whenReady()
function initializeManagers() {
  // Set up PATH before initializing managers
  setupProductionPath();

  // Now it's safe to call app.getPath() and initialize managers
  debugLogger = require("./src/helpers/debugLogger");
  // Ensure file logging is initialized now that app is ready
  debugLogger.ensureFileLogging();

  environmentManager = new EnvironmentManager();
  debugLogger.refreshLogLevel();

  windowManager = new WindowManager();
  hotkeyManager = windowManager.hotkeyManager;
  databaseManager = new DatabaseManager();
  clipboardManager = new ClipboardManager();
  whisperManager = new WhisperManager();
  parakeetManager = new ParakeetManager();
  trayManager = new TrayManager();
  updateManager = new UpdateManager();
  globeKeyManager = new GlobeKeyManager();
  windowsKeyManager = new WindowsKeyManager();

  // Set up Globe key error handler on macOS
  if (process.platform === "darwin") {
    globeKeyManager.on("error", (error) => {
      if (globeKeyAlertShown) {
        return;
      }
      globeKeyAlertShown = true;

      const detailLines = [
        error?.message || "Unknown error occurred while starting the Globe listener.",
        "The Globe key shortcut will remain disabled; existing keyboard shortcuts continue to work.",
      ];

      if (process.env.NODE_ENV === "development") {
        detailLines.push(
          "Run `npm run compile:globe` and rebuild the app to regenerate the listener binary."
        );
      } else {
        detailLines.push("Try reinstalling OpenWhispr or contact support if the issue persists.");
      }

      dialog.showMessageBox({
        type: "warning",
        title: "Globe Hotkey Unavailable",
        message: "OpenWhispr could not activate the Globe key hotkey.",
        detail: detailLines.join("\n\n"),
      });
    });
  }

  // Initialize IPC handlers with all managers
  const _ipcHandlers = new IPCHandlers({
    environmentManager,
    databaseManager,
    clipboardManager,
    whisperManager,
    parakeetManager,
    windowManager,
    updateManager,
    windowsKeyManager,
  });
}

// Main application startup
async function startApp() {
  // Initialize all managers now that app is ready
  initializeManagers();

  // In development, add a small delay to let Vite start properly
  if (process.env.NODE_ENV === "development") {
    await new Promise((resolve) => setTimeout(resolve, 2000));
  }

  // Ensure dock is visible on macOS and stays visible
  if (process.platform === "darwin" && app.dock) {
    app.dock.show();
    // Prevent dock from hiding when windows use setVisibleOnAllWorkspaces
    app.setActivationPolicy("regular");
  }

  // Initialize Whisper manager at startup (don't await to avoid blocking)
  // Settings can be provided via environment variables for server pre-warming:
  // - USE_LOCAL_WHISPER=true to enable local whisper mode
  // - LOCAL_WHISPER_MODEL=base (or tiny, small, medium, large, turbo)
  const whisperSettings = {
    useLocalWhisper: process.env.USE_LOCAL_WHISPER === "true",
    whisperModel: process.env.LOCAL_WHISPER_MODEL || "base",
  };
  whisperManager.initializeAtStartup(whisperSettings).catch((err) => {
    // Whisper not being available at startup is not critical
    debugLogger.debug("Whisper startup init error (non-fatal)", { error: err.message });
  });

  // Initialize Parakeet manager at startup (don't await to avoid blocking)
  // Settings can be provided via environment variables for server pre-warming:
  // - LOCAL_TRANSCRIPTION_PROVIDER=nvidia to enable parakeet
  // - PARAKEET_MODEL=parakeet-tdt-0.6b-v3 (model name)
  const parakeetSettings = {
    localTranscriptionProvider: process.env.LOCAL_TRANSCRIPTION_PROVIDER || "",
    parakeetModel: process.env.PARAKEET_MODEL || "parakeet-tdt-0.6b-v3",
  };
  parakeetManager.initializeAtStartup(parakeetSettings).catch((err) => {
    // Parakeet not being available at startup is not critical
    debugLogger.debug("Parakeet startup init error (non-fatal)", { error: err.message });
  });

  // Pre-warm llama-server if local reasoning is configured
  // Settings can be provided via environment variables:
  // - REASONING_PROVIDER=local to enable local reasoning
  // - LOCAL_REASONING_MODEL=qwen3-8b-q4_k_m (or another model ID)
  if (process.env.REASONING_PROVIDER === "local" && process.env.LOCAL_REASONING_MODEL) {
    const modelManager = require("./src/helpers/modelManagerBridge").default;
    modelManager.prewarmServer(process.env.LOCAL_REASONING_MODEL).catch((err) => {
      debugLogger.debug("llama-server pre-warm error (non-fatal)", { error: err.message });
    });
  }

  // Log nircmd status on Windows (for debugging bundled dependencies)
  if (process.platform === "win32") {
    const nircmdStatus = clipboardManager.getNircmdStatus();
    debugLogger.debug("Windows paste tool status", nircmdStatus);
  }

  // Create main window
  await windowManager.createMainWindow();

  // Create control panel window
  await windowManager.createControlPanelWindow();

  // Set up tray
  trayManager.setWindows(windowManager.mainWindow, windowManager.controlPanelWindow);
  trayManager.setWindowManager(windowManager);
  trayManager.setCreateControlPanelCallback(() => windowManager.createControlPanelWindow());
  await trayManager.createTray();

  // Set windows for update manager and check for updates
  updateManager.setWindows(windowManager.mainWindow, windowManager.controlPanelWindow);
  updateManager.checkForUpdatesOnStartup();

  if (process.platform === "darwin") {
    let globeKeyDownTime = 0;
    let globeKeyIsRecording = false;
    const MIN_HOLD_DURATION_MS = 150; // Minimum hold time to trigger push-to-talk

    globeKeyManager.on("globe-down", async () => {
      // Forward to control panel for hotkey capture
      if (isLiveWindow(windowManager.controlPanelWindow)) {
        windowManager.controlPanelWindow.webContents.send("globe-key-pressed");
      }

      // Handle dictation if Globe is the current hotkey
      if (hotkeyManager.getCurrentHotkey && hotkeyManager.getCurrentHotkey() === "GLOBE") {
        if (isLiveWindow(windowManager.mainWindow)) {
          const activationMode = await windowManager.getActivationMode();
          windowManager.showDictationPanel();
          if (activationMode === "push") {
            // Track when key was pressed for push-to-talk
            globeKeyDownTime = Date.now();
            globeKeyIsRecording = false;
            // Start recording after a brief delay to distinguish tap from hold
            setTimeout(async () => {
              // Only start if key is still being held
              if (globeKeyDownTime > 0 && !globeKeyIsRecording) {
                globeKeyIsRecording = true;
                windowManager.sendStartDictation();
              }
            }, MIN_HOLD_DURATION_MS);
          } else {
            windowManager.mainWindow.webContents.send("toggle-dictation");
          }
        }
      }
    });

    globeKeyManager.on("globe-up", async () => {
      // Handle push-to-talk release if Globe is the current hotkey
      if (hotkeyManager.getCurrentHotkey && hotkeyManager.getCurrentHotkey() === "GLOBE") {
        const activationMode = await windowManager.getActivationMode();
        if (activationMode === "push") {
          globeKeyDownTime = 0;
          // Only stop if we actually started recording
          if (globeKeyIsRecording) {
            globeKeyIsRecording = false;
            windowManager.sendStopDictation();
          }
          // If released too quickly, don't do anything (tap is ignored in push mode)
        }
      }
    });

    globeKeyManager.start();
  }

  // Set up Windows Push-to-Talk handling
  if (process.platform === "win32") {
    debugLogger.debug("[Push-to-Talk] Windows Push-to-Talk setup starting");
    let winKeyDownTime = 0;
    let winKeyIsRecording = false;

    // Minimum duration (ms) the key must be held before starting recording.
    // This distinguishes a "tap" (ignored in push mode) from a "hold" (starts recording).
    // 150ms is short enough to feel instant but long enough to detect intent.
    const WIN_MIN_HOLD_DURATION_MS = 150;

    // Helper to check if hotkey is valid for Windows key listener
    // Supports compound hotkeys like "CommandOrControl+F11"
    const isValidHotkey = (hotkey) => {
      if (!hotkey) return false;
      if (hotkey === "GLOBE") return false; // GLOBE is macOS only
      return true;
    };

    windowsKeyManager.on("key-down", async (key) => {
      debugLogger.debug("[Push-to-Talk] Key DOWN received", { key });
      // Handle dictation if in push-to-talk mode
      if (isLiveWindow(windowManager.mainWindow)) {
        const activationMode = await windowManager.getActivationMode();
        debugLogger.debug("[Push-to-Talk] Activation mode check", { activationMode });
        if (activationMode === "push") {
          debugLogger.debug("[Push-to-Talk] Starting recording sequence");
          windowManager.showDictationPanel();
          // Track when key was pressed for push-to-talk
          winKeyDownTime = Date.now();
          winKeyIsRecording = false;
          // Start recording after a brief delay to distinguish tap from hold
          setTimeout(async () => {
            if (winKeyDownTime > 0 && !winKeyIsRecording) {
              winKeyIsRecording = true;
              debugLogger.debug("[Push-to-Talk] Sending start dictation command");
              windowManager.sendStartDictation();
            }
          }, WIN_MIN_HOLD_DURATION_MS);
        }
      }
    });

    windowsKeyManager.on("key-up", async () => {
      debugLogger.debug("[Push-to-Talk] Key UP received");
      if (isLiveWindow(windowManager.mainWindow)) {
        const activationMode = await windowManager.getActivationMode();
        if (activationMode === "push") {
          const wasRecording = winKeyIsRecording;
          winKeyDownTime = 0;
          winKeyIsRecording = false;
          if (wasRecording) {
            debugLogger.debug("[Push-to-Talk] Sending stop dictation command");
            windowManager.sendStopDictation();
          } else {
            // Short tap (< hold threshold) - hide panel since recording never started
            debugLogger.debug("[Push-to-Talk] Short tap detected, hiding panel");
            windowManager.hideDictationPanel();
          }
        }
      }
    });

    windowsKeyManager.on("error", (error) => {
      debugLogger.warn("[Push-to-Talk] Windows key listener error", { error: error.message });
      windowManager.setWindowsPushToTalkAvailable(false);
      if (isLiveWindow(windowManager.mainWindow)) {
        windowManager.mainWindow.webContents.send("windows-ptt-unavailable", {
          reason: "error",
          message: error.message,
        });
      }
    });

    windowsKeyManager.on("unavailable", () => {
      debugLogger.debug("[Push-to-Talk] Windows key listener not available - falling back to toggle mode");
      windowManager.setWindowsPushToTalkAvailable(false);
      if (isLiveWindow(windowManager.mainWindow)) {
        windowManager.mainWindow.webContents.send("windows-ptt-unavailable", {
          reason: "binary_not_found",
          message: "Push-to-Talk native listener not available",
        });
      }
    });

    windowsKeyManager.on("ready", () => {
      debugLogger.debug("[Push-to-Talk] WindowsKeyManager is ready and listening");
      windowManager.setWindowsPushToTalkAvailable(true);
    });

    // Start the Windows key listener with the current hotkey
    const startWindowsKeyListener = async () => {
      debugLogger.debug("[Push-to-Talk] Checking if should start Windows key listener");
      if (!isLiveWindow(windowManager.mainWindow)) {
        debugLogger.debug("[Push-to-Talk] Main window not live, skipping");
        return;
      }
      const activationMode = await windowManager.getActivationMode();
      const currentHotkey = hotkeyManager.getCurrentHotkey();
      debugLogger.debug("[Push-to-Talk] Current state", { activationMode, currentHotkey });

      if (activationMode === "push") {
        if (isValidHotkey(currentHotkey)) {
          debugLogger.debug("[Push-to-Talk] Starting Windows key listener", { hotkey: currentHotkey });
          windowsKeyManager.start(currentHotkey);
        } else {
          debugLogger.debug("[Push-to-Talk] No valid hotkey to start listener");
        }
      } else {
        debugLogger.debug("[Push-to-Talk] Not in push mode, skipping listener start");
      }
    };

    // Delay (ms) before starting the Windows key listener after app startup.
    // The hotkeyManager loads saved hotkey 1 second after did-finish-load event,
    // so we wait 3 seconds to ensure settings are fully loaded before starting.
    const STARTUP_DELAY_MS = 3000;
    debugLogger.debug("[Push-to-Talk] Scheduling listener start", { delayMs: STARTUP_DELAY_MS });
    setTimeout(startWindowsKeyListener, STARTUP_DELAY_MS);

    // Listen for activation mode changes from renderer
    ipcMain.on("activation-mode-changed", async (_event, mode) => {
      debugLogger.debug("[Push-to-Talk] IPC: Activation mode changed", { mode });
      if (mode === "push") {
        const currentHotkey = hotkeyManager.getCurrentHotkey();
        debugLogger.debug("[Push-to-Talk] Current hotkey", { hotkey: currentHotkey });
        if (isValidHotkey(currentHotkey)) {
          debugLogger.debug("[Push-to-Talk] Starting listener", { hotkey: currentHotkey });
          windowsKeyManager.start(currentHotkey);
        }
      } else {
        debugLogger.debug("[Push-to-Talk] Stopping listener (mode is tap)");
        windowsKeyManager.stop();
      }
    });

    // Listen for hotkey changes from renderer
    ipcMain.on("hotkey-changed", async (_event, hotkey) => {
      debugLogger.debug("[Push-to-Talk] IPC: Hotkey changed", { hotkey });
      if (!isLiveWindow(windowManager.mainWindow)) {
        return;
      }
      const activationMode = await windowManager.getActivationMode();
      debugLogger.debug("[Push-to-Talk] Current activation mode", { activationMode });
      if (activationMode === "push") {
        windowsKeyManager.stop();
        if (isValidHotkey(hotkey)) {
          debugLogger.debug("[Push-to-Talk] Starting listener for new hotkey", { hotkey });
          windowsKeyManager.start(hotkey);
        }
      }
    });
  }
}

// App event handlers
if (gotSingleInstanceLock) {
  app.on("second-instance", async () => {
    await app.whenReady();
    if (!windowManager) {
      return;
    }

    if (isLiveWindow(windowManager.controlPanelWindow)) {
      if (windowManager.controlPanelWindow.isMinimized()) {
        windowManager.controlPanelWindow.restore();
      }
      windowManager.controlPanelWindow.show();
      windowManager.controlPanelWindow.focus();
    } else {
      windowManager.createControlPanelWindow();
    }

    if (isLiveWindow(windowManager.mainWindow)) {
      windowManager.enforceMainWindowOnTop();
    } else {
      windowManager.createMainWindow();
    }
  });

  app.whenReady().then(() => {
    startApp().catch((error) => {
      console.error("Failed to start app:", error);
      dialog.showErrorBox(
        "OpenWhispr Startup Error",
        `Failed to start the application:\n\n${error.message}\n\nPlease report this issue.`
      );
      app.exit(1);
    });
  });

  app.on("window-all-closed", () => {
    // Don't quit on macOS when all windows are closed
    // The app should stay in the dock/menu bar
    if (process.platform !== "darwin") {
      app.quit();
    }
    // On macOS, keep the app running even without windows
  });

  app.on("browser-window-focus", (event, window) => {
    // Only apply always-on-top to the dictation window, not the control panel
    if (windowManager && isLiveWindow(windowManager.mainWindow)) {
      // Check if the focused window is the dictation window
      if (window === windowManager.mainWindow) {
        windowManager.enforceMainWindowOnTop();
      }
    }

    // Control panel doesn't need any special handling on focus
    // It should behave like a normal window
  });

  app.on("activate", () => {
    // On macOS, re-create windows when dock icon is clicked
    if (BrowserWindow.getAllWindows().length === 0) {
      if (windowManager) {
        windowManager.createMainWindow();
        windowManager.createControlPanelWindow();
      }
    } else {
      // Show control panel when dock icon is clicked (most common user action)
      if (windowManager && isLiveWindow(windowManager.controlPanelWindow)) {
        if (windowManager.controlPanelWindow.isMinimized()) {
          windowManager.controlPanelWindow.restore();
        }
        windowManager.controlPanelWindow.show();
        windowManager.controlPanelWindow.focus();
      } else if (windowManager) {
        // If control panel doesn't exist, create it
        windowManager.createControlPanelWindow();
      }

      // Ensure dictation panel maintains its always-on-top status
      if (windowManager && isLiveWindow(windowManager.mainWindow)) {
        windowManager.enforceMainWindowOnTop();
      }
    }
  });

  app.on("will-quit", () => {
    if (hotkeyManager) {
      hotkeyManager.unregisterAll();
    } else {
      globalShortcut.unregisterAll();
    }
    if (globeKeyManager) {
      globeKeyManager.stop();
    }
    if (windowsKeyManager) {
      windowsKeyManager.stop();
    }
    if (updateManager) {
      updateManager.cleanup();
    }
    // Stop whisper server if running
    if (whisperManager) {
      whisperManager.stopServer().catch(() => {});
    }
    // Stop parakeet WS server if running
    if (parakeetManager) {
      parakeetManager.stopServer().catch(() => {});
    }
    // Stop llama-server if running
    const modelManager = require("./src/helpers/modelManagerBridge").default;
    modelManager.stopServer().catch(() => {});
  });
}
