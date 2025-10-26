const fs = require("fs");
const path = require("path");
const https = require("https");
const os = require("os");
const { runCommand, TIMEOUTS } = require("../utils/process");

class PythonInstaller {
  constructor() {
    this.pythonVersion = "3.11.9"; // Latest stable version compatible with Whisper
  }

  // Removed - now using shared runCommand from utils/process.js

  async downloadFile(url, outputPath, progressCallback = null) {
    return new Promise((resolve, reject) => {
      const file = fs.createWriteStream(outputPath);

      https
        .get(url, (response) => {
          if (response.statusCode !== 200) {
            reject(new Error(`Failed to download: HTTP ${response.statusCode}`));
            return;
          }

          const totalSize = parseInt(response.headers["content-length"], 10);
          let downloadedSize = 0;

          response.on("data", (chunk) => {
            downloadedSize += chunk.length;
            if (progressCallback && totalSize) {
              progressCallback({
                downloaded: downloadedSize,
                total: totalSize,
                percentage: Math.round((downloadedSize / totalSize) * 100),
              });
            }
          });

          response.pipe(file);

          file.on("finish", () => {
            file.close();
            resolve();
          });

          file.on("error", (error) => {
            fs.unlink(outputPath, () => {}); // Clean up on error
            reject(error);
          });
        })
        .on("error", (error) => {
          reject(error);
        });
    });
  }

  async installPythonMacOS(progressCallback = null) {
    const platform = process.arch === "arm64" ? "macos11" : "macosx10.9";
    const installerUrl = `https://www.python.org/ftp/python/${this.pythonVersion}/python-${this.pythonVersion}-${platform}.pkg`;

    const tempDir = os.tmpdir();
    const installerPath = path.join(tempDir, `python-${this.pythonVersion}.pkg`);

    try {
      // Check if Homebrew is available first (preferred method)
      try {
        await runCommand("brew", ["--version"], { timeout: TIMEOUTS.QUICK_CHECK });
        console.log("Installing Python via Homebrew...");

        if (progressCallback) {
          progressCallback({ stage: "Installing Python via Homebrew...", percentage: 25 });
        }

        await runCommand("brew", ["install", "python@3.11"], { timeout: TIMEOUTS.INSTALL });

        if (progressCallback) {
          progressCallback({ stage: "Python installation complete!", percentage: 100 });
        }

        return { success: true, method: "homebrew" };
      } catch (brewError) {
        console.log("Homebrew not available, using official installer...");

        if (progressCallback) {
          progressCallback({ stage: "Downloading Python installer...", percentage: 10 });
        }

        // Download official Python installer
        await this.downloadFile(installerUrl, installerPath, (progress) => {
          if (progressCallback) {
            progressCallback({
              stage: `Downloading Python installer... ${progress.percentage}%`,
              percentage: 10 + progress.percentage * 0.4, // 10-50%
            });
          }
        });

        if (progressCallback) {
          progressCallback({ stage: "Installing Python...", percentage: 60 });
        }

        // Install Python silently
        await runCommand("sudo", ["installer", "-pkg", installerPath, "-target", "/"], {
          timeout: TIMEOUTS.INSTALL,
        });

        // Clean up
        fs.unlink(installerPath, () => {});

        if (progressCallback) {
          progressCallback({ stage: "Python installation complete!", percentage: 100 });
        }

        return { success: true, method: "official_installer" };
      }
    } catch (error) {
      // Clean up on error
      if (fs.existsSync(installerPath)) {
        fs.unlink(installerPath, () => {});
      }
      throw error;
    }
  }

  async checkWindowsAdmin() {
    try {
      // Try to read a protected registry key to check admin rights
      await runCommand("reg", ["query", "HKU\\S-1-5-19"], { timeout: TIMEOUTS.QUICK_CHECK });
      return true;
    } catch (error) {
      return false;
    }
  }

  async installPythonWindows(progressCallback = null) {
    const arch = process.arch === "ia32" ? "" : "-amd64";
    const installerUrl = `https://www.python.org/ftp/python/${this.pythonVersion}/python-${this.pythonVersion}${arch}.exe`;

    const tempDir = os.tmpdir();
    const installerPath = path.join(tempDir, `python-${this.pythonVersion}.exe`);

    try {
      // Check for admin rights
      const isAdmin = await this.checkWindowsAdmin();

      if (progressCallback) {
        progressCallback({ stage: "Downloading Python installer...", percentage: 10 });
      }

      // Download Python installer
      await this.downloadFile(installerUrl, installerPath, (progress) => {
        if (progressCallback) {
          progressCallback({
            stage: `Downloading Python installer... ${progress.percentage}%`,
            percentage: 10 + progress.percentage * 0.4, // 10-50%
          });
        }
      });

      if (progressCallback) {
        progressCallback({ stage: "Installing Python...", percentage: 60 });
      }

      // Install Python with appropriate options based on admin rights
      const installArgs = isAdmin
        ? [
            "/quiet",
            "InstallAllUsers=1",
            "PrependPath=1",
            "Include_test=0",
            "Include_doc=0",
            "Include_dev=0",
            "Include_debug=0",
            "Include_launcher=1",
            "InstallLauncherAllUsers=1",
          ]
        : [
            "/quiet",
            "InstallAllUsers=0",
            "PrependPath=1",
            "Include_test=0",
            "Include_doc=0",
            "Include_dev=0",
            "Include_debug=0",
            "Include_launcher=1",
            "InstallLauncherAllUsers=0",
            "DefaultJustForMeTargetDir=%LOCALAPPDATA%\\Programs\\Python\\Python311",
          ];

      await runCommand(installerPath, installArgs, { timeout: TIMEOUTS.INSTALL });

      // Clean up
      fs.unlink(installerPath, () => {});

      if (progressCallback) {
        progressCallback({ stage: "Python installation complete!", percentage: 100 });
      }

      return { success: true, method: "official_installer" };
    } catch (error) {
      // Clean up on error
      if (fs.existsSync(installerPath)) {
        fs.unlink(installerPath, () => {});
      }
      throw error;
    }
  }

