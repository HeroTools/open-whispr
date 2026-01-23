class DevServerManager {
  static async waitForDevServer(url = "http://localhost:5174/", maxAttempts = 30, delay = 1000) {
    for (let i = 0; i < maxAttempts; i++) {
      try {
        const http = require("http");
        const urlObj = new URL(url);

        const result = await new Promise((resolve) => {
          const req = http.get(
            {
              hostname: urlObj.hostname,
              port: urlObj.port || 80,
              path: urlObj.pathname,
              timeout: 2000,
            },
            (res) => {
              resolve(res.statusCode >= 200 && res.statusCode < 400);
            }
          );

          req.on("error", () => resolve(false));
          req.on("timeout", () => {
            req.destroy();
            resolve(false);
          });
        });

        if (result) {
          console.log(`Dev server ready after ${i + 1} attempts`);
          return true;
        }
      } catch (error) {
        console.log(`Waiting for dev server... attempt ${i + 1}/${maxAttempts}`);
      }
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
    console.error("Dev server failed to start within timeout");
    return false;
  }

  static getAppUrl(isControlPanel = false) {
    if (process.env.NODE_ENV === "development") {
      return isControlPanel ? "http://localhost:5174/?panel=true" : "http://localhost:5174/";
    } else {
      // For production, return null - caller should use loadFile() instead
      return null;
    }
  }

  /**
   * Get the path to the index.html file for production builds.
   * In Electron 36+, loadFile() is preferred over loadURL() with file:// protocol.
   * @param {boolean} isControlPanel - Whether this is for the control panel
   * @returns {{ path: string, query: object } | null} - Path info for loadFile() or null for dev
   */
  static getAppFilePath(isControlPanel = false) {
    const isDev = process.env.NODE_ENV === "development";
    console.log("[DevServerManager] getAppFilePath called:", {
      isControlPanel,
      NODE_ENV: process.env.NODE_ENV,
      isDev,
    });

    if (isDev) {
      console.log("[DevServerManager] Development mode - returning null for dev server");
      return null; // Use getAppUrl() for dev server
    }

    const path = require("path");
    const { app } = require("electron");
    const fs = require("fs");

    // In packaged app, files are relative to app.getAppPath()
    // which points to the app.asar or app directory
    const appPath = app.getAppPath();
    const htmlPath = path.join(appPath, "src", "dist", "index.html");

    console.log("[DevServerManager] Production mode paths:", {
      appPath,
      htmlPath,
      htmlExists: fs.existsSync(htmlPath),
      resourcesPath: process.resourcesPath,
    });

    // Log additional diagnostic info
    try {
      const distDir = path.join(appPath, "src", "dist");
      if (fs.existsSync(distDir)) {
        console.log("[DevServerManager] dist directory contents:", fs.readdirSync(distDir).slice(0, 10));
      } else {
        console.error("[DevServerManager] dist directory does not exist:", distDir);
        // Try alternative paths
        const altPaths = [
          path.join(appPath, "dist", "index.html"),
          path.join(process.resourcesPath || "", "app", "src", "dist", "index.html"),
          path.join(process.resourcesPath || "", "src", "dist", "index.html"),
        ];
        console.log("[DevServerManager] Checking alternative paths:");
        for (const altPath of altPaths) {
          console.log(`  ${altPath}: ${fs.existsSync(altPath)}`);
        }
      }
    } catch (err) {
      console.error("[DevServerManager] Error checking paths:", err.message);
    }

    return {
      path: htmlPath,
      query: isControlPanel ? { panel: "true" } : {},
    };
  }
}

module.exports = DevServerManager;
