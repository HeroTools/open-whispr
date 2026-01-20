const { clipboard, app } = require("electron");
const { spawn, spawnSync } = require("child_process");
const { killProcess } = require("../utils/process");
const path = require("path");
const fs = require("fs");

// Cache TTL constants - these mirror CACHE_CONFIG.AVAILABILITY_CHECK_TTL in src/config/constants.ts
const CACHE_TTL_MS = 30000;

const getLinuxDesktopEnv = () =>
  [process.env.XDG_CURRENT_DESKTOP, process.env.XDG_SESSION_DESKTOP, process.env.DESKTOP_SESSION]
    .filter(Boolean)
    .join(":")
    .toLowerCase();

const isGnomeDesktop = (desktopEnv) => desktopEnv.includes("gnome");

const getLinuxSessionInfo = () => {
  const isWayland =
    (process.env.XDG_SESSION_TYPE || "").toLowerCase() === "wayland" ||
    !!process.env.WAYLAND_DISPLAY;
  const xwaylandAvailable = isWayland && !!process.env.DISPLAY;
  const desktopEnv = getLinuxDesktopEnv();
  const isGnome = isWayland && isGnomeDesktop(desktopEnv);

  return { isWayland, xwaylandAvailable, desktopEnv, isGnome };
};

// Platform-specific paste delays (ms before simulating keystroke)
// Each platform has different timing requirements based on their paste mechanism
const PASTE_DELAYS = {
  darwin: 50, // macOS: AppleScript keystroke is async, needs time for clipboard to settle
  win32_nircmd: 30, // Windows nircmd: give clipboard time to sync
  win32_pwsh: 40, // Windows PowerShell: give clipboard time to sync
  linux: 0, // Linux: xdotool sends X11 events directly, no delay needed
};

// Platform-specific clipboard restoration delays (ms after paste completes)
// Ensures paste is fully processed before restoring original clipboard content
const RESTORE_DELAYS = {
  darwin: 100, // macOS: AppleScript needs time to complete keystroke
  win32_nircmd: 80, // Windows nircmd: allow time for paste processing
  win32_pwsh: 80, // Windows PowerShell: allow time for paste processing
  linux: 200, // Linux: X11 event queue processing takes longer
};

// Legacy constant for backward compatibility (used by macOS)
const PASTE_DELAY_MS = PASTE_DELAYS.darwin;

class ClipboardManager {
  constructor() {
    this.accessibilityCache = { value: null, expiresAt: 0 };
    this.commandAvailabilityCache = new Map();
    this.nircmdPath = null;
    this.nircmdChecked = false;
  }

  // Get path to nircmd.exe (Windows only)
  getNircmdPath() {
    if (this.nircmdChecked) {
      return this.nircmdPath;
    }

    this.nircmdChecked = true;

    if (process.platform !== "win32") {
      return null;
    }

    // Try multiple paths for nircmd.exe
    const possiblePaths = [
      // Production: extraResources
      path.join(process.resourcesPath, "bin", "nircmd.exe"),
      // Development: resources/bin
      path.join(__dirname, "..", "..", "resources", "bin", "nircmd.exe"),
      path.join(process.cwd(), "resources", "bin", "nircmd.exe"),
    ];

    for (const nircmdPath of possiblePaths) {
      try {
        if (fs.existsSync(nircmdPath)) {
          this.safeLog(`✅ Found nircmd.exe at: ${nircmdPath}`);
          this.nircmdPath = nircmdPath;
          return nircmdPath;
        }
      } catch (error) {
        // Continue checking other paths
      }
    }

    this.safeLog("⚠️ nircmd.exe not found, will use PowerShell fallback");
    return null;
  }

  getNircmdStatus() {
    if (process.platform !== "win32") {
      return { available: false, reason: "Not Windows" };
    }
    const nircmdPath = this.getNircmdPath();
    return {
      available: !!nircmdPath,
      path: nircmdPath,
    };
  }

