const { app, globalShortcut, BrowserWindow, dialog } = require("electron");

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

// Import helper modules
const debugLogger = require("./src/helpers/debugLogger");
const EnvironmentManager = require("./src/helpers/environment");
const WindowManager = require("./src/helpers/windowManager");
const DatabaseManager = require("./src/helpers/database");
const ClipboardManager = require("./src/helpers/clipboard");
const WhisperManager = require("./src/helpers/whisper");
const TrayManager = require("./src/helpers/tray");
const IPCHandlers = require("./src/helpers/ipcHandlers");
const UpdateManager = require("./src/updater");
const GlobeKeyManager = require("./src/helpers/globeKeyManager");

// Set up PATH for production builds to find system Python
function setupProductionPath() {
  if (process.platform === 'darwin' && process.env.NODE_ENV !== 'development') {
    const commonPaths = [
      '/usr/local/bin',
      '/opt/homebrew/bin',
      '/usr/bin',
      '/bin',
      '/usr/sbin',
      '/sbin',
      '/Library/Frameworks/Python.framework/Versions/3.11/bin',
      '/Library/Frameworks/Python.framework/Versions/3.10/bin',
      '/Library/Frameworks/Python.framework/Versions/3.9/bin'
    ];
    
    const currentPath = process.env.PATH || '';
    const pathsToAdd = commonPaths.filter(p => !currentPath.includes(p));
    
    if (pathsToAdd.length > 0) {
      process.env.PATH = `${currentPath}:${pathsToAdd.join(':')}`;
    }
  }
}

// Set up PATH before initializing managers
setupProductionPath();

// Initialize managers
const environmentManager = new EnvironmentManager();
debugLogger.refreshLogLevel();
const windowManager = new WindowManager();
const hotkeyManager = windowManager.hotkeyManager;
const databaseManager = new DatabaseManager();
const clipboardManager = new ClipboardManager();
const whisperManager = new WhisperManager();
const trayManager = new TrayManager();
const updateManager = new UpdateManager();
const globeKeyManager = new GlobeKeyManager();
let globeKeyAlertShown = false;

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
      detailLines.push("Run `npm run compile:globe` and rebuild the app to regenerate the listener binary.");
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
const ipcHandlers = new IPCHandlers({
  environmentManager,
  databaseManager,
  clipboardManager,
  whisperManager,
  windowManager,
});

// Main application startup
async function startApp() {
  // In development, add a small delay to let Vite start properly
  if (process.env.NODE_ENV === "development") {
    await new Promise((resolve) => setTimeout(resolve, 2000));
  }

  // Ensure dock is visible on macOS and stays visible
  if (process.platform === 'darwin' && app.dock) {
    app.dock.show();
    // Prevent dock from hiding when windows use setVisibleOnAllWorkspaces
    app.setActivationPolicy('regular');
  }

  // Initialize Whisper manager at startup (don't await to avoid blocking)
  whisperManager.initializeAtStartup().catch((err) => {
    // Whisper not being available at startup is not critical
  });

  // Create main window
  try {
    await windowManager.createMainWindow();
  } catch (error) {
    console.error("Error creating main window:", error);
  }

  // Create control panel window
  try {
    await windowManager.createControlPanelWindow();
  } catch (error) {
    console.error("Error creating control panel window:", error);
  }

  // Set up tray
trayManager.setWindows(
  windowManager.mainWindow,
  windowManager.controlPanelWindow
);
trayManager.setWindowManager(windowManager);
  trayManager.setCreateControlPanelCallback(() =>
    windowManager.createControlPanelWindow()
  );
  await trayManager.createTray();

  // Set windows for update manager and check for updates
  updateManager.setWindows(
    windowManager.mainWindow,
    windowManager.controlPanelWindow
  );
  updateManager.checkForUpdatesOnStartup();

  if (process.platform === "darwin") {
    globeKeyManager.on("globe-down", () => {
      if (hotkeyManager.getCurrentHotkey && hotkeyManager.getCurrentHotkey() === "GLOBE") {
        if (
          windowManager.mainWindow &&
          !windowManager.mainWindow.isDestroyed()
        ) {
          windowManager.showDictationPanel();
          windowManager.mainWindow.webContents.send("toggle-dictation");
        }
      }
    });

    globeKeyManager.start();
  }
}

// App event handlers
app.whenReady().then(() => {
  // Hide dock icon on macOS for a cleaner experience
  // The app will still show in the menu bar and command bar
  if (process.platform === 'darwin' && app.dock) {
    // Keep dock visible for now to maintain command bar access
    // We can hide it later if needed: app.dock.hide()
  }
  
  startApp();
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
  if (windowManager && windowManager.mainWindow && !windowManager.mainWindow.isDestroyed()) {
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
    if (windowManager && windowManager.controlPanelWindow && !windowManager.controlPanelWindow.isDestroyed()) {
      windowManager.controlPanelWindow.show();
      windowManager.controlPanelWindow.focus();
    } else if (windowManager) {
      // If control panel doesn't exist, create it
      windowManager.createControlPanelWindow();
    }
    
    // Ensure dictation panel maintains its always-on-top status
    if (windowManager && windowManager.mainWindow && !windowManager.mainWindow.isDestroyed()) {
      windowManager.enforceMainWindowOnTop();
    }
  }
});

app.on("will-quit", () => {
  globalShortcut.unregisterAll();
  globeKeyManager.stop();
  updateManager.cleanup();
});