  async installPythonLinux(progressCallback = null) {
    const platform = process.platform;

    try {
      if (progressCallback) {
        progressCallback({ stage: "Detecting Linux distribution...", percentage: 10 });
      }

      // Detect package manager and install Python
      try {
        // Try apt (Debian/Ubuntu)
        await runCommand("apt", ["--version"], { timeout: TIMEOUTS.QUICK_CHECK });

        if (progressCallback) {
          progressCallback({ stage: "Installing Python via apt...", percentage: 30 });
        }

        await runCommand("sudo", ["apt", "update"], { timeout: TIMEOUTS.PIP_UPGRADE });
        await runCommand(
          "sudo",
          ["apt", "install", "-y", "python3.11", "python3.11-pip", "python3.11-dev"],
          { timeout: TIMEOUTS.INSTALL }
        );

        if (progressCallback) {
          progressCallback({ stage: "Python installation complete!", percentage: 100 });
        }

        return { success: true, method: "apt" };
      } catch (aptError) {
        try {
          // Try yum (RHEL/CentOS/Fedora)
          await runCommand("yum", ["--version"], { timeout: TIMEOUTS.QUICK_CHECK });

          if (progressCallback) {
            progressCallback({ stage: "Installing Python via yum...", percentage: 30 });
          }

          await runCommand(
            "sudo",
            ["yum", "install", "-y", "python311", "python311-pip", "python311-devel"],
            { timeout: TIMEOUTS.INSTALL }
          );

          if (progressCallback) {
            progressCallback({ stage: "Python installation complete!", percentage: 100 });
          }

          return { success: true, method: "yum" };
        } catch (yumError) {
          try {
            // Try pacman (Arch Linux)
            await runCommand("pacman", ["--version"], { timeout: TIMEOUTS.QUICK_CHECK });

            if (progressCallback) {
              progressCallback({ stage: "Installing Python via pacman...", percentage: 30 });
            }

            await runCommand("sudo", ["pacman", "-S", "--noconfirm", "python", "python-pip"], {
              timeout: TIMEOUTS.INSTALL,
            });

            if (progressCallback) {
              progressCallback({ stage: "Python installation complete!", percentage: 100 });
            }

            return { success: true, method: "pacman" };
          } catch (pacmanError) {
            throw new Error("No supported package manager found (apt, yum, or pacman)");
          }
        }
      }
    } catch (error) {
      throw error;
    }
  }

  async installPython(progressCallback = null) {
    const platform = process.platform;

    try {
      if (progressCallback) {
        progressCallback({ stage: "Starting Python installation...", percentage: 5 });
      }

      switch (platform) {
        case "darwin":
          return await this.installPythonMacOS(progressCallback);
        case "win32":
          return await this.installPythonWindows(progressCallback);
        case "linux":
          return await this.installPythonLinux(progressCallback);
        default:
          throw new Error(`Unsupported platform: ${platform}`);
      }
    } catch (error) {
      throw error;
    }
  }

  async isPythonInstalled() {
    const possibleCommands = ["python3.11", "python3", "python"];

    // On macOS, also check common Python installation paths
    const additionalPaths =
      process.platform === "darwin"
        ? [
            "/usr/local/bin/python3",
            "/usr/local/bin/python3.11",
            "/opt/homebrew/bin/python3",
            "/opt/homebrew/bin/python3.11",
            "/usr/bin/python3",
            "/Library/Frameworks/Python.framework/Versions/3.11/bin/python3",
            "/Library/Frameworks/Python.framework/Versions/3.10/bin/python3",
            "/Library/Frameworks/Python.framework/Versions/3.9/bin/python3",
          ]
        : [];

    // First check commands in PATH
    for (const cmd of possibleCommands) {
      try {
        const result = await runCommand(cmd, ["--version"], { timeout: TIMEOUTS.QUICK_CHECK });
        const versionMatch = result.output.match(/Python (\d+\.\d+)/);
        if (versionMatch) {
          const version = parseFloat(versionMatch[1]);
          // Accept any Python 3.x version
          if (version >= 3.0) {
            return { installed: true, command: cmd, version: version };
          }
        }
      } catch (error) {
        continue;
      }
    }

    // Then check absolute paths on macOS
    for (const fullPath of additionalPaths) {
      try {
        const fs = require("fs");
        if (fs.existsSync(fullPath)) {
          const result = await runCommand(fullPath, ["--version"], {
            timeout: TIMEOUTS.QUICK_CHECK,
          });
          const versionMatch = result.output.match(/Python (\d+\.\d+)/);
          if (versionMatch) {
            const version = parseFloat(versionMatch[1]);
            if (version >= 3.0) {
              return { installed: true, command: fullPath, version: version };
            }
          }
        }
      } catch (error) {
        continue;
      }
    }

    return { installed: false };
  }
}

module.exports = PythonInstaller;