  // Safe logging method - only log in development
  safeLog(...args) {
    if (process.env.NODE_ENV === "development") {
      try {
        console.log(...args);
      } catch (error) {
        // Silently ignore EPIPE errors in logging
        if (error.code !== "EPIPE") {
          process.stderr.write(`Log error: ${error.message}\n`);
        }
      }
    }
  }

  // Check if a command exists on the system (cached)
  commandExists(cmd) {
    const now = Date.now();
    const cached = this.commandAvailabilityCache.get(cmd);
    if (cached && now < cached.expiresAt) {
      return cached.exists;
    }
    try {
      const res = spawnSync("sh", ["-c", `command -v ${cmd}`], {
        stdio: "ignore",
      });
      const exists = res.status === 0;
      this.commandAvailabilityCache.set(cmd, {
        exists,
        expiresAt: now + CACHE_TTL_MS,
      });
      return exists;
    } catch {
      this.commandAvailabilityCache.set(cmd, {
        exists: false,
        expiresAt: now + CACHE_TTL_MS,
      });
      return false;
    }
  }

  async pasteText(text) {
    const startTime = Date.now();
    const platform = process.platform;
    let method = "unknown";

    try {
      // Save original clipboard content first
      const originalClipboard = clipboard.readText();
      this.safeLog(
        "💾 Saved original clipboard content:",
        originalClipboard.substring(0, 50) + "..."
      );

      // Copy text to clipboard first - this always works
      clipboard.writeText(text);
      this.safeLog("📋 Text copied to clipboard:", text.substring(0, 50) + "...");

      if (platform === "darwin") {
        method = "applescript";
        // Check accessibility permissions first
        this.safeLog("🔍 Checking accessibility permissions for paste operation...");
        const hasPermissions = await this.checkAccessibilityPermissions();

        if (!hasPermissions) {
          this.safeLog("⚠️ No accessibility permissions - text copied to clipboard only");
          const errorMsg =
            "Accessibility permissions required for automatic pasting. Text has been copied to clipboard - please paste manually with Cmd+V.";
          throw new Error(errorMsg);
        }

        this.safeLog("✅ Permissions granted, attempting to paste...");
        await this.pasteMacOS(originalClipboard);
      } else if (platform === "win32") {
        const nircmdPath = this.getNircmdPath();
        method = nircmdPath ? "nircmd" : "powershell";
        await this.pasteWindows(originalClipboard);
      } else {
        method = "linux-tools";
        await this.pasteLinux(originalClipboard);
      }

      // Log successful paste operation timing
      this.safeLog("✅ Paste operation complete", {
        platform,
        method,
        elapsedMs: Date.now() - startTime,
        textLength: text.length,
      });
    } catch (error) {
      this.safeLog("❌ Paste operation failed", {
        platform,
        method,
        elapsedMs: Date.now() - startTime,
        error: error.message,
      });
      throw error;
    }
  }

  async pasteMacOS(originalClipboard) {
    return new Promise((resolve, reject) => {
      setTimeout(() => {
        const pasteProcess = spawn("osascript", [
          "-e",
          'tell application "System Events" to keystroke "v" using command down',
        ]);

        let errorOutput = "";
        let hasTimedOut = false;

        pasteProcess.stderr.on("data", (data) => {
          errorOutput += data.toString();
        });

        pasteProcess.on("close", (code) => {
          if (hasTimedOut) return;

          // Clear timeout first
          clearTimeout(timeoutId);

          // Clean up the process reference
          pasteProcess.removeAllListeners();

          if (code === 0) {
            this.safeLog("✅ Text pasted successfully via Cmd+V simulation");
            setTimeout(() => {
              clipboard.writeText(originalClipboard);
              this.safeLog("🔄 Original clipboard content restored");
            }, 100);
            resolve();
          } else {
            const errorMsg = `Paste failed (code ${code}). Text is copied to clipboard - please paste manually with Cmd+V.`;
            reject(new Error(errorMsg));
          }
        });

        pasteProcess.on("error", (error) => {
          if (hasTimedOut) return;
          clearTimeout(timeoutId);
          pasteProcess.removeAllListeners();
          const errorMsg = `Paste command failed: ${error.message}. Text is copied to clipboard - please paste manually with Cmd+V.`;
          reject(new Error(errorMsg));
        });

        const timeoutId = setTimeout(() => {
          hasTimedOut = true;
          killProcess(pasteProcess, "SIGKILL");
          pasteProcess.removeAllListeners();
          const errorMsg =
            "Paste operation timed out. Text is copied to clipboard - please paste manually with Cmd+V.";
          reject(new Error(errorMsg));
        }, 3000);
      }, PASTE_DELAY_MS);
    });
  }

