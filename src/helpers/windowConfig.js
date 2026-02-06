const path = require("path");

const WINDOW_SIZES = {
  BASE: { width: 96, height: 96 },
  WITH_MENU: { width: 240, height: 280 },
  WITH_TOAST: { width: 400, height: 500 },
  EXPANDED: { width: 400, height: 500 },
};

// Main dictation window configuration
const MAIN_WINDOW_CONFIG = {
  width: WINDOW_SIZES.BASE.width,
  height: WINDOW_SIZES.BASE.height,
  title: "Voice Recorder",
  webPreferences: {
    preload: path.join(__dirname, "..", "..", "preload.js"),
    nodeIntegration: false,
    contextIsolation: true,
    sandbox: true,
  },
  frame: false,
  alwaysOnTop: true,
  resizable: false,
  transparent: true,
  show: false, // Start hidden, show after setup
  skipTaskbar: false, // Keep visible in Dock/taskbar so app stays discoverable
  focusable: true,
  visibleOnAllWorkspaces: process.platform !== "win32",
  fullScreenable: false,
  hasShadow: false, // Remove shadow for cleaner look
  acceptsFirstMouse: true, // Accept clicks even when not focused
  // Panel on macOS preserves floating behavior
  // Toolbar on Linux hides from Alt+Tab on most compositors (GNOME, KDE, etc.)
  type:
    process.platform === "darwin" ? "panel" : process.platform === "linux" ? "toolbar" : "normal",
};

// Control panel window configuration
const CONTROL_PANEL_CONFIG = {
  width: 1200,
  height: 800,
  webPreferences: {
    preload: path.join(__dirname, "..", "..", "preload.js"),
    nodeIntegration: false,
    contextIsolation: true,
    sandbox: false,
    webSecurity: false,
    spellcheck: false,
  },
  title: "Control Panel",
  resizable: true,
  show: false,
  frame: false,
  ...(process.platform === "darwin" && {
    titleBarStyle: "hiddenInset",
    trafficLightPosition: { x: 20, y: 20 },
  }),
  transparent: false,
  minimizable: true,
  maximizable: true,
  closable: true,
  fullscreenable: true,
  skipTaskbar: false, // Ensure control panel stays in taskbar
  alwaysOnTop: false, // Control panel should not be always on top
  visibleOnAllWorkspaces: false, // Control panel should stay in its workspace
  type: "normal", // Ensure it's a normal window, not a panel
};

// Window positioning utilities
class WindowPositionUtil {
  static getMainWindowPosition(display, customSize = null) {
    const { width, height } = customSize || WINDOW_SIZES.BASE;
    const MARGIN = 24;
    const workArea = display.workArea || display.bounds;
    const x = Math.max(0, workArea.x + workArea.width - width - MARGIN);
    const y = Math.max(0, workArea.y + workArea.height - height - MARGIN);
    return { x, y, width, height };
  }

  static setupAlwaysOnTop(window) {
    if (process.platform === "darwin") {
      // macOS: Use panel level for proper floating behavior
      // This ensures the window stays on top across spaces and fullscreen apps
      window.setAlwaysOnTop(true, "floating", 1);
      window.setVisibleOnAllWorkspaces(true, {
        visibleOnFullScreen: true,
        skipTransformProcessType: true, // Keep Dock/Command-Tab behaviour
      });
      window.setFullScreenable(false);

      // Ensure window level is maintained
      if (window.isVisible()) {
        window.setAlwaysOnTop(true, "floating", 1);
      }
    } else if (process.platform === "win32") {
      window.setAlwaysOnTop(true, "pop-up-menu");
    } else {
      // Linux and other platforms
      window.setAlwaysOnTop(true, "screen-saver");
      // Attempt to set visible on all workspaces (works on X11, may not work on Wayland)
      // For KDE Wayland, a separate KWin script integration is used (see kdeIntegration.js)
      window.setVisibleOnAllWorkspaces(true);
    }

    // Bring window to front if visible
    if (window.isVisible()) {
      window.moveTop();
    }
  }

  static setupControlPanel(window) {
    // Control panel should behave like a normal application window
    // This is only called once during window creation
    // No need to repeatedly set these values
  }
}

module.exports = {
  MAIN_WINDOW_CONFIG,
  CONTROL_PANEL_CONFIG,
  WINDOW_SIZES,
  WindowPositionUtil,
};
