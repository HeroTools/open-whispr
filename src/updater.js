const { autoUpdater } = require("electron-updater");
const { ipcMain } = require("electron");

class UpdateManager {
  constructor() {
    this.mainWindow = null;
    this.controlPanelWindow = null;
    this.updateAvailable = false;
    this.updateDownloaded = false;

    this.setupAutoUpdater();
    this.setupIPCHandlers();
  }

  setWindows(mainWindow, controlPanelWindow) {
    this.mainWindow = mainWindow;
    this.controlPanelWindow = controlPanelWindow;
  }

  setupAutoUpdater() {
    // Only configure auto-updater in production
    if (process.env.NODE_ENV === "development") {
      console.log("⚠️ Auto-updater disabled in development mode");
      return;
    }

    // Configure auto-updater for GitHub releases
    autoUpdater.setFeedURL({
      provider: "github",
      owner: "HeroTools",
      repo: "open-whispr",
      private: false,
    });

    // Auto-updater logging
    autoUpdater.logger = console;

    // Set up event handlers
    this.setupEventHandlers();
  }

  setupEventHandlers() {
    autoUpdater.on("checking-for-update", () => {
      console.log("🔍 Checking for updates...");
    });

    autoUpdater.on("update-available", (info) => {
      console.log("📥 Update available:", info);
      this.updateAvailable = true;

      // Send notification to renderer processes
      this.notifyRenderers("update-available", info);
    });

    autoUpdater.on("update-not-available", (info) => {
      console.log("✅ Update not available:", info);
      this.updateAvailable = false;

      // Send notification to renderer processes
      this.notifyRenderers("update-not-available", info);
    });

    autoUpdater.on("error", (err) => {
      console.error("❌ Auto-updater error:", err);
      this.updateAvailable = false;
      this.updateDownloaded = false;

      // Send error notification to renderer processes
      this.notifyRenderers("update-error", err);
    });

    autoUpdater.on("download-progress", (progressObj) => {
      let logMessage = `📊 Download speed: ${progressObj.bytesPerSecond}`;
      logMessage += ` - Downloaded ${progressObj.percent}%`;
      logMessage += ` (${progressObj.transferred}/${progressObj.total})`;
      console.log(logMessage);

      // Send progress to renderer processes
      this.notifyRenderers("update-download-progress", progressObj);
    });

    autoUpdater.on("update-downloaded", (info) => {
      console.log("✅ Update downloaded:", info);
      this.updateDownloaded = true;

      // Send notification to renderer processes
      this.notifyRenderers("update-downloaded", info);
    });
  }

  notifyRenderers(channel, data) {
    if (this.mainWindow && this.mainWindow.webContents) {
      this.mainWindow.webContents.send(channel, data);
    }
    if (this.controlPanelWindow && this.controlPanelWindow.webContents) {
      this.controlPanelWindow.webContents.send(channel, data);
    }
  }

  setupIPCHandlers() {
    // Check for updates manually
    ipcMain.handle("check-for-updates", async () => {
      try {
        if (process.env.NODE_ENV === "development") {
          console.log("⚠️ Update check skipped in development mode");
          return {
            updateAvailable: false,
            message: "Update checks are disabled in development mode",
          };
        }

        console.log("🔍 Manual update check requested...");
        const result = await autoUpdater.checkForUpdates();

        if (result && result.updateInfo) {
          console.log("📋 Update check result:", result.updateInfo);
          return {
            updateAvailable: true,
            version: result.updateInfo.version,
            releaseDate: result.updateInfo.releaseDate,
            files: result.updateInfo.files,
            releaseNotes: result.updateInfo.releaseNotes,
          };
        } else {
          console.log("✅ No updates available");
          return {
            updateAvailable: false,
            message: "You are running the latest version",
          };
        }
      } catch (error) {
        console.error("❌ Update check error:", error);
        throw error;
      }
    });

    // Download update
    ipcMain.handle("download-update", async () => {
      try {
        if (process.env.NODE_ENV === "development") {
          console.log("⚠️ Update download skipped in development mode");
          return {
            success: false,
            message: "Update downloads are disabled in development mode",
          };
        }

        console.log("📥 Manual update download requested...");
        await autoUpdater.downloadUpdate();

        return { success: true, message: "Update download started" };
      } catch (error) {
        console.error("❌ Update download error:", error);
        throw error;
      }
    });

    // Install update
    ipcMain.handle("install-update", async () => {
      try {
        if (process.env.NODE_ENV === "development") {
          console.log("⚠️ Update installation skipped in development mode");
          return {
            success: false,
            message: "Update installation is disabled in development mode",
          };
        }

        if (!this.updateDownloaded) {
          console.error("❌ No update downloaded to install");
          return {
            success: false,
            message: "No update available to install",
          };
        }

        console.log("🔄 Installing update and restarting...");
        
        // Use setImmediate to ensure the response is sent before quitting
        setImmediate(() => {
          autoUpdater.quitAndInstall();
        });

        return { success: true, message: "Update installation started" };
      } catch (error) {
        console.error("❌ Update installation error:", error);
        throw error;
      }
    });

    // Get app version
    ipcMain.handle("get-app-version", async () => {
      try {
        const { app } = require("electron");
        const version = app.getVersion();
        return { version };
      } catch (error) {
        console.error("❌ Error getting app version:", error);
        throw error;
      }
    });

    // Get update status
    ipcMain.handle("get-update-status", async () => {
      try {
        return {
          updateAvailable: this.updateAvailable,
          updateDownloaded: this.updateDownloaded,
          isDevelopment: process.env.NODE_ENV === "development",
        };
      } catch (error) {
        console.error("❌ Error getting update status:", error);
        throw error;
      }
    });
  }

  // Method to check for updates on startup
  checkForUpdatesOnStartup() {
    if (process.env.NODE_ENV !== "development") {
      // Wait a bit for the app to fully initialize
      setTimeout(() => {
        console.log("🔄 Checking for updates on startup...");
        autoUpdater.checkForUpdatesAndNotify();
      }, 5000);
    }
  }
}

module.exports = UpdateManager;