  async pasteWindows(originalClipboard) {
    // Try nircmd first if available, fallback to PowerShell
    const nircmdPath = this.getNircmdPath();

    if (nircmdPath) {
      return this.pasteWithNircmd(nircmdPath, originalClipboard);
    } else {
      return this.pasteWithPowerShell(originalClipboard);
    }
  }

  async pasteWithNircmd(nircmdPath, originalClipboard) {
    return new Promise((resolve, reject) => {
      const pasteDelay = PASTE_DELAYS.win32_nircmd;
      const restoreDelay = RESTORE_DELAYS.win32_nircmd;

      setTimeout(() => {
        let hasTimedOut = false;
        const startTime = Date.now();

        this.safeLog(`⚡ nircmd paste starting (delay: ${pasteDelay}ms)`);

        const pasteProcess = spawn(nircmdPath, ["sendkeypress", "ctrl+v"]);

        let errorOutput = "";

        pasteProcess.stderr.on("data", (data) => {
          errorOutput += data.toString();
        });

        pasteProcess.on("close", (code) => {
          if (hasTimedOut) return;
          clearTimeout(timeoutId);

          const elapsed = Date.now() - startTime;

          if (code === 0) {
            this.safeLog(`✅ nircmd paste success`, {
              elapsedMs: elapsed,
              restoreDelayMs: restoreDelay,
            });
            setTimeout(() => {
              clipboard.writeText(originalClipboard);
              this.safeLog("🔄 Clipboard restored");
            }, restoreDelay);
            resolve();
          } else {
            this.safeLog(`❌ nircmd failed (code ${code}), falling back to PowerShell`, {
              elapsedMs: elapsed,
              stderr: errorOutput,
            });
            this.pasteWithPowerShell(originalClipboard).then(resolve).catch(reject);
          }
        });

        pasteProcess.on("error", (error) => {
          if (hasTimedOut) return;
          clearTimeout(timeoutId);
          const elapsed = Date.now() - startTime;
          this.safeLog(`❌ nircmd error, falling back to PowerShell`, {
            elapsedMs: elapsed,
            error: error.message,
          });
          this.pasteWithPowerShell(originalClipboard).then(resolve).catch(reject);
        });

        const timeoutId = setTimeout(() => {
          hasTimedOut = true;
          const elapsed = Date.now() - startTime;
          this.safeLog(`⏱️ nircmd timeout, falling back to PowerShell`, { elapsedMs: elapsed });
          killProcess(pasteProcess, "SIGKILL");
          pasteProcess.removeAllListeners();
          this.pasteWithPowerShell(originalClipboard).then(resolve).catch(reject);
        }, 2000);
      }, pasteDelay);
    });
  }

