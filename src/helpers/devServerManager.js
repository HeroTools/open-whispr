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
      const path = require("path");
      const htmlPath = path.join(__dirname, "..", "..", "src", "dist", "index.html");
      const url = isControlPanel ? `file://${htmlPath}?panel=true` : `file://${htmlPath}`;
      return url;
    }
  }
}

module.exports = DevServerManager;
