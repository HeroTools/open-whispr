/**
 * KDE Plasma Integration for OpenWhispr
 *
 * Handles KDE-specific window management on Wayland, where Electron's
 * setVisibleOnAllWorkspaces() doesn't work properly.
 *
 * Known issue documented by other Electron applications:
 * - CherryHQ/cherry-studio: "setVisibleOnAllWorkspaces in Linux environments
 *   (especially KDE Wayland) can cause windows to go into a 'false popup' state"
 *   https://github.com/CherryHQ/cherry-studio/blob/main/src/main/services/WindowService.ts
 * - Hiram-Wong/ZyPlayer: Same workaround, explicitly skips the call on Linux
 *   https://github.com/Hiram-Wong/ZyPlayer/blob/main/src/main/services/WindowService.ts
 *
 * Uses KWin's D-Bus scripting interface to:
 * - Make the overlay window visible on all virtual desktops
 * - Hide the overlay from the window switcher (Alt+Tab)
 * - Hide from pager and taskbar
 */

const { exec } = require("child_process");
const debugLogger = require("./debugLogger");

class KDEIntegration {
  constructor() {
    this.isKDE = false;
    this.isWayland = false;
    this.initialized = false;
  }

  /**
   * Detect if running on KDE Plasma
   */
  detectKDE() {
    const desktop = process.env.XDG_CURRENT_DESKTOP || "";
    const session = process.env.DESKTOP_SESSION || "";
    const kdeSession = process.env.KDE_FULL_SESSION || "";

    this.isKDE =
      desktop.toLowerCase().includes("kde") ||
      session.toLowerCase().includes("plasma") ||
      session.toLowerCase().includes("kde") ||
      kdeSession === "true";

    this.isWayland = process.env.XDG_SESSION_TYPE === "wayland";

    debugLogger.debug("[KDEIntegration] Environment detection", {
      isKDE: this.isKDE,
      isWayland: this.isWayland,
      desktop,
      session,
    });

    return this.isKDE;
  }

  /**
   * Check if KWin scripting is available via D-Bus
   */
  async isKWinAvailable() {
    return new Promise((resolve) => {
      // Try qdbus6 first (Plasma 6), then qdbus (Plasma 5)
      exec(
        "qdbus6 org.kde.KWin /KWin 2>/dev/null || qdbus org.kde.KWin /KWin 2>/dev/null",
        (error) => {
          resolve(!error);
        }
      );
    });
  }

  /**
   * Execute a KWin script via D-Bus to configure the overlay window
   *
   * The script finds windows matching the app's title/class and sets:
   * - onAllDesktops = true (visible on all virtual desktops)
   * - skipSwitcher = true (hidden from Alt+Tab)
   * - skipTaskbar = true (hidden from taskbar)
   * - skipPager = true (hidden from pager)
   */
  async configureOverlayWindow() {
    if (process.platform !== "linux") {
      return { success: false, reason: "not_linux" };
    }

    if (!this.initialized) {
      this.detectKDE();
      this.initialized = true;
    }

    if (!this.isKDE) {
      debugLogger.debug("[KDEIntegration] Not running on KDE, skipping");
      return { success: false, reason: "not_kde" };
    }

    const kwinAvailable = await this.isKWinAvailable();
    if (!kwinAvailable) {
      debugLogger.debug("[KDEIntegration] KWin D-Bus not available");
      return { success: false, reason: "kwin_unavailable" };
    }

    // KWin script to configure the overlay window
    // Matches by window title "Voice Recorder" or resource class containing "openwhispr"
    const kwinScript = `
      (function() {
        function configureWindow(window) {
          if (!window) return;
          var caption = window.caption || "";
          var resourceClass = (window.resourceClass || "").toLowerCase();
          var resourceName = (window.resourceName || "").toLowerCase();
          
          // Match the dictation overlay window
          if (caption === "Voice Recorder" || 
              resourceClass.indexOf("openwhispr") !== -1 ||
              resourceName.indexOf("openwhispr") !== -1) {
            window.onAllDesktops = true;
            window.skipSwitcher = true;
            window.skipTaskbar = true;
            window.skipPager = true;
          }
        }
        
        // Configure existing windows
        var windows = workspace.windowList();
        for (var i = 0; i < windows.length; i++) {
          configureWindow(windows[i]);
        }
        
        // Also configure any new windows that match (for hot-reload during development)
        workspace.windowAdded.connect(configureWindow);
      })();
    `;

    return new Promise((resolve) => {
      // Write script to a temp file and load it via qdbus
      const fs = require("fs");
      const path = require("path");
      const os = require("os");

      const scriptPath = path.join(os.tmpdir(), `openwhispr-kwin-${Date.now()}.js`);

      fs.writeFile(scriptPath, kwinScript, (writeErr) => {
        if (writeErr) {
          debugLogger.warn("[KDEIntegration] Failed to write KWin script", {
            error: writeErr.message,
          });
          resolve({ success: false, reason: "write_error", error: writeErr.message });
          return;
        }

        // Try qdbus6 first (Plasma 6), then qdbus (Plasma 5)
        const loadCmd = `(qdbus6 org.kde.KWin /Scripting org.kde.kwin.Scripting.loadScript "${scriptPath}" 2>/dev/null || qdbus org.kde.KWin /Scripting org.kde.kwin.Scripting.loadScript "${scriptPath}" 2>/dev/null)`;

        exec(loadCmd, (loadErr, stdout) => {
          if (loadErr) {
            debugLogger.warn("[KDEIntegration] Failed to load KWin script", {
              error: loadErr.message,
            });
            // Clean up temp file
            fs.unlink(scriptPath, () => {});
            resolve({ success: false, reason: "load_error", error: loadErr.message });
            return;
          }

          const scriptId = stdout.trim();
          debugLogger.debug("[KDEIntegration] KWin script loaded", { scriptId });

          // Run the script
          const runCmd = `(qdbus6 org.kde.KWin /Scripting/Script${scriptId} org.kde.kwin.Script.run 2>/dev/null || qdbus org.kde.KWin /Scripting/Script${scriptId} org.kde.kwin.Script.run 2>/dev/null)`;

          exec(runCmd, (runErr) => {
            // Clean up temp file regardless of result
            fs.unlink(scriptPath, () => {});

            if (runErr) {
              debugLogger.warn("[KDEIntegration] Failed to run KWin script", {
                error: runErr.message,
              });
              resolve({ success: false, reason: "run_error", error: runErr.message });
              return;
            }

            debugLogger.log(
              "[KDEIntegration] Successfully configured overlay window via KWin script"
            );
            resolve({ success: true });
          });
        });
      });
    });
  }

  /**
   * Apply window configuration with retry logic
   * Waits a bit after window creation for KWin to register the window
   */
  async configureOverlayWindowWithRetry(retries = 3, delayMs = 500) {
    for (let attempt = 1; attempt <= retries; attempt++) {
      debugLogger.debug("[KDEIntegration] Configuration attempt", { attempt, retries });

      const result = await this.configureOverlayWindow();
      if (result.success) {
        return result;
      }

      if (attempt < retries) {
        await new Promise((resolve) => setTimeout(resolve, delayMs));
      }
    }

    return { success: false, reason: "max_retries_exceeded" };
  }
}

module.exports = KDEIntegration;