  async pasteWithPowerShell(originalClipboard) {
    return new Promise((resolve, reject) => {
      const pasteDelay = PASTE_DELAYS.win32_pwsh;
      const restoreDelay = RESTORE_DELAYS.win32_pwsh;

      setTimeout(() => {
        let hasTimedOut = false;
        const startTime = Date.now();

        this.safeLog(`🪟 PowerShell paste starting (delay: ${pasteDelay}ms)`);

        // Optimized PowerShell command:
        // - Uses [void] to suppress output (faster)
        // - WindowStyle Hidden to prevent window flash
        // - ExecutionPolicy Bypass to skip policy checks
        const pasteProcess = spawn("powershell.exe", [
          "-NoProfile",
          "-NonInteractive",
          "-WindowStyle",
          "Hidden",
          "-ExecutionPolicy",
          "Bypass",
          "-Command",
          "[void][System.Reflection.Assembly]::LoadWithPartialName('System.Windows.Forms');[System.Windows.Forms.SendKeys]::SendWait('^v')",
        ]);

        let errorOutput = "";

        pasteProcess.stderr.on("data", (data) => {
          errorOutput += data.toString();
        });

        pasteProcess.on("close", (code) => {
          if (hasTimedOut) return;
          clearTimeout(timeoutId);

          const elapsed = Date.now() - startTime;

          if (code === 0) {
            this.safeLog(`✅ PowerShell paste success`, {
              elapsedMs: elapsed,
              restoreDelayMs: restoreDelay,
            });
            setTimeout(() => {
              clipboard.writeText(originalClipboard);
              this.safeLog("🔄 Clipboard restored");
            }, restoreDelay);
            resolve();
          } else {
            this.safeLog(`❌ PowerShell paste failed`, {
              code,
              elapsedMs: elapsed,
              stderr: errorOutput,
            });
            reject(
              new Error(
                `Windows paste failed with code ${code}. Text is copied to clipboard - please paste manually with Ctrl+V.`
              )
            );
          }
        });

        pasteProcess.on("error", (error) => {
          if (hasTimedOut) return;
          clearTimeout(timeoutId);
          const elapsed = Date.now() - startTime;
          this.safeLog(`❌ PowerShell paste error`, {
            elapsedMs: elapsed,
            error: error.message,
          });
          reject(
            new Error(
              `Windows paste failed: ${error.message}. Text is copied to clipboard - please paste manually with Ctrl+V.`
            )
          );
        });

        const timeoutId = setTimeout(() => {
          hasTimedOut = true;
          const elapsed = Date.now() - startTime;
          this.safeLog(`⏱️ PowerShell paste timeout`, { elapsedMs: elapsed });
          killProcess(pasteProcess, "SIGKILL");
          pasteProcess.removeAllListeners();
          reject(
            new Error(
              "Paste operation timed out. Text is copied to clipboard - please paste manually with Ctrl+V."
            )
          );
        }, 5000);
      }, pasteDelay);
    });
  }

