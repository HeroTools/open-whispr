/**
 * XDG Desktop Portal GlobalShortcuts implementation for Wayland
 *
 * This provides native global hotkey support on Wayland compositors that
 * support the org.freedesktop.portal.GlobalShortcuts interface.
 *
 * Supported: GNOME 45+, KDE Plasma 5.27+, Sway with xdg-desktop-portal-wlr
 */

const dbus = require("dbus-next");
const { randomUUID } = require("crypto");

class PortalHotkeyManager {
  constructor() {
    this.bus = null;
    this.portal = null;
    this.shortcuts = null;
    this.sessionPath = null;
    this.callback = null;
    this.shortcutId = "openwhispr-record";
    this.isInitialized = false;
  }

  /**
   * Initialize connection to D-Bus and the GlobalShortcuts portal
   */
  async init() {
    try {
      this.bus = dbus.sessionBus();

      const portalObj = await this.bus.getProxyObject(
        "org.freedesktop.portal.Desktop",
        "/org/freedesktop/portal/desktop"
      );

      this.shortcuts = portalObj.getInterface("org.freedesktop.portal.GlobalShortcuts");

      // Check if the interface exists
      if (!this.shortcuts) {
        throw new Error("GlobalShortcuts interface not available");
      }

      this.isInitialized = true;
      return true;
    } catch (err) {
      this.isInitialized = false;
      throw err;
    }
  }

  /**
   * Create a session with the portal
   */
  async createSession() {
    if (!this.isInitialized) {
      throw new Error("Portal not initialized");
    }

    try {
      const handleToken = `openwhispr_${randomUUID().replace(/-/g, "")}`;
      const sessionHandleToken = `session_${randomUUID().replace(/-/g, "")}`;

      const options = {
        handle_token: new dbus.Variant("s", handleToken),
        session_handle_token: new dbus.Variant("s", sessionHandleToken),
      };

      // CreateSession returns an object path for the request
      const requestPath = await this.shortcuts.CreateSession(options);

      // Wait for the Response signal
      const sessionPath = await this._waitForResponse(requestPath, (response, results) => {
        if (response === 0 && results.session_handle) {
          return results.session_handle.value || results.session_handle;
        }
        throw new Error(`CreateSession failed with response ${response}`);
      });

      this.sessionPath = sessionPath;

      // Listen for Activated signal
      this._setupActivatedListener();

      return this.sessionPath;
    } catch (err) {
      throw err;
    }
  }

  /**
   * Bind a shortcut
   */
  async bindShortcut(shortcut, callback) {
    if (!this.sessionPath) {
      throw new Error("No session created");
    }

    this.callback = callback;

    try {
      const handleToken = `bind_${randomUUID().replace(/-/g, "")}`;

      // dbus-next uses Variant class directly
      const { Variant } = dbus;

      // Shortcuts is an array of structs: (sa{sv})
      // In dbus-next, structs are represented as arrays
      const shortcuts = [
        [
          this.shortcutId,
          {
            description: new Variant("s", "Start/stop recording"),
            preferred_trigger: new Variant("s", shortcut),
          },
        ],
      ];

      const options = {
        handle_token: new Variant("s", handleToken),
      };

      const requestPath = await this.shortcuts.BindShortcuts(
        this.sessionPath,
        shortcuts,
        "",  // parent_window
        options
      );

      await this._waitForResponse(requestPath, (response, results) => {
        if (response === 0) {
          return true;
        }
        throw new Error(`BindShortcuts failed with response ${response}`);
      });

      return true;
    } catch (err) {
      throw err;
    }
  }

  /**
   * Set up listener for the Activated signal
   */
  _setupActivatedListener() {
    try {
      this.shortcuts.on("Activated", (sessionHandle, shortcutId, timestamp, options) => {
        if (shortcutId === this.shortcutId && this.callback) {
          this.callback();
        }
      });
    } catch (err) {
      // Silently fail - shortcut activation won't work but app continues
    }
  }

  /**
   * Wait for a Response signal from the portal using direct signal matching
   */
  async _waitForResponse(requestPath, handler) {
    return new Promise(async (resolve, reject) => {
      const timeout = setTimeout(() => {
        cleanup();
        reject(new Error("Portal response timeout"));
      }, 5000);  // 5 second timeout for faster fallback

      let signalHandler = null;

      const cleanup = () => {
        clearTimeout(timeout);
        if (signalHandler) {
          this.bus.removeListener("message", signalHandler);
        }
      };

      // Listen for Response signal on the bus directly
      signalHandler = (msg) => {
        if (
          msg.type === 4 && // Signal
          msg.interface === "org.freedesktop.portal.Request" &&
          msg.member === "Response" &&
          msg.path === requestPath
        ) {
          cleanup();
          try {
            const [response, results] = msg.body;
            const result = handler(response, results);
            resolve(result);
          } catch (err) {
            reject(err);
          }
        }
      };

      this.bus.on("message", signalHandler);

      // Add a match rule for the signal using dbus-next's call method
      try {
        const dbusInterface = await this.bus.getProxyObject(
          "org.freedesktop.DBus",
          "/org/freedesktop/DBus"
        );
        const dbus = dbusInterface.getInterface("org.freedesktop.DBus");
        await dbus.AddMatch(`type='signal',interface='org.freedesktop.portal.Request',member='Response',path='${requestPath}'`);
      } catch (err) {
        // Continue anyway - the signal might still be received
      }
    });
  }

  /**
   * Close the session
   */
  async close() {
    if (this.sessionPath && this.bus) {
      try {
        const sessionObj = await this.bus.getProxyObject(
          "org.freedesktop.portal.Desktop",
          this.sessionPath
        );
        const session = sessionObj.getInterface("org.freedesktop.portal.Session");
        await session.Close();
      } catch (err) {
        // Ignore close errors
      }
    }

    if (this.bus) {
      this.bus.disconnect();
    }

    this.sessionPath = null;
    this.callback = null;
    this.isInitialized = false;
  }

  /**
   * Check if the GlobalShortcuts portal is available
   */
  static async isAvailable() {
    try {
      const bus = dbus.sessionBus();
      const portalObj = await bus.getProxyObject(
        "org.freedesktop.portal.Desktop",
        "/org/freedesktop/portal/desktop"
      );

      // Try to get the interface
      const shortcuts = portalObj.getInterface("org.freedesktop.portal.GlobalShortcuts");
      bus.disconnect();

      return !!shortcuts;
    } catch (err) {
      return false;
    }
  }
}

module.exports = PortalHotkeyManager;
