const { execFileSync } = require("child_process");
const debugLogger = require("./debugLogger");

const DBUS_SERVICE_NAME = "com.openwhispr.App";
const DBUS_OBJECT_PATH = "/com/openwhispr/App";
const DBUS_INTERFACE = "com.openwhispr.App";

const KEYBINDING_PATH =
  "/org/gnome/settings-daemon/plugins/media-keys/custom-keybindings/openwhispr/";
const KEYBINDING_SCHEMA = "org.gnome.settings-daemon.plugins.media-keys.custom-keybinding";

// Valid pattern for GNOME shortcut format (e.g., "<Alt>r", "<Control><Shift>space")
// Supports: letters/digits, function keys (F1-F24), navigation, and special keys
const VALID_SHORTCUT_PATTERN =
  /^(<(Control|Alt|Shift|Super)>)*(F([1-9]|1[0-9]|2[0-4])|[a-z0-9]|space|escape|tab|backspace|grave|pause|scroll_lock|insert|delete|home|end|page_up|page_down|up|down|left|right|return|print)$/i;

// Map Electron key names to GNOME keysym names
const ELECTRON_TO_GNOME_KEY_MAP = {
  pageup: "page_up",
  pagedown: "page_down",
  scrolllock: "scroll_lock",
  printscreen: "print",
  enter: "return",
  arrowup: "up",
  arrowdown: "down",
  arrowleft: "left",
  arrowright: "right",
};

let dbus = null;

function getDBus() {
  if (dbus) return dbus;
  try {
    dbus = require("dbus-next");
    return dbus;
  } catch (err) {
    debugLogger.log("[GnomeShortcut] Failed to load dbus-next:", err.message);
    return null;
  }
}

class GnomeShortcutManager {
  constructor() {
    this.bus = null;
    this.callback = null;
    this.isRegistered = false;
  }

  static isGnome() {
    const desktop = process.env.XDG_CURRENT_DESKTOP || "";
    return (
      desktop.toLowerCase().includes("gnome") ||
      desktop.toLowerCase().includes("ubuntu") ||
      desktop.toLowerCase().includes("unity")
    );
  }

  static isWayland() {
    return process.env.XDG_SESSION_TYPE === "wayland";
  }

  async initDBusService(callback) {
    this.callback = callback;

    const dbusModule = getDBus();
    if (!dbusModule) {
      return false;
    }

    try {
      this.bus = dbusModule.sessionBus();
      await this.bus.requestName(DBUS_SERVICE_NAME, 0);

      const InterfaceClass = this._createInterfaceClass(dbusModule, callback);
      const iface = new InterfaceClass();
      this.bus.export(DBUS_OBJECT_PATH, iface);

      debugLogger.log("[GnomeShortcut] D-Bus service initialized successfully");
      return true;
    } catch (err) {
      debugLogger.log("[GnomeShortcut] Failed to initialize D-Bus service:", err.message);
      if (this.bus) {
        this.bus.disconnect();
        this.bus = null;
      }
      return false;
    }
  }

  _createInterfaceClass(dbusModule, callback) {
    class OpenWhisprInterface extends dbusModule.interface.Interface {
      constructor() {
        super(DBUS_INTERFACE);
        this._callback = callback;
      }

      Toggle() {
        if (this._callback) {
          this._callback();
        }
      }
    }

    OpenWhisprInterface.configureMembers({
      methods: {
        Toggle: { inSignature: "", outSignature: "" },
      },
    });

    return OpenWhisprInterface;
  }

  static isValidShortcut(shortcut) {
    if (!shortcut || typeof shortcut !== "string") {
      return false;
    }
    return VALID_SHORTCUT_PATTERN.test(shortcut);
  }

  async registerKeybinding(shortcut = "<Alt>r") {
    if (!GnomeShortcutManager.isGnome()) {
      debugLogger.log("[GnomeShortcut] Not running on GNOME, skipping registration");
      return false;
    }

    if (!GnomeShortcutManager.isValidShortcut(shortcut)) {
      debugLogger.log(`[GnomeShortcut] Invalid shortcut format: "${shortcut}"`);
      return false;
    }

    try {
      const existing = this.getExistingKeybindings();
      const alreadyRegistered = existing.includes(KEYBINDING_PATH);

      const command = `dbus-send --session --type=method_call --dest=${DBUS_SERVICE_NAME} ${DBUS_OBJECT_PATH} ${DBUS_INTERFACE}.Toggle`;

      execFileSync(
        "gsettings",
        ["set", `${KEYBINDING_SCHEMA}:${KEYBINDING_PATH}`, "name", "OpenWhispr Toggle"],
        { stdio: "pipe" }
      );
      execFileSync(
        "gsettings",
        ["set", `${KEYBINDING_SCHEMA}:${KEYBINDING_PATH}`, "binding", shortcut],
        { stdio: "pipe" }
      );
      execFileSync(
        "gsettings",
        ["set", `${KEYBINDING_SCHEMA}:${KEYBINDING_PATH}`, "command", command],
        { stdio: "pipe" }
      );

      if (!alreadyRegistered) {
        const newBindings = [...existing, KEYBINDING_PATH];
        const bindingsStr = "['" + newBindings.join("', '") + "']";
        execFileSync(
          "gsettings",
          [
            "set",
            "org.gnome.settings-daemon.plugins.media-keys",
            "custom-keybindings",
            bindingsStr,
          ],
          { stdio: "pipe" }
        );
      }

      this.isRegistered = true;
      debugLogger.log(`[GnomeShortcut] Keybinding "${shortcut}" registered successfully`);
      return true;
    } catch (err) {
      debugLogger.log("[GnomeShortcut] Failed to register keybinding:", err.message);
      return false;
    }
  }

