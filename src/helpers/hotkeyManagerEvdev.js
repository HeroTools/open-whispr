/**
 * evdev-based Global Hotkey Manager for Linux Wayland
 *
 * This reads keyboard events directly from /dev/input/ which works
 * regardless of display server (X11, Wayland, or even TTY).
 *
 * Requirements:
 * - User must be in 'input' group: sudo usermod -aG input $USER
 * - Logout/login after adding to group
 */

const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");

// Key codes from linux/input-event-codes.h
const KEY_CODES = {
  KEY_ESC: 1,
  KEY_1: 2, KEY_2: 3, KEY_3: 4, KEY_4: 5, KEY_5: 6,
  KEY_6: 7, KEY_7: 8, KEY_8: 9, KEY_9: 10, KEY_0: 11,
  KEY_Q: 16, KEY_W: 17, KEY_E: 18, KEY_R: 19, KEY_T: 20,
  KEY_Y: 21, KEY_U: 22, KEY_I: 23, KEY_O: 24, KEY_P: 25,
  KEY_A: 30, KEY_S: 31, KEY_D: 32, KEY_F: 33, KEY_G: 34,
  KEY_H: 35, KEY_J: 36, KEY_K: 37, KEY_L: 38,
  KEY_Z: 44, KEY_X: 45, KEY_C: 46, KEY_V: 47, KEY_B: 48,
  KEY_N: 49, KEY_M: 50,
  KEY_SPACE: 57,
  KEY_F1: 59, KEY_F2: 60, KEY_F3: 61, KEY_F4: 62, KEY_F5: 63,
  KEY_F6: 64, KEY_F7: 65, KEY_F8: 66, KEY_F9: 67, KEY_F10: 68,
  KEY_F11: 87, KEY_F12: 88,
  KEY_LEFTCTRL: 29, KEY_RIGHTCTRL: 97,
  KEY_LEFTSHIFT: 42, KEY_RIGHTSHIFT: 54,
  KEY_LEFTALT: 56, KEY_RIGHTALT: 100,
  KEY_LEFTMETA: 125, KEY_RIGHTMETA: 126,
  KEY_GRAVE: 41, // ` backtick
  KEY_PAUSE: 119,
  KEY_SCROLLLOCK: 70,
};

class EvdevHotkeyManager {
  constructor() {
    this.callback = null;
    this.targetHotkey = null;
    this.keyboardDevices = [];
    this.streams = [];
    this.isRunning = false;
    this.pressedKeys = new Set();
  }

  /**
   * Find keyboard devices in /dev/input/
   */
  findKeyboardDevices() {
    const devices = [];

    try {
      const inputDir = "/dev/input";
      const byId = "/dev/input/by-id";

      // Try to find keyboards by-id first (more reliable)
      if (fs.existsSync(byId)) {
        const byIdFiles = fs.readdirSync(byId);
        for (const file of byIdFiles) {
          if (file.includes("kbd") || file.includes("keyboard")) {
            const fullPath = path.join(byId, file);
            const realPath = fs.realpathSync(fullPath);
            if (!devices.includes(realPath)) {
              devices.push(realPath);
            }
          }
        }
      }

      // Fallback: check /proc/bus/input/devices
      if (devices.length === 0) {
        try {
          const procDevices = fs.readFileSync("/proc/bus/input/devices", "utf-8");
          const sections = procDevices.split("\n\n");

          for (const section of sections) {
            if (section.toLowerCase().includes("keyboard") ||
                section.includes("EV=120013") || // Common keyboard event mask
                section.includes("EV=12001f")) {
              const handlerMatch = section.match(/H: Handlers=.*?(event\d+)/);
              if (handlerMatch) {
                const devicePath = `/dev/input/${handlerMatch[1]}`;
                if (fs.existsSync(devicePath) && !devices.includes(devicePath)) {
                  devices.push(devicePath);
                }
              }
            }
          }
        } catch (e) {
          // Silently continue to fallback
        }
      }

      // Last resort: try event0-9
      if (devices.length === 0) {
        for (let i = 0; i < 10; i++) {
          const devicePath = `/dev/input/event${i}`;
          if (fs.existsSync(devicePath)) {
            devices.push(devicePath);
          }
        }
      }
    } catch (err) {
      // Silently fail
    }

    return devices;
  }

  /**
   * Parse hotkey string like "Alt+R" into key codes
   */
  parseHotkey(hotkeyStr) {
    const parts = hotkeyStr.toLowerCase().split("+");
    const keys = [];

    for (const part of parts) {
      const normalized = part.trim()
        .replace("commandorcontrol", "ctrl")
        .replace("control", "ctrl")
        .replace("cmd", "meta")
        .replace("super", "meta")
        .replace("win", "meta");

      switch (normalized) {
        case "ctrl":
          keys.push(KEY_CODES.KEY_LEFTCTRL);
          break;
        case "shift":
          keys.push(KEY_CODES.KEY_LEFTSHIFT);
          break;
        case "alt":
          keys.push(KEY_CODES.KEY_LEFTALT);
          break;
        case "meta":
          keys.push(KEY_CODES.KEY_LEFTMETA);
          break;
        case "space":
          keys.push(KEY_CODES.KEY_SPACE);
          break;
        case "`":
        case "grave":
        case "backtick":
          keys.push(KEY_CODES.KEY_GRAVE);
          break;
        case "pause":
          keys.push(KEY_CODES.KEY_PAUSE);
          break;
        case "scrolllock":
          keys.push(KEY_CODES.KEY_SCROLLLOCK);
          break;
        default:
          // Try single letter or F-key
          if (normalized.length === 1) {
            const keyName = `KEY_${normalized.toUpperCase()}`;
            if (KEY_CODES[keyName]) {
              keys.push(KEY_CODES[keyName]);
            }
          } else if (/^f\d+$/.test(normalized)) {
            const keyName = `KEY_${normalized.toUpperCase()}`;
            if (KEY_CODES[keyName]) {
              keys.push(KEY_CODES[keyName]);
            }
          }
      }
    }

    return keys;
  }

