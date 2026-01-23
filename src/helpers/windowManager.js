const { app, screen, BrowserWindow, dialog } = require("electron");
const HotkeyManager = require("./hotkeyManager");
const DragManager = require("./dragManager");
const MenuManager = require("./menuManager");
const DevServerManager = require("./devServerManager");
const { MAIN_WINDOW_CONFIG, CONTROL_PANEL_CONFIG, WindowPositionUtil } = require("./windowConfig");

class WindowManager {
  constructor() {
    this.mainWindow = null;
    this.controlPanelWindow = null;
    this.tray = null;
    this.hotkeyManager = new HotkeyManager();
    this.dragManager = new DragManager();
    this.isQuitting = false;
    this.isMainWindowInteractive = false;
    this.loadErrorShown = false;

    app.on("before-quit", () => {
      this.isQuitting = true;
    });
  }

  async createMainWindow() {
    const display = screen.getPrimaryDisplay();
    const position = WindowPositionUtil.getMainWindowPosition(display);

    console.log("[WindowManager] Creating main window with position:", position);
    console.log("[WindowManager] Display bounds:", display.bounds);
    console.log("[WindowManager] Display workArea:", display.workArea);
    console.log("[WindowManager] Platform:", process.platform);

    this.mainWindow = new BrowserWindow({
      ...MAIN_WINDOW_CONFIG,
      ...position,
    });

    console.log("[WindowManager] Main window created, id:", this.mainWindow.id);

    if (process.platform === "darwin") {
      this.mainWindow.setSkipTaskbar(false);
    } else {
      this.mainWindow.setSkipTaskbar(true);
    }

    this.setMainWindowInteractivity(false);
    this.registerMainWindowEvents();

    // IMPORTANT: Register load event handlers BEFORE loading to catch all events
    this.mainWindow.webContents.on(
      "did-fail-load",
      async (_event, errorCode, errorDescription, validatedURL, isMainFrame) => {
        if (!isMainFrame) {
          return;
        }
        console.error("[WindowManager] did-fail-load:", errorCode, errorDescription, validatedURL);
        if (process.env.NODE_ENV === "development" && validatedURL && validatedURL.includes("localhost:5174")) {
          // Retry connection to dev server
          setTimeout(async () => {
            const isReady = await DevServerManager.waitForDevServer();
            if (isReady) {
              console.log("[WindowManager] Dev server ready, reloading...");
              this.mainWindow.reload();
            }
          }, 2000);
        } else {
          this.showLoadFailureDialog("Dictation panel", errorCode, errorDescription, validatedURL);
        }
      }
    );

    this.mainWindow.webContents.on("did-finish-load", () => {
      console.log("[WindowManager] Main window did-finish-load");
      this.mainWindow.setTitle("Voice Recorder");
      this.enforceMainWindowOnTop();
    });

    // Now load the window content
    await this.loadMainWindow();
    await this.initializeHotkey();
    this.dragManager.setTargetWindow(this.mainWindow);
    MenuManager.setupMainMenu();
  }

  setMainWindowInteractivity(shouldCapture) {
    if (!this.mainWindow || this.mainWindow.isDestroyed()) {
      return;
    }

    if (shouldCapture) {
      this.mainWindow.setIgnoreMouseEvents(false);
    } else {
      this.mainWindow.setIgnoreMouseEvents(true, { forward: true });
    }
    this.isMainWindowInteractive = shouldCapture;
  }

  async loadMainWindow() {
    if (process.env.NODE_ENV === "development") {
      const appUrl = DevServerManager.getAppUrl(false);
      console.log("[WindowManager] Loading main window (dev):", appUrl);
      const isReady = await DevServerManager.waitForDevServer();
      if (!isReady) {
        console.warn("[WindowManager] Dev server not ready, attempting to load anyway...");
      }
      try {
        await this.mainWindow.loadURL(appUrl);
        console.log("[WindowManager] Main window loaded successfully (dev)");
      } catch (error) {
        console.error("[WindowManager] Failed to load main window (dev):", error);
        throw error;
      }
    } else {
      // Production: use loadFile() for better compatibility with Electron 36+
      const fileInfo = DevServerManager.getAppFilePath(false);
      console.log("[WindowManager] Loading main window (prod), fileInfo:", fileInfo);

      if (!fileInfo) {
        const error = new Error("Failed to get app file path for main window");
        console.error("[WindowManager]", error.message);
        throw error;
      }

      // Verify the file exists before attempting to load
      const fs = require("fs");
      if (!fs.existsSync(fileInfo.path)) {
        const error = new Error(`Main window HTML file not found: ${fileInfo.path}`);
        console.error("[WindowManager]", error.message);
        throw error;
      }

      try {
        console.log("[WindowManager] Calling loadFile:", fileInfo.path);
        await this.mainWindow.loadFile(fileInfo.path, { query: fileInfo.query });
        console.log("[WindowManager] Main window loaded successfully (prod)");
      } catch (error) {
        console.error("[WindowManager] Failed to load main window (prod):", error);
        throw error;
      }
    }
  }

