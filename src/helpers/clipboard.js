const { clipboard } = require("electron");
const { spawn, spawnSync } = require("child_process");

class ClipboardManager {
  constructor() {
    // Initialize clipboard manager
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

  async pasteText(text) {
    try {
      // Save original clipboard content first
      const originalClipboard = clipboard.readText();
      this.safeLog(
        "💾 Saved original clipboard content:",
        originalClipboard.substring(0, 50) + "..."
      );

      // Copy text to clipboard first - this always works
      clipboard.writeText(text);
      this.safeLog(
        "📋 Text copied to clipboard:",
        text.substring(0, 50) + "..."
      );

      if (process.platform === "darwin") {
        // Check accessibility permissions first
        this.safeLog(
          "🔍 Checking accessibility permissions for paste operation..."
        );
        const hasPermissions = await this.checkAccessibilityPermissions();

        if (!hasPermissions) {
          this.safeLog(
            "⚠️ No accessibility permissions - text copied to clipboard only"
          );
          const errorMsg =
            "Accessibility permissions required for automatic pasting. Text has been copied to clipboard - please paste manually with Cmd+V.";
          throw new Error(errorMsg);
        }

        this.safeLog("✅ Permissions granted, attempting to paste...");
        return await this.pasteMacOS(originalClipboard);
      } else if (process.platform === "win32") {
        return await this.pasteWindows(originalClipboard);
      } else {
        return await this.pasteLinux(originalClipboard);
      }
    } catch (error) {
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
          pasteProcess.kill("SIGKILL");
          pasteProcess.removeAllListeners();
          const errorMsg =
            "Paste operation timed out. Text is copied to clipboard - please paste manually with Cmd+V.";
          reject(new Error(errorMsg));
        }, 3000);
      }, 100);
    });
  }

  async pasteWindows(originalClipboard) {
    return new Promise((resolve, reject) => {
      const pasteProcess = spawn("powershell", [
        "-Command",
        'Add-Type -AssemblyName System.Windows.Forms; [System.Windows.Forms.SendKeys]::SendWait("^v")',
      ]);

      pasteProcess.on("close", (code) => {
        if (code === 0) {
          // Text pasted successfully
          setTimeout(() => {
            clipboard.writeText(originalClipboard);
          }, 100);
          resolve();
        } else {
          reject(
            new Error(
              `Windows paste failed with code ${code}. Text is copied to clipboard.`
            )
          );
        }
      });

      pasteProcess.on("error", (error) => {
        reject(
          new Error(
            `Windows paste failed: ${error.message}. Text is copied to clipboard.`
          )
        );
      });
    });
  }

  async pasteLinux(originalClipboard) {
    // Helper to check if a command exists
    const commandExists = (cmd) => {
      try {
        const res = spawnSync("sh", ["-c", `command -v ${cmd}`], {
          stdio: "ignore",
        });
        return res.status === 0;
      } catch {
        return false;
      }
    };

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

      try {
        // Try xdotool (works on X11 and XWayland)
        if (commandExists("xdotool")) {
          const result = spawnSync("xdotool", [
            "getactivewindow",
            "getwindowclassname",
          ]);
          if (result.status === 0) {
            const className = result.stdout.toString().toLowerCase().trim();
            const isTerminalWindow = terminalClasses.some((term) =>
              className.includes(term)
            );
            if (isTerminalWindow) {
              this.safeLog(`🖥️ Terminal detected via xdotool: ${className}`);
            }
            return isTerminalWindow;
          }
        }

        // Try kdotool for KDE Wayland (if available)
        if (commandExists("kdotool")) {
          // First get the active window ID
          const windowIdResult = spawnSync("kdotool", ["getactivewindow"]);
          if (windowIdResult.status === 0) {
            const windowId = windowIdResult.stdout.toString().trim();
            // Then get the window class name
            const classResult = spawnSync("kdotool", ["getwindowclassname", windowId]);
            if (classResult.status === 0) {
              const className = classResult.stdout.toString().toLowerCase().trim();
              const isTerminalWindow = terminalClasses.some((term) =>
                className.includes(term)
              );
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

    // Detect if running on Wayland or X11
    const isWayland =
      (process.env.XDG_SESSION_TYPE || "").toLowerCase() === "wayland" ||
      !!process.env.WAYLAND_DISPLAY;

    const inTerminal = isTerminal();
    const pasteKeys = inTerminal ? "ctrl+shift+v" : "ctrl+v";

    // Define paste tools in preference order based on display server
    const candidates = isWayland
      ? [
          // Wayland tools
          inTerminal
            ? {
                cmd: "wtype",
                args: ["-M", "ctrl", "-M", "shift", "-k", "v", "-m", "shift", "-m", "ctrl"],
              }
            : { cmd: "wtype", args: ["-M", "ctrl", "-k", "v", "-m", "ctrl"] },
          // ydotool requires uinput permissions but included as fallback
          inTerminal
            ? { cmd: "ydotool", args: ["key", "29:1", "42:1", "47:1", "47:0", "42:0", "29:0"] }
            : { cmd: "ydotool", args: ["key", "29:1", "47:1", "47:0", "29:0"] },
          // X11 fallback for XWayland
          { cmd: "xdotool", args: ["key", pasteKeys] },
        ]
      : [
          // X11 tools
          { cmd: "xdotool", args: ["key", pasteKeys] },
        ];

    // Filter to only available tools
    const available = candidates.filter((c) => commandExists(c.cmd));

    // Attempt paste with a specific tool
    const pasteWith = (tool) =>
      new Promise((resolve, reject) => {
        const proc = spawn(tool.cmd, tool.args);

        let timedOut = false;
        const timeoutId = setTimeout(() => {
          timedOut = true;
          try {
            proc.kill("SIGKILL");
          } catch {
            // Ignore kill errors
          }
        }, 1000);

        proc.on("close", (code) => {
          if (timedOut)
            return reject(
              new Error(`Paste with ${tool.cmd} timed out after 1 second`)
            );
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
        this.safeLog(
          `⚠️ Paste with ${tool.cmd} failed:`,
          error?.message || error
        );
        // Continue to next tool
      }
    }

    // All tools failed - create specific error for renderer to handle
    const sessionInfo = isWayland ? "Wayland" : "X11";
    const errorMsg = `Clipboard copied, but paste simulation failed on ${sessionInfo}. Please install ${isWayland ? "wtype or ydotool" : "xdotool"} for automatic pasting, or paste manually with Ctrl+V.`;
    const err = new Error(errorMsg);
    err.code = "PASTE_SIMULATION_FAILED";
    throw err;
  }

  async checkAccessibilityPermissions() {
    if (process.platform !== "darwin") return true;

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
        if (code === 0) {
          resolve(true);
        } else {
          this.showAccessibilityDialog(testError);
          resolve(false);
        }
      });

      testProcess.on("error", (error) => {
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
      [
        "open",
        [
          "x-apple.systempreferences:com.apple.preference.security?Privacy_Accessibility",
        ],
      ],
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
}

module.exports = ClipboardManager;