  async pasteLinux(originalClipboard) {
    const { isWayland, xwaylandAvailable, isGnome } = getLinuxSessionInfo();
    const xdotoolExists = this.commandExists("xdotool");
    const wtypeExists = this.commandExists("wtype");

    const getXdotoolWindowClass = () => {
      if (!xdotoolExists || (isWayland && !xwaylandAvailable)) {
        return null;
      }
      try {
        const result = spawnSync("xdotool", ["getactivewindow", "getwindowclassname"]);
        if (result.status !== 0) {
          return null;
        }
        const className = result.stdout.toString().toLowerCase().trim();
        return className || null;
      } catch {
        return null;
      }
    };

    const xdotoolWindowClass = getXdotoolWindowClass();

    // Detect if the focused window is a terminal emulator
    // Terminals use Ctrl+Shift+V for paste (since Ctrl+V/C are used for process control)
    const isTerminal = () => {
      // Common terminal emulator class names
      const terminalClasses = [
        "konsole",
        "gnome-terminal",
        "terminal",
        "kitty",
        "alacritty",
        "terminator",
        "xterm",
        "urxvt",
        "rxvt",
        "tilix",
        "terminology",
        "wezterm",
        "foot",
        "st",
        "yakuake",
      ];

      if (xdotoolWindowClass) {
        const isTerminalWindow = terminalClasses.some((term) => xdotoolWindowClass.includes(term));
        if (isTerminalWindow) {
          this.safeLog(`🖥️ Terminal detected via xdotool: ${xdotoolWindowClass}`);
        }
        return isTerminalWindow;
      }

      try {
        // Try kdotool for KDE Wayland (if available)
        if (this.commandExists("kdotool")) {
          // First get the active window ID
          const windowIdResult = spawnSync("kdotool", ["getactivewindow"]);
          if (windowIdResult.status === 0) {
            const windowId = windowIdResult.stdout.toString().trim();
            // Then get the window class name
            const classResult = spawnSync("kdotool", ["getwindowclassname", windowId]);
            if (classResult.status === 0) {
              const className = classResult.stdout.toString().toLowerCase().trim();
              const isTerminalWindow = terminalClasses.some((term) => className.includes(term));
              if (isTerminalWindow) {
                this.safeLog(`🖥️ Terminal detected via kdotool: ${className}`);
              }
              return isTerminalWindow;
            }
          }
        }
      } catch (error) {
        // Silent fallback - if detection fails, assume non-terminal
      }
      return false;
    };

    const inTerminal = isTerminal();
    const pasteKeys = inTerminal ? "ctrl+shift+v" : "ctrl+v";

    const canUseWtype = isWayland && !isGnome;
    const canUseXdotool = isWayland ? !!xdotoolWindowClass : xdotoolExists;

    // Define paste tools in preference order based on display server
    const candidates = [
      ...(canUseWtype
        ? [
            inTerminal
              ? {
                  cmd: "wtype",
                  args: ["-M", "ctrl", "-M", "shift", "-k", "v", "-m", "shift", "-m", "ctrl"],
                }
              : { cmd: "wtype", args: ["-M", "ctrl", "-k", "v", "-m", "ctrl"] },
          ]
        : []),
      ...(canUseXdotool ? [{ cmd: "xdotool", args: ["key", pasteKeys] }] : []),
    ];

    // Filter to only available tools (this.commandExists is already cached)
    const available = candidates.filter((c) => this.commandExists(c.cmd));

    // Attempt paste with a specific tool
    const pasteWith = (tool) =>
      new Promise((resolve, reject) => {
        const proc = spawn(tool.cmd, tool.args);

        let timedOut = false;
        const timeoutId = setTimeout(() => {
          timedOut = true;
          killProcess(proc, "SIGKILL");
        }, 1000);

        proc.on("close", (code) => {
          if (timedOut) return reject(new Error(`Paste with ${tool.cmd} timed out after 1 second`));
          clearTimeout(timeoutId);

          if (code === 0) {
            // Restore original clipboard after successful paste
            // Delay allows time for X11 to process paste event before clipboard is overwritten
            setTimeout(() => clipboard.writeText(originalClipboard), 200);
            resolve();
          } else {
            reject(new Error(`${tool.cmd} exited with code ${code}`));
          }
        });

        proc.on("error", (error) => {
          if (timedOut) return;
          clearTimeout(timeoutId);
          reject(error);
        });
      });

    // Try each available tool in order
    for (const tool of available) {
      try {
        await pasteWith(tool);
        this.safeLog(`✅ Paste successful using ${tool.cmd}`);
        return; // Success!
      } catch (error) {
        this.safeLog(`⚠️ Paste with ${tool.cmd} failed:`, error?.message || error);
        // Continue to next tool
      }
    }

    // All tools failed - create specific error for renderer to handle
    let errorMsg;
    if (isWayland) {
      if (isGnome) {
        if (!xwaylandAvailable) {
          errorMsg =
            "Clipboard copied, but GNOME Wayland blocks automatic pasting. Please paste manually with Ctrl+V.";
        } else if (!xdotoolExists) {
          errorMsg =
            "Clipboard copied, but automatic pasting on GNOME Wayland requires xdotool for XWayland apps. Please install xdotool or paste manually with Ctrl+V.";
        } else if (!xdotoolWindowClass) {
          errorMsg =
            "Clipboard copied, but the active app isn't running under XWayland. Please paste manually with Ctrl+V.";
        } else {
          errorMsg =
            "Clipboard copied, but paste simulation failed via XWayland. Please paste manually with Ctrl+V.";
        }
      } else if (!wtypeExists) {
        if (!xwaylandAvailable) {
          errorMsg =
            "Clipboard copied, but automatic pasting on Wayland requires wtype. Please install wtype or paste manually with Ctrl+V.";
        } else if (!xdotoolExists) {
          errorMsg =
            "Clipboard copied, but automatic pasting on Wayland requires wtype (Wayland apps) or xdotool (XWayland apps). Please install one or paste manually with Ctrl+V.";
        } else if (!xdotoolWindowClass) {
          errorMsg =
            "Clipboard copied, but the active app isn't running under XWayland. Please install wtype for Wayland apps or paste manually with Ctrl+V.";
        } else {
          errorMsg =
            "Clipboard copied, but paste simulation failed via XWayland. Please paste manually with Ctrl+V.";
        }
      } else {
        const xwaylandNote =
          xwaylandAvailable && xdotoolExists
            ? " If this is an XWayland app, xdotool can also be used."
            : "";
        errorMsg =
          "Clipboard copied, but paste simulation failed on Wayland. Ensure your compositor supports the virtual keyboard protocol or paste manually with Ctrl+V." +
          xwaylandNote;
      }
    } else {
      errorMsg =
        "Clipboard copied, but paste simulation failed on X11. Please install xdotool or paste manually with Ctrl+V.";
    }
    const err = new Error(errorMsg);
    err.code = "PASTE_SIMULATION_FAILED";
    throw err;
  }

