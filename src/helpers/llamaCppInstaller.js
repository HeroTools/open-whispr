const { spawn } = require("child_process");
const { app } = require("electron");
const path = require("path");
const fs = require("fs");
const { promises: fsPromises } = require("fs");
const https = require("https");
const { createWriteStream } = require("fs");
const tar = require("tar");
const os = require("os");

// Only import unzipper in main process
let unzipper;
if (typeof window === 'undefined') {
  unzipper = require("unzipper");
}

class LlamaCppInstaller {
  constructor() {
    this.installDir = path.join(app.getPath("userData"), "llama-cpp");
    this.binPath = null;
    this.platform = process.platform;
    this.arch = process.arch;
  }

  async ensureInstallDir() {
    await fsPromises.mkdir(this.installDir, { recursive: true });
  }

  getBinaryName() {
    // Cross-platform binary name resolution
    switch (this.platform) {
      case "win32":
        return "llama-cli.exe";
      case "darwin":
      case "linux":
      default:
        return "llama-cli";
    }
  }

  getInstalledBinaryPath() {
    return path.join(this.installDir, this.getBinaryName());
  }

  async isInstalled() {
    try {
      // First check for system installation
      const systemInstalled = await this.checkSystemInstallation();
      if (systemInstalled) {
        // Get the system path
        const systemPath = await this.getSystemBinaryPath();
        if (systemPath) {
          this.binPath = systemPath;
          return true;
        }
      }
      
      // Then check for local installation
      const binaryPath = this.getInstalledBinaryPath();
      await fsPromises.access(binaryPath, fs.constants.X_OK);
      this.binPath = binaryPath;
      return true;
    } catch {
      return false;
    }
  }

  async getSystemBinaryPath() {
    return new Promise((resolve) => {
      // Cross-platform command resolution
      const checkCmd = this.platform === "win32" ? "where" : "which";
      const binaryNames = this.platform === "win32" 
        ? ["llama-cli.exe", "llama.exe"]
        : ["llama-cli", "llama", "llama.cpp"];
      
      // Try each possible binary name
      let found = false;
      let remaining = binaryNames.length;
      
      for (const name of binaryNames) {
        const proc = spawn(checkCmd, [name], {
          shell: true,
          stdio: "pipe",
        });

        let output = "";
        proc.stdout.on("data", (data) => {
          output += data.toString();
        });

        proc.on("close", (code) => {
          if (!found && code === 0 && output) {
            found = true;
            resolve(output.trim().split('\n')[0]);
          }
          remaining--;
          if (remaining === 0 && !found) {
            resolve(null);
          }
        });

        proc.on("error", () => {
          remaining--;
          if (remaining === 0 && !found) {
            resolve(null);
          }
        });
      }
    });
  }

  async checkSystemInstallation() {
    const systemPath = await this.getSystemBinaryPath();
    return systemPath !== null;
  }

  async getVersion() {
    try {
      const binaryPath = this.binPath || this.getInstalledBinaryPath();
      
      return new Promise((resolve, reject) => {
        const proc = spawn(binaryPath, ["--version"], {
          shell: false,
          stdio: "pipe",
        });

        let output = "";
        proc.stdout.on("data", (data) => {
          output += data.toString();
        });

        proc.on("close", (code) => {
          if (code === 0) {
            resolve(output.trim());
          } else {
            reject(new Error(`Failed to get version: exit code ${code}`));
          }
        });

        proc.on("error", (err) => {
          reject(err);
        });
      });
    } catch (error) {
      throw new Error(`Failed to get llama.cpp version: ${error.message}`);
    }
  }

  getReleaseUrl() {
    // Map platform and arch to GitHub release asset names
    const platformMap = {
      darwin: {
        x64: "llama-cli-macos-x64",
        arm64: "llama-cli-macos-arm64",
      },
      linux: {
        x64: "llama-cli-linux-x64",
        arm64: "llama-cli-linux-arm64",
      },
      win32: {
        x64: "llama-cli-windows-x64.exe",
        arm64: "llama-cli-windows-arm64.exe",
      },
    };

    const assetName = platformMap[this.platform]?.[this.arch];
    if (!assetName) {
      throw new Error(`Unsupported platform: ${this.platform}-${this.arch}`);
    }

    // Using a specific release for stability
    const releaseTag = "v0.1.0"; // Update this as needed
    return `https://github.com/yourusername/llama-cpp-binaries/releases/download/${releaseTag}/${assetName}`;
  }

  async downloadBinary(url, destPath) {
    return new Promise((resolve, reject) => {
      const file = createWriteStream(destPath);
      
      https.get(url, (response) => {
        if (response.statusCode === 302 || response.statusCode === 301) {
          // Handle redirect
          https.get(response.headers.location, (redirectResponse) => {
            redirectResponse.pipe(file);
            file.on("finish", () => {
              file.close();
              resolve();
            });
          }).on("error", reject);
        } else if (response.statusCode === 200) {
          response.pipe(file);
          file.on("finish", () => {
            file.close();
            resolve();
          });
        } else {
          reject(new Error(`Failed to download: HTTP ${response.statusCode}`));
        }
      }).on("error", reject);
    });
  }

  async install() {
    try {
      await this.ensureInstallDir();
      
      // For now, return a message about manual installation
      // since we don't have a real binary distribution yet
      return {
        success: false,
        message: "Please install llama.cpp manually using Homebrew (macOS) or from source. Run: brew install llama.cpp",
      };
      
      // Future implementation:
      // const url = this.getReleaseUrl();
      // const binaryPath = this.getInstalledBinaryPath();
      // 
      // await this.downloadBinary(url, binaryPath);
      // 
      // // Make executable on Unix-like systems
      // if (this.platform !== "win32") {
      //   await fsPromises.chmod(binaryPath, 0o755);
      // }
      // 
      // this.binPath = binaryPath;
      // return { success: true, path: binaryPath };
    } catch (error) {
      return {
        success: false,
        message: `Installation failed: ${error.message}`,
      };
    }
  }

  async uninstall() {
    try {
      const binaryPath = this.getInstalledBinaryPath();
      await fsPromises.unlink(binaryPath);
      this.binPath = null;
      return { success: true };
    } catch (error) {
      return {
        success: false,
        message: `Uninstall failed: ${error.message}`,
      };
    }
  }

  async getBinaryPath() {
    // If we already have a path, use it
    if (this.binPath) {
      return this.binPath;
    }
    
    // Check for system installation first
    const systemPath = await this.getSystemBinaryPath();
    if (systemPath) {
      this.binPath = systemPath;
      return systemPath;
    }
    
    // Fall back to local installation
    return this.getInstalledBinaryPath();
  }
}

module.exports = { default: new LlamaCppInstaller() };