  /**
   * Check if user has permission to read input devices
   * Returns silently - no warnings, as this is an optional enhancement
   */
  checkPermissions() {
    try {
      const groups = execSync("groups", { encoding: "utf-8" });
      return groups.includes("input");
    } catch {
      return false;
    }
  }

  /**
   * Start listening for the hotkey
   */
  async start(hotkeyStr, callback) {
    if (this.isRunning) {
      await this.stop();
    }

    this.callback = callback;
    this.targetHotkey = this.parseHotkey(hotkeyStr);

    if (this.targetHotkey.length === 0) {
      throw new Error(`Could not parse hotkey: ${hotkeyStr}`);
    }

    // Check permissions silently
    if (!this.checkPermissions()) {
      throw new Error("No access to input devices");
    }

    // Find keyboard devices
    this.keyboardDevices = this.findKeyboardDevices();

    if (this.keyboardDevices.length === 0) {
      throw new Error("No keyboard devices found in /dev/input/");
    }

    this.isRunning = true;

    // Open devices and start reading
    for (const device of this.keyboardDevices) {
      try {
        this.readDevice(device);
      } catch (err) {
        // Skip devices that can't be opened
      }
    }

    if (this.streams.length === 0) {
      this.isRunning = false;
      throw new Error("Could not open any keyboard devices");
    }

    return true;
  }

  /**
   * Read events from a device using streams
   */
  readDevice(devicePath) {
    // input_event structure: time (16 bytes) + type (2) + code (2) + value (4) = 24 bytes
    const eventSize = 24;

    try {
      const stream = fs.createReadStream(devicePath, {
        highWaterMark: eventSize * 64,  // Buffer multiple events
      });

      this.streams.push(stream);

      let buffer = Buffer.alloc(0);

      stream.on("data", (chunk) => {
        if (!this.isRunning) return;

        // Append new data to buffer
        buffer = Buffer.concat([buffer, chunk]);

        // Process complete events
        while (buffer.length >= eventSize) {
          const eventBuffer = buffer.slice(0, eventSize);
          buffer = buffer.slice(eventSize);
          this.processEvent(eventBuffer);
        }
      });

      stream.on("error", () => {
        // Silently handle stream errors
      });

      stream.on("close", () => {
        // Stream closed
      });

    } catch (err) {
      // Could not create stream
    }
  }

  /**
   * Process an input event
   */
  processEvent(buffer) {
    // Skip timestamp (16 bytes), read type, code, value
    const type = buffer.readUInt16LE(16);
    const code = buffer.readUInt16LE(18);
    const value = buffer.readInt32LE(20);

    // EV_KEY = 1
    if (type !== 1) return;

    // value: 0 = release, 1 = press, 2 = repeat
    if (value === 1) {
      // Key pressed
      this.pressedKeys.add(code);

      // Also track right-side modifiers as left-side
      if (code === KEY_CODES.KEY_RIGHTCTRL) this.pressedKeys.add(KEY_CODES.KEY_LEFTCTRL);
      if (code === KEY_CODES.KEY_RIGHTSHIFT) this.pressedKeys.add(KEY_CODES.KEY_LEFTSHIFT);
      if (code === KEY_CODES.KEY_RIGHTALT) this.pressedKeys.add(KEY_CODES.KEY_LEFTALT);
      if (code === KEY_CODES.KEY_RIGHTMETA) this.pressedKeys.add(KEY_CODES.KEY_LEFTMETA);

      this.checkHotkey();
    } else if (value === 0) {
      // Key released
      this.pressedKeys.delete(code);

      // Also remove right-side mappings
      if (code === KEY_CODES.KEY_RIGHTCTRL) this.pressedKeys.delete(KEY_CODES.KEY_LEFTCTRL);
      if (code === KEY_CODES.KEY_RIGHTSHIFT) this.pressedKeys.delete(KEY_CODES.KEY_LEFTSHIFT);
      if (code === KEY_CODES.KEY_RIGHTALT) this.pressedKeys.delete(KEY_CODES.KEY_LEFTALT);
      if (code === KEY_CODES.KEY_RIGHTMETA) this.pressedKeys.delete(KEY_CODES.KEY_LEFTMETA);
    }
  }

  /**
   * Check if the target hotkey combination is pressed
   */
  checkHotkey() {
    if (!this.targetHotkey || this.targetHotkey.length === 0) return;

    // Check if all target keys are pressed
    const allPressed = this.targetHotkey.every(keyCode => this.pressedKeys.has(keyCode));

    if (allPressed && this.callback) {
      // Clear pressed keys to avoid repeated triggers
      this.pressedKeys.clear();
      this.callback();
    }
  }

  /**
   * Stop listening
   */
  async stop() {
    this.isRunning = false;

    for (const stream of this.streams) {
      try {
        stream.destroy();
      } catch (err) {
        // Ignore close errors
      }
    }

    this.streams = [];
    this.pressedKeys.clear();
  }

  /**
   * Check if evdev hotkeys are available
   */
  static isAvailable() {
    // Check if /dev/input exists and user is in input group
    if (!fs.existsSync("/dev/input")) {
      return false;
    }

    try {
      const groups = execSync("groups", { encoding: "utf-8" });
      return groups.includes("input");
    } catch {
      return false;
    }
  }
}

module.exports = EvdevHotkeyManager;