  createHotkeyCallback() {
    let lastToggleTime = 0;
    const DEBOUNCE_MS = 150;

    return () => {
      if (this.hotkeyManager.isInListeningMode()) {
        return;
      }

      const now = Date.now();
      if (now - lastToggleTime < DEBOUNCE_MS) {
        return;
      }
      lastToggleTime = now;

      if (!this.mainWindow.isVisible()) {
        this.mainWindow.show();
      }
      this.mainWindow.webContents.send("toggle-dictation");
    };
  }

  sendStartDictation() {
    if (this.hotkeyManager.isInListeningMode()) {
      return;
    }
    if (this.mainWindow && !this.mainWindow.isDestroyed()) {
      if (!this.mainWindow.isVisible()) {
        this.mainWindow.show();
      }
      this.mainWindow.webContents.send("start-dictation");
    }
  }

  sendStopDictation() {
    if (this.hotkeyManager.isInListeningMode()) {
      return;
    }
    if (this.mainWindow && !this.mainWindow.isDestroyed()) {
      this.mainWindow.webContents.send("stop-dictation");
    }
  }

  async getActivationMode() {
    if (!this.mainWindow || this.mainWindow.isDestroyed()) {
      return "tap";
    }
    try {
      const mode = await this.mainWindow.webContents.executeJavaScript(
        `localStorage.getItem("activationMode") || "tap"`
      );
      return mode === "push" ? "push" : "tap";
    } catch {
      return "tap";
    }
  }

  setHotkeyListeningMode(enabled) {
    this.hotkeyManager.setListeningMode(enabled);
  }

  async initializeHotkey() {
    await this.hotkeyManager.initializeHotkey(this.mainWindow, this.createHotkeyCallback());
  }

  async updateHotkey(hotkey) {
    return await this.hotkeyManager.updateHotkey(hotkey, this.createHotkeyCallback());
  }

  async startWindowDrag() {
    return await this.dragManager.startWindowDrag();
  }

  async stopWindowDrag() {
    return await this.dragManager.stopWindowDrag();
  }

  async createControlPanelWindow() {
    if (this.controlPanelWindow && !this.controlPanelWindow.isDestroyed()) {
      if (this.controlPanelWindow.isMinimized()) {
        this.controlPanelWindow.restore();
      }
      if (!this.controlPanelWindow.isVisible()) {
        this.controlPanelWindow.show();
      }
      this.controlPanelWindow.focus();
      return;
    }

    this.controlPanelWindow = new BrowserWindow(CONTROL_PANEL_CONFIG);

    const visibilityTimer = setTimeout(() => {
      if (!this.controlPanelWindow || this.controlPanelWindow.isDestroyed()) {
        return;
      }
      if (!this.controlPanelWindow.isVisible()) {
        console.warn("Control panel did not become visible in time; forcing show");
        this.controlPanelWindow.show();
        this.controlPanelWindow.focus();
      }
    }, 10000);

    const clearVisibilityTimer = () => {
      clearTimeout(visibilityTimer);
    };

    this.controlPanelWindow.once("ready-to-show", () => {
      clearVisibilityTimer();
      if (process.platform === "win32") {
        this.controlPanelWindow.setSkipTaskbar(false);
      }
      this.controlPanelWindow.show();
      this.controlPanelWindow.focus();
    });

    this.controlPanelWindow.on("show", () => {
      if (process.platform === "win32") {
        this.controlPanelWindow.setSkipTaskbar(false);
      }
    });

    this.controlPanelWindow.on("close", (event) => {
      if (!this.isQuitting) {
        event.preventDefault();
        this.hideControlPanelToTray();
      }
    });

    this.controlPanelWindow.on("closed", () => {
      clearVisibilityTimer();
      this.controlPanelWindow = null;
    });

    // Set up menu for control panel to ensure text input works
    MenuManager.setupControlPanelMenu(this.controlPanelWindow);

    this.controlPanelWindow.webContents.on("did-finish-load", () => {
      clearVisibilityTimer();
      this.controlPanelWindow.setTitle("Control Panel");
    });

    this.controlPanelWindow.webContents.on(
      "did-fail-load",
      (_event, errorCode, errorDescription, validatedURL, isMainFrame) => {
        if (!isMainFrame) {
          return;
        }
        clearVisibilityTimer();
        console.error("Failed to load control panel:", errorCode, errorDescription, validatedURL);
        if (process.env.NODE_ENV !== "development") {
          this.showLoadFailureDialog("Control panel", errorCode, errorDescription, validatedURL);
        }
        if (!this.controlPanelWindow.isVisible()) {
          this.controlPanelWindow.show();
          this.controlPanelWindow.focus();
        }
      }
    );

    console.log("📱 Loading control panel content...");
    await this.loadControlPanel();
  }