  async checkAccessibilityPermissions() {
    if (process.platform !== "darwin") return true;

    const now = Date.now();
    if (now < this.accessibilityCache.expiresAt && this.accessibilityCache.value !== null) {
      return this.accessibilityCache.value;
    }

    return new Promise((resolve) => {
      // Check accessibility permissions

      const testProcess = spawn("osascript", [
        "-e",
        'tell application "System Events" to get name of first process',
      ]);

      let testOutput = "";
      let testError = "";

      testProcess.stdout.on("data", (data) => {
        testOutput += data.toString();
      });

      testProcess.stderr.on("data", (data) => {
        testError += data.toString();
      });

      testProcess.on("close", (code) => {
        const allowed = code === 0;
        this.accessibilityCache = {
          value: allowed,
          expiresAt: Date.now() + CACHE_TTL_MS,
        };
        if (!allowed) {
          this.showAccessibilityDialog(testError);
        }
        resolve(allowed);
      });

      testProcess.on("error", (error) => {
        this.accessibilityCache = {
          value: false,
          expiresAt: Date.now() + CACHE_TTL_MS,
        };
        resolve(false);
      });
    });
  }

  showAccessibilityDialog(testError) {
    const isStuckPermission =
      testError.includes("not allowed assistive access") ||
      testError.includes("(-1719)") ||
      testError.includes("(-25006)");

    let dialogMessage;
    if (isStuckPermission) {
      dialogMessage = `🔒 OpenWhispr needs Accessibility permissions, but it looks like you may have OLD PERMISSIONS from a previous version.

❗ COMMON ISSUE: If you've rebuilt/reinstalled OpenWhispr, the old permissions may be "stuck" and preventing new ones.

🔧 To fix this:
1. Open System Settings → Privacy & Security → Accessibility
2. Look for ANY old "OpenWhispr" entries and REMOVE them (click the - button)
3. Also remove any entries that say "Electron" or have unclear names
4. Click the + button and manually add the NEW OpenWhispr app
5. Make sure the checkbox is enabled
6. Restart OpenWhispr

⚠️ This is especially common during development when rebuilding the app.

📝 Without this permission, text will only copy to clipboard (no automatic pasting).

Would you like to open System Settings now?`;
    } else {
      dialogMessage = `🔒 OpenWhispr needs Accessibility permissions to paste text into other applications.

📋 Current status: Clipboard copy works, but pasting (Cmd+V simulation) fails.

🔧 To fix this:
1. Open System Settings (or System Preferences on older macOS)
2. Go to Privacy & Security → Accessibility
3. Click the lock icon and enter your password
4. Add OpenWhispr to the list and check the box
5. Restart OpenWhispr

⚠️ Without this permission, dictated text will only be copied to clipboard but won't paste automatically.

💡 In production builds, this permission is required for full functionality.

Would you like to open System Settings now?`;
    }

    const permissionDialog = spawn("osascript", [
      "-e",
      `display dialog "${dialogMessage}" buttons {"Cancel", "Open System Settings"} default button "Open System Settings"`,
    ]);

    permissionDialog.on("close", (dialogCode) => {
      if (dialogCode === 0) {
        this.openSystemSettings();
      }
    });

    permissionDialog.on("error", (error) => {
      // Permission dialog error - user will need to manually grant permissions
    });
  }

