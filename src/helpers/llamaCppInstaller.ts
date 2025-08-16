import { spawn } from "child_process";
import { app } from "electron";
import path from "path";
import fs from "fs";
import { promises as fsPromises } from "fs";
import https from "https";
import { createWriteStream } from "fs";
import tar from "tar";
import os from "os";

// Only import unzipper in main process
let unzipper: any;
if (typeof window === 'undefined') {
  unzipper = require("unzipper");
}

class LlamaCppInstaller {
  private installDir: string;
  private binPath: string | null = null;
  private platform: string;
  private arch: string;

  constructor() {
    this.installDir = path.join(app.getPath("userData"), "llama-cpp");
    this.platform = process.platform;
    this.arch = process.arch;
  }

  async ensureInstallDir(): Promise<void> {
    await fsPromises.mkdir(this.installDir, { recursive: true });
  }

  getBinaryName(): string {
    return this.platform === "win32" ? "llama-cli.exe" : "llama-cli";
  }

  getInstalledBinaryPath(): string {
    return path.join(this.installDir, this.getBinaryName());
  }

  async isInstalled(): Promise<boolean> {
    try {
      const binaryPath = this.getInstalledBinaryPath();
      await fsPromises.access(binaryPath, fs.constants.X_OK);
      this.binPath = binaryPath;
      return true;
    } catch {
      return false;
    }
  }

  async checkSystemInstallation(): Promise<boolean> {
    return new Promise((resolve) => {
      const checkCommand = this.platform === "win32" ? "where" : "which";
      spawn(checkCommand, ["llama-cli"])
        .on("close", (code) => {
          resolve(code === 0);
        })
        .on("error", () => {
          resolve(false);
        });
    });
  }

  async getVersion(): Promise<string | null> {
    if (!await this.isInstalled()) {
      return null;
    }

    return new Promise((resolve) => {
      const proc = spawn(this.binPath!, ["--version"]);
      let output = "";
      
      proc.stdout.on("data", (data) => {
        output += data.toString();
      });

      proc.on("close", () => {
        const match = output.match(/version:\s*([^\s]+)/i);
        resolve(match ? match[1] : "unknown");
      });

      proc.on("error", () => {
        resolve(null);
      });
    });
  }

  getDownloadUrl(): string {
    const baseUrl = "https://github.com/ggerganov/llama.cpp/releases/latest/download";
    
    if (this.platform === "darwin") {
      return `${baseUrl}/llama-${this.arch === "arm64" ? "arm64" : "x64"}-apple-darwin.zip`;
    } else if (this.platform === "linux") {
      return `${baseUrl}/llama-x64-linux.tar.gz`;
    } else if (this.platform === "win32") {
      return `${baseUrl}/llama-x64-windows.zip`;
    }
    
    throw new Error(`Unsupported platform: ${this.platform}`);
  }

  async download(url: string, destPath: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const file = createWriteStream(destPath);
      
      https.get(url, (response) => {
        if (response.statusCode === 302 || response.statusCode === 301) {
          const redirectUrl = response.headers.location;
          if (redirectUrl) {
            this.download(redirectUrl, destPath).then(resolve).catch(reject);
            return;
          }
        }

        if (response.statusCode !== 200) {
          reject(new Error(`Download failed with status: ${response.statusCode}`));
          return;
        }

        response.pipe(file);
        
        file.on("finish", () => {
          file.close();
          resolve();
        });

        file.on("error", (err) => {
          fs.unlink(destPath, () => {});
          reject(err);
        });
      }).on("error", reject);
    });
  }

  async extract(archivePath: string): Promise<void> {
    await this.ensureInstallDir();
    
    if (archivePath.endsWith(".tar.gz")) {
      await tar.x({
        file: archivePath,
        cwd: this.installDir,
      });
    } else if (archivePath.endsWith(".zip")) {
      await fs.createReadStream(archivePath)
        .pipe(unzipper.Extract({ path: this.installDir }))
        .promise();
    } else {
      throw new Error("Unsupported archive format");
    }
  }

  async install(): Promise<{ success: boolean; error?: string }> {
    try {
      // Check if already installed
      if (await this.isInstalled()) {
        return { success: true };
      }

      // Create install directory
      await this.ensureInstallDir();

      // Download
      const url = this.getDownloadUrl();
      const archivePath = path.join(
        this.installDir,
        url.endsWith(".zip") ? "llama.zip" : "llama.tar.gz"
      );

      console.log(`Downloading llama.cpp from ${url}...`);
      await this.download(url, archivePath);

      // Extract
      console.log("Extracting archive...");
      await this.extract(archivePath);

      // Clean up archive
      await fsPromises.unlink(archivePath);

      // Make binary executable on Unix
      if (this.platform !== "win32") {
        const binaryPath = this.getInstalledBinaryPath();
        await fsPromises.chmod(binaryPath, 0o755);
      }

      // Verify installation
      if (await this.isInstalled()) {
        return { success: true };
      } else {
        throw new Error("Installation verification failed");
      }
    } catch (error: any) {
      console.error("llama.cpp installation error:", error);
      return { 
        success: false, 
        error: error.message || "Installation failed" 
      };
    }
  }

  async uninstall(): Promise<{ success: boolean; error?: string }> {
    try {
      await fsPromises.rm(this.installDir, { recursive: true, force: true });
      this.binPath = null;
      return { success: true };
    } catch (error: any) {
      return { 
        success: false, 
        error: error.message || "Uninstall failed" 
      };
    }
  }
}

export default new LlamaCppInstaller();