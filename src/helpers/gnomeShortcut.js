/**
 * GNOME Keyboard Shortcut Integration
 *
 * Automatically registers a GNOME system keyboard shortcut that triggers
 * OpenWhispr via D-Bus. This works on native Wayland without special permissions.
 */

const { execSync } = require("child_process");
const dbus = require("dbus-next");

const DBUS_SERVICE_NAME = "com.openwhispr.App";
const DBUS_OBJECT_PATH = "/com/openwhispr/App";
const DBUS_INTERFACE = "com.openwhispr.App";

const KEYBINDING_PATH = "/org/gnome/settings-daemon/plugins/media-keys/custom-keybindings/openwhispr/";
const KEYBINDING_SCHEMA = "org.gnome.settings-daemon.plugins.media-keys.custom-keybinding";

class GnomeShortcutManager {
  constructor() {
    this.bus = null;
    this.dbusInterface = null;
    this.callback = null;
    this.isRegistered = false;
  }

  /**
   * Check if running on GNOME
   */
  static isGnome() {
    const desktop = process.env.XDG_CURRENT_DESKTOP || "";
    return desktop.toLowerCase().includes("gnome") ||
           desktop.toLowerCase().includes("ubuntu") ||
           desktop.toLowerCase().includes("unity");
  }

  /**
   * Check if running on Wayland
   */
  static isWayland() {
    return process.env.XDG_SESSION_TYPE === "wayland";
  }

  /**
   * Initialize D-Bus service that listens for toggle command
   */
  async initDBusService(callback) {
    this.callback = callback;

    try {
      this.bus = dbus.sessionBus();

      // Request the service name
      await this.bus.requestName(DBUS_SERVICE_NAME, 0);

      // Create the interface
      const iface = new OpenWhisprInterface(callback);

      // Export the interface
      this.bus.export(DBUS_OBJECT_PATH, iface);

      return true;
    } catch (err) {
      return false;
    }
  }

  /**
   * Register the GNOME keyboard shortcut
   */
  async registerKeybinding(shortcut = "<Alt>r") {
    if (!GnomeShortcutManager.isGnome()) {
      return false;
    }

    try {
      // Check if already registered
      const existing = this.getExistingKeybindings();
      if (existing.includes(KEYBINDING_PATH)) {
        this.isRegistered = true;
        return true;
      }

      // The command to trigger OpenWhispr via D-Bus
      const command = `dbus-send --session --type=method_call --dest=${DBUS_SERVICE_NAME} ${DBUS_OBJECT_PATH} ${DBUS_INTERFACE}.Toggle`;

      // Register the keybinding
      execSync(`gsettings set ${KEYBINDING_SCHEMA}:${KEYBINDING_PATH} name "OpenWhispr Toggle"`, { stdio: "pipe" });
      execSync(`gsettings set ${KEYBINDING_SCHEMA}:${KEYBINDING_PATH} binding "${shortcut}"`, { stdio: "pipe" });
      execSync(`gsettings set ${KEYBINDING_SCHEMA}:${KEYBINDING_PATH} command "${command}"`, { stdio: "pipe" });

      // Add to the list of custom keybindings
      const newBindings = [...existing, KEYBINDING_PATH];
      const bindingsStr = "['" + newBindings.join("', '") + "']";
      execSync(`gsettings set org.gnome.settings-daemon.plugins.media-keys custom-keybindings "${bindingsStr}"`, { stdio: "pipe" });

      this.isRegistered = true;
      return true;
    } catch (err) {
      return false;
    }
  }

  /**
   * Update the keybinding shortcut
   */
  async updateKeybinding(shortcut) {
    if (!this.isRegistered) {
      return this.registerKeybinding(shortcut);
    }

    try {
      execSync(`gsettings set ${KEYBINDING_SCHEMA}:${KEYBINDING_PATH} binding "${shortcut}"`, { stdio: "pipe" });
      return true;
    } catch (err) {
      return false;
    }
  }

  /**
   * Remove the keybinding
   */
  async unregisterKeybinding() {
    try {
      const existing = this.getExistingKeybindings();
      const filtered = existing.filter(p => p !== KEYBINDING_PATH);

      if (filtered.length === 0) {
        execSync(`gsettings set org.gnome.settings-daemon.plugins.media-keys custom-keybindings "[]"`, { stdio: "pipe" });
      } else {
        const bindingsStr = "['" + filtered.join("', '") + "']";
        execSync(`gsettings set org.gnome.settings-daemon.plugins.media-keys custom-keybindings "${bindingsStr}"`, { stdio: "pipe" });
      }

      // Reset the keybinding settings
      execSync(`gsettings reset ${KEYBINDING_SCHEMA}:${KEYBINDING_PATH} name`, { stdio: "pipe" });
      execSync(`gsettings reset ${KEYBINDING_SCHEMA}:${KEYBINDING_PATH} binding`, { stdio: "pipe" });
      execSync(`gsettings reset ${KEYBINDING_SCHEMA}:${KEYBINDING_PATH} command`, { stdio: "pipe" });

      this.isRegistered = false;
      return true;
    } catch (err) {
      return false;
    }
  }

  /**
   * Get existing custom keybindings
   */
  getExistingKeybindings() {
    try {
      const output = execSync("gsettings get org.gnome.settings-daemon.plugins.media-keys custom-keybindings", { encoding: "utf-8" });
      // Parse the array format: ['path1', 'path2']
      const match = output.match(/\[([^\]]*)\]/);
      if (!match) return [];

      const content = match[1];
      if (!content.trim()) return [];

      return content.split(",").map(s => s.trim().replace(/'/g, "")).filter(Boolean);
    } catch {
      return [];
    }
  }

  /**
   * Convert Electron-style hotkey to GNOME format
   */
  static convertToGnomeFormat(hotkey) {
    return hotkey
      .replace(/CommandOrControl/gi, "<Control>")
      .replace(/Control/gi, "<Control>")
      .replace(/Ctrl/gi, "<Control>")
      .replace(/Alt/gi, "<Alt>")
      .replace(/Shift/gi, "<Shift>")
      .replace(/Super/gi, "<Super>")
      .replace(/Meta/gi, "<Super>")
      .replace(/\+/g, "")
      .replace(/\s/g, "");
  }

  /**
   * Close D-Bus connection
   */
  close() {
    if (this.bus) {
      this.bus.disconnect();
      this.bus = null;
    }
  }
}

/**
 * D-Bus Interface for OpenWhispr
 */
class OpenWhisprInterface extends dbus.interface.Interface {
  constructor(callback) {
    super(DBUS_INTERFACE);
    this._callback = callback;
  }

  Toggle() {
    if (this._callback) {
      this._callback();
    }
  }
}

// Define the interface
OpenWhisprInterface.configureMembers({
  methods: {
    Toggle: {
      inSignature: "",
      outSignature: "",
    },
  },
});

module.exports = GnomeShortcutManager;