  openSystemSettings() {
    const settingsCommands = [
      ["open", ["x-apple.systempreferences:com.apple.preference.security?Privacy_Accessibility"]],
      ["open", ["-b", "com.apple.systempreferences"]],
      ["open", ["/System/Library/PreferencePanes/Security.prefPane"]],
    ];

    let commandIndex = 0;
    const tryNextCommand = () => {
      if (commandIndex < settingsCommands.length) {
        const [cmd, args] = settingsCommands[commandIndex];
        const settingsProcess = spawn(cmd, args);

        settingsProcess.on("error", (error) => {
          commandIndex++;
          tryNextCommand();
        });

        settingsProcess.on("close", (settingsCode) => {
          if (settingsCode !== 0) {
            commandIndex++;
            tryNextCommand();
          }
        });
      } else {
        // All settings commands failed, try fallback
        spawn("open", ["-a", "System Preferences"]).on("error", () => {
          spawn("open", ["-a", "System Settings"]).on("error", () => {
            // Could not open settings app
          });
        });
      }
    };

    tryNextCommand();
  }

  async readClipboard() {
    try {
      const text = clipboard.readText();
      return text;
    } catch (error) {
      throw error;
    }
  }

  async writeClipboard(text) {
    try {
      clipboard.writeText(text);
      return { success: true };
    } catch (error) {
      throw error;
    }
  }

  /**
   * Check availability of paste tools on the current platform.
   * Returns platform-specific information about paste capability.
   */
  checkPasteTools() {
    const platform = process.platform;

    // macOS uses AppleScript - always available, but needs accessibility permission
    if (platform === "darwin") {
      return {
        platform: "darwin",
        available: true,
        method: "applescript",
        requiresPermission: true,
        tools: [],
      };
    }

    // Windows uses PowerShell SendKeys - always available
    if (platform === "win32") {
      return {
        platform: "win32",
        available: true,
        method: "powershell",
        requiresPermission: false,
        tools: [],
      };
    }

    // Linux - check for available paste tools
    const { isWayland, xwaylandAvailable, isGnome } = getLinuxSessionInfo();

    // Check which tools are available
    const tools = [];
    const canUseWtype = isWayland && !isGnome;
    const canUseXdotool = !isWayland || xwaylandAvailable;

    if (canUseWtype && this.commandExists("wtype")) {
      tools.push("wtype");
    }
    if (canUseXdotool && this.commandExists("xdotool")) {
      tools.push("xdotool");
    }

    const available = tools.length > 0;
    let recommendedInstall;
    if (!available) {
      if (!isWayland) {
        recommendedInstall = "xdotool";
      } else if (isGnome) {
        recommendedInstall = xwaylandAvailable ? "xdotool" : undefined;
      } else {
        recommendedInstall = "wtype";
      }
    }

    return {
      platform: "linux",
      available,
      method: available ? tools[0] : null,
      requiresPermission: false,
      isWayland,
      xwaylandAvailable,
      tools,
      recommendedInstall,
    };
  }
}

module.exports = ClipboardManager;
