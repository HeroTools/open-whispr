const { app, screen, BrowserWindow, shell } = require("electron");
const HotkeyManager = require("./hotkeyManager");
const DragManager = require("./dragManager");
const MenuManager = require("./menuManager");
const DevServerManager = require("./devServerManager");
const {
  MAIN_WINDOW_CONFIG,
  CONTROL_PANEL_CONFIG,
  WindowPositionUtil,
} = require("./windowConfig");

class WindowManager {
  constructor() {
    this.mainWindow = null;
    this.controlPanelWindow = null;
    this.tray = null;
    this.hotkeyManager = new HotkeyManager();
    this.dragManager = new DragManager();
    this.isQuitting = false;
    this.isMainWindowInteractive = false;

    app.on("before-quit", () => {
      this.isQuitting = true;
    });
  }

  async createMainWindow() {
    const display = screen.getPrimaryDisplay();
    const position = WindowPositionUtil.getMainWindowPosition(display);

    this.mainWindow = new BrowserWindow({
      ...MAIN_WINDOW_CONFIG,
      ...position,
    });

    if (process.platform === "darwin") {
      this.mainWindow.setSkipTaskbar(false);
    } else if (process.platform === "win32") {
      this.mainWindow.setSkipTaskbar(true);
    }

    this.setMainWindowInteractivity(false);
    this.registerMainWindowEvents();

    await this.loadMainWindow();
    await this.initializeHotkey();
    this.dragManager.setTargetWindow(this.mainWindow);
    MenuManager.setupMainMenu();

    this.mainWindow.webContents.on(
      "did-fail-load",
      async (_event, errorCode, errorDescription, validatedURL) => {
        console.error(
          "Failed to load main window:",
          errorCode,
          errorDescription,
          validatedURL
        );
        if (
          process.env.NODE_ENV === "development" &&
          validatedURL.includes("localhost:5174")
        ) {
          // Retry connection to dev server
          setTimeout(async () => {
            const isReady = await DevServerManager.waitForDevServer();
            if (isReady) {
              console.log("Dev server ready, reloading...");
              this.mainWindow.reload();
            }
          }, 2000);
        }
      }
    );

    this.mainWindow.webContents.on(
      "did-finish-load",
      () => {
        this.mainWindow.setTitle("Voice Recorder");
        this.enforceMainWindowOnTop();
      }
    );
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
    const appUrl = DevServerManager.getAppUrl(false);
    if (process.env.NODE_ENV === "development") {
      const isReady = await DevServerManager.waitForDevServer();
      if (!isReady) {
        // Dev server not ready, continue anyway
      }
    }
    this.mainWindow.loadURL(appUrl);
  }

  async initializeHotkey() {
    const callback = () => {
      if (!this.mainWindow.isVisible()) {
        this.mainWindow.show();
      }
      this.mainWindow.webContents.send("toggle-dictation");
    };

    await this.hotkeyManager.initializeHotkey(this.mainWindow, callback);
  }

  async updateHotkey(hotkey) {
    const callback = () => {
      if (!this.mainWindow.isVisible()) {
        this.mainWindow.show();
      }
      this.mainWindow.webContents.send("toggle-dictation");
    };

    return await this.hotkeyManager.updateHotkey(hotkey, callback);
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

    // Intercept navigation attempts (for OAuth redirects)
    // This prevents Clerk OAuth from navigating the window and instead opens in system browser
    this.controlPanelWindow.webContents.on('will-navigate', (event, url) => {
      const appUrl = DevServerManager.getAppUrl(true);
      const controlPanelUrl = appUrl.startsWith('http') ? appUrl : `file://${appUrl}`;

      // Allow navigation to our own app URLs
      if (url.startsWith(controlPanelUrl) || url.startsWith('file://') || url.startsWith('devtools://')) {
        return;
      }

      // Check if this is a Clerk OAuth URL or other external URL
      if (url.includes('clerk.accounts') || url.includes('google.com/') || url.includes('github.com/')) {
        console.log('Intercepting navigation to OAuth provider:', url);
        event.preventDefault();
        shell.openExternal(url);
      }
    });

    // Also intercept new window requests
    this.controlPanelWindow.webContents.setWindowOpenHandler(({ url }) => {
      console.log('Intercepting window.open:', url);

      // If it's an OAuth-related URL, open in external browser
      if (url.includes('clerk.accounts') || url.includes('google.com/') || url.includes('github.com/') || url.includes('oauth')) {
        shell.openExternal(url);
        return { action: 'deny' };
      }

      // For other URLs, open in external browser too (safer default)
      shell.openExternal(url);
      return { action: 'deny' };
    });

    this.controlPanelWindow.once("ready-to-show", () => {
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
        if (process.platform === "darwin") {
          this.controlPanelWindow.minimize();
        } else {
          this.hideControlPanelToTray();
        }
      }
    });

    this.controlPanelWindow.on("closed", () => {
      this.controlPanelWindow = null;
    });

    // Set up menu for control panel to ensure text input works
    MenuManager.setupControlPanelMenu(this.controlPanelWindow);

    this.controlPanelWindow.webContents.on("did-finish-load", () => {
      this.controlPanelWindow.setTitle("Control Panel");
    });

    console.log("📱 Loading control panel content...");
    await this.loadControlPanel();
  }

  async loadControlPanel() {
    const appUrl = DevServerManager.getAppUrl(true);
    if (process.env.NODE_ENV === "development") {
      const isReady = await DevServerManager.waitForDevServer();
      if (!isReady) {
        console.error(
          "Dev server not ready for control panel, loading anyway..."
        );
      }
    }
    this.controlPanelWindow.loadURL(appUrl);
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

    this.mainWindow.once("ready-to-show", () => {
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
}

module.exports = WindowManager;
