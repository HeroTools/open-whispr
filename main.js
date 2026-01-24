const { app, globalShortcut, BrowserWindow, dialog } = require("electron");

// Enable GlobalShortcutsPortal feature for native Wayland global shortcuts support
// This allows global shortcuts to work in native Wayland apps (not just XWayland)
// See: https://github.com/electron/electron/pull/45171
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
const TrayManager = require("./src/helpers/tray");
const IPCHandlers = require("./src/helpers/ipcHandlers");
const UpdateManager = require("./src/updater");
const GlobeKeyManager = require("./src/helpers/globeKeyManager");

// Manager instances - initialized after app.whenReady()
let debugLogger = null;
let environmentManager = null;
let windowManager = null;
let hotkeyManager = null;
let databaseManager = null;
let clipboardManager = null;
let whisperManager = null;
let trayManager = null;
let updateManager = null;
let globeKeyManager = null;
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
  console.log("[initializeManagers] Starting...");

  // Set up PATH before initializing managers
  setupProductionPath();
  console.log("[initializeManagers] PATH setup complete");

  // Now it's safe to call app.getPath() and initialize managers
  console.log("[initializeManagers] Loading debugLogger...");
  debugLogger = require("./src/helpers/debugLogger");
  // IMPORTANT: Ensure file logging is initialized now that app is ready
  // This is necessary because debugLogger may have been loaded before app.whenReady()
  // via transitive imports (e.g., windowManager -> hotkeyManager -> debugLogger)
  debugLogger.ensureFileLogging();
  console.log("[initializeManagers] debugLogger initialized");

  console.log("[initializeManagers] Creating EnvironmentManager...");
  environmentManager = new EnvironmentManager();
  debugLogger.refreshLogLevel();
  console.log("[initializeManagers] EnvironmentManager created");

  console.log("[initializeManagers] Creating WindowManager...");
  windowManager = new WindowManager();
  hotkeyManager = windowManager.hotkeyManager;
  console.log("[initializeManagers] WindowManager created");

  console.log("[initializeManagers] Creating DatabaseManager...");
  databaseManager = new DatabaseManager();
  console.log("[initializeManagers] DatabaseManager created");

  console.log("[initializeManagers] Creating ClipboardManager...");
  clipboardManager = new ClipboardManager();
  console.log("[initializeManagers] ClipboardManager created");

  console.log("[initializeManagers] Creating WhisperManager...");
  whisperManager = new WhisperManager();
  console.log("[initializeManagers] WhisperManager created");

  console.log("[initializeManagers] Creating TrayManager...");
  trayManager = new TrayManager();
  console.log("[initializeManagers] TrayManager created");

  console.log("[initializeManagers] Creating UpdateManager...");
  updateManager = new UpdateManager();
  console.log("[initializeManagers] UpdateManager created");

  console.log("[initializeManagers] Creating GlobeKeyManager...");
  globeKeyManager = new GlobeKeyManager();
  console.log("[initializeManagers] GlobeKeyManager created");

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
    windowManager,
    updateManager,
  });
}

// Main application startup
async function startApp() {
  console.log("[Main] startApp() called - app is ready");
  console.log("[Main] Platform:", process.platform, "Arch:", process.arch);
  console.log("[Main] NODE_ENV:", process.env.NODE_ENV);
  console.log("[Main] App path:", app.getAppPath());
  console.log("[Main] Resources path:", process.resourcesPath);
  console.log("[Main] User data path:", app.getPath("userData"));

  // Initialize all managers now that app is ready
  // This must happen first as other code depends on these managers
  console.log("[Main] Initializing managers...");
  initializeManagers();
  console.log("[Main] Managers initialized");

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
  console.log("[Main] Creating main window...");
  try {
    await windowManager.createMainWindow();
    console.log("[Main] Main window created successfully");
  } catch (error) {
    console.error("[Main] Error creating main window:", error);
    // Re-throw to trigger the error dialog in the catch handler
    throw error;
  }

  // Create control panel window
  console.log("[Main] Creating control panel window...");
  try {
    await windowManager.createControlPanelWindow();
    console.log("[Main] Control panel window created successfully");
  } catch (error) {
    console.error("[Main] Error creating control panel window:", error);
    // Re-throw to trigger the error dialog in the catch handler
    throw error;
  }

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
}

// App event handlers
console.log("[Main] Setting up app event handlers, gotSingleInstanceLock:", gotSingleInstanceLock);

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

  console.log("[Main] Waiting for app.whenReady()...");
  app.whenReady().then(() => {
    console.log("[Main] app.whenReady() resolved - app is now ready");
    startApp().catch((error) => {
      console.error("CRITICAL: Failed to start app:", error);
      console.error("Stack trace:", error.stack);
      // Show an error dialog before crashing
      dialog.showErrorBox(
        "OpenWhispr Startup Error",
        `Failed to start the application:\n\n${error.message}\n\nStack: ${error.stack}\n\nPlease report this issue.`
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
    globalShortcut.unregisterAll();
    if (globeKeyManager) {
      globeKeyManager.stop();
    }
    if (updateManager) {
      updateManager.cleanup();
    }
    // Stop whisper server if running
    if (whisperManager) {
      whisperManager.stopServer().catch(() => {});
    }
    // Stop llama-server if running
    const modelManager = require("./src/helpers/modelManagerBridge").default;
    modelManager.stopServer().catch(() => {});
  });
}