  async updateKeybinding(shortcut) {
    if (!this.isRegistered) {
      return this.registerKeybinding(shortcut);
    }

    if (!GnomeShortcutManager.isValidShortcut(shortcut)) {
      debugLogger.log(`[GnomeShortcut] Invalid shortcut format for update: "${shortcut}"`);
      return false;
    }

    try {
      execFileSync(
        "gsettings",
        ["set", `${KEYBINDING_SCHEMA}:${KEYBINDING_PATH}`, "binding", shortcut],
        { stdio: "pipe" }
      );
      debugLogger.log(`[GnomeShortcut] Keybinding updated to "${shortcut}"`);
      return true;
    } catch (err) {
      debugLogger.log("[GnomeShortcut] Failed to update keybinding:", err.message);
      return false;
    }
  }

  async unregisterKeybinding() {
    try {
      const existing = this.getExistingKeybindings();
      const filtered = existing.filter((p) => p !== KEYBINDING_PATH);

      if (filtered.length === 0) {
        execFileSync(
          "gsettings",
          ["set", "org.gnome.settings-daemon.plugins.media-keys", "custom-keybindings", "[]"],
          { stdio: "pipe" }
        );
      } else {
        const bindingsStr = "['" + filtered.join("', '") + "']";
        execFileSync(
          "gsettings",
          [
            "set",
            "org.gnome.settings-daemon.plugins.media-keys",
            "custom-keybindings",
            bindingsStr,
          ],
          { stdio: "pipe" }
        );
      }

      execFileSync("gsettings", ["reset", `${KEYBINDING_SCHEMA}:${KEYBINDING_PATH}`, "name"], {
        stdio: "pipe",
      });
      execFileSync("gsettings", ["reset", `${KEYBINDING_SCHEMA}:${KEYBINDING_PATH}`, "binding"], {
        stdio: "pipe",
      });
      execFileSync("gsettings", ["reset", `${KEYBINDING_SCHEMA}:${KEYBINDING_PATH}`, "command"], {
        stdio: "pipe",
      });

      this.isRegistered = false;
      debugLogger.log("[GnomeShortcut] Keybinding unregistered successfully");
      return true;
    } catch (err) {
      debugLogger.log("[GnomeShortcut] Failed to unregister keybinding:", err.message);
      return false;
    }
  }

  getExistingKeybindings() {
    try {
      const output = execFileSync(
        "gsettings",
        ["get", "org.gnome.settings-daemon.plugins.media-keys", "custom-keybindings"],
        { encoding: "utf-8" }
      );
      const match = output.match(/\[([^\]]*)\]/);
      if (!match) return [];

      const content = match[1];
      if (!content.trim()) return [];

      return content
        .split(",")
        .map((s) => s.trim().replace(/'/g, ""))
        .filter(Boolean);
    } catch (err) {
      debugLogger.log("[GnomeShortcut] Failed to read existing keybindings:", err.message);
      return [];
    }
  }

  static convertToGnomeFormat(hotkey) {
    if (!hotkey || typeof hotkey !== "string") {
      return "";
    }

    const parts = hotkey
      .split("+")
      .map((p) => p.trim())
      .filter(Boolean);
    if (parts.length === 0) {
      return "";
    }

    const key = parts.pop();
    const modifiers = parts
      .map((mod) => {
        const m = mod.toLowerCase();
        if (m === "commandorcontrol" || m === "control" || m === "ctrl") return "<Control>";
        if (m === "alt") return "<Alt>";
        if (m === "shift") return "<Shift>";
        if (m === "super" || m === "meta") return "<Super>";
        return "";
      })
      .filter(Boolean)
      .join("");

    let gnomeKey = key.toLowerCase();

    if (gnomeKey === "`" || gnomeKey === "backquote") {
      gnomeKey = "grave";
    }
    if (gnomeKey === " ") {
      gnomeKey = "space";
    }
    if (ELECTRON_TO_GNOME_KEY_MAP[gnomeKey]) {
      gnomeKey = ELECTRON_TO_GNOME_KEY_MAP[gnomeKey];
    }

    return modifiers + gnomeKey;
  }

  close() {
    if (this.bus) {
      this.bus.disconnect();
      this.bus = null;
    }
  }
}

module.exports = GnomeShortcutManager;