  async loadControlPanel() {
    if (process.env.NODE_ENV === "development") {
      const appUrl = DevServerManager.getAppUrl(true);
      console.log("[WindowManager] Loading control panel (dev):", appUrl);
      const isReady = await DevServerManager.waitForDevServer();
      if (!isReady) {
        console.warn("[WindowManager] Dev server not ready for control panel, attempting to load anyway...");
      }
      try {
        await this.controlPanelWindow.loadURL(appUrl);
        console.log("[WindowManager] Control panel loaded successfully (dev)");
      } catch (error) {
        console.error("[WindowManager] Failed to load control panel (dev):", error);
        throw error;
      }
    } else {
      // Production: use loadFile() for better compatibility with Electron 36+
      const fileInfo = DevServerManager.getAppFilePath(true);
      console.log("[WindowManager] Loading control panel (prod), fileInfo:", fileInfo);

      if (!fileInfo) {
        const error = new Error("Failed to get app file path for control panel");
        console.error("[WindowManager]", error.message);
        throw error;
      }

      // Verify the file exists before attempting to load
      const fs = require("fs");
      if (!fs.existsSync(fileInfo.path)) {
        const error = new Error(`Control panel HTML file not found: ${fileInfo.path}`);
        console.error("[WindowManager]", error.message);
        throw error;
      }

      try {
        console.log("[WindowManager] Calling loadFile:", fileInfo.path);
        await this.controlPanelWindow.loadFile(fileInfo.path, { query: fileInfo.query });
        console.log("[WindowManager] Control panel loaded successfully (prod)");
      } catch (error) {
        console.error("[WindowManager] Failed to load control panel (prod):", error);
        throw error;
      }
    }
  }

  showDictationPanel(options = {}) {
    const { focus = false } = options;
    if (this.mainWindow && !this.mainWindow.isDestroyed()) {
      if (!this.mainWindow.isVisible()) {
        if (typeof this.mainWindow.showInactive === "function") {
          this.mainWindow.showInactive();
        } else {
          this.mainWindow.show();
        }
      }
      if (focus) {
        this.mainWindow.focus();
      }
    }
  }

  hideControlPanelToTray() {
    if (!this.controlPanelWindow || this.controlPanelWindow.isDestroyed()) {
      return;
    }

    if (process.platform === "win32") {
      this.controlPanelWindow.setSkipTaskbar(true);
    }

    this.controlPanelWindow.hide();
  }

  hideDictationPanel() {
    if (this.mainWindow && !this.mainWindow.isDestroyed()) {
      if (process.platform === "darwin") {
        this.mainWindow.hide();
      } else {
        this.mainWindow.minimize();
      }
    }
  }

  isDictationPanelVisible() {
    if (!this.mainWindow || this.mainWindow.isDestroyed()) {
      return false;
    }

    if (this.mainWindow.isMinimized && this.mainWindow.isMinimized()) {
      return false;
    }

    return this.mainWindow.isVisible();
  }

  registerMainWindowEvents() {
    if (!this.mainWindow) {
      return;
    }

    // Safety timeout: force show the window if ready-to-show doesn't fire within 10 seconds
    // This helps diagnose issues where the renderer fails to load
    const showTimeout = setTimeout(() => {
      console.warn("[WindowManager] ready-to-show timeout - forcing window to show");
      if (this.mainWindow && !this.mainWindow.isDestroyed() && !this.mainWindow.isVisible()) {
        console.log("[WindowManager] Main window was not visible after 10s, forcing show");
        this.mainWindow.show();
        this.mainWindow.webContents.openDevTools();
      }
    }, 10000);

    this.mainWindow.once("ready-to-show", () => {
      clearTimeout(showTimeout);
      console.log("[WindowManager] Main window ready-to-show event fired");
      this.enforceMainWindowOnTop();
      if (!this.mainWindow.isVisible()) {
        if (typeof this.mainWindow.showInactive === "function") {
          this.mainWindow.showInactive();
        } else {
          this.mainWindow.show();
        }
      }
    });

    this.mainWindow.on("show", () => {
      this.enforceMainWindowOnTop();
    });

    this.mainWindow.on("focus", () => {
      this.enforceMainWindowOnTop();
    });

    this.mainWindow.on("closed", () => {
      this.dragManager.cleanup();
      this.mainWindow = null;
      this.isMainWindowInteractive = false;
    });
  }

  enforceMainWindowOnTop() {
    if (this.mainWindow && !this.mainWindow.isDestroyed()) {
      WindowPositionUtil.setupAlwaysOnTop(this.mainWindow);
    }
  }

  showLoadFailureDialog(windowName, errorCode, errorDescription, validatedURL) {
    if (this.loadErrorShown) {
      return;
    }
    this.loadErrorShown = true;
    const detailLines = [
      `Window: ${windowName}`,
      `Error ${errorCode}: ${errorDescription}`,
      validatedURL ? `URL: ${validatedURL}` : null,
      "Try reinstalling the app or launching with --log-level=debug.",
    ].filter(Boolean);
    dialog.showMessageBox({
      type: "error",
      title: "OpenWhispr failed to load",
      message: "OpenWhispr could not load its UI.",
      detail: detailLines.join("\n"),
    });
  }
}

module.exports = WindowManager;
