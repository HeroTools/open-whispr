const https = require("https");
const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");

const REQUEST_TIMEOUT = 30000;
const MAX_RETRIES = 3;
const RETRY_DELAY = 2000;
const MAX_REDIRECTS = 5;

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function downloadFile(url, dest, retryCount = 0) {
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(dest);
    let activeRequest = null;

    const cleanup = () => {
      if (activeRequest) {
        activeRequest.destroy();
        activeRequest = null;
      }
      file.close();
    };

    const request = (currentUrl, redirectCount = 0) => {
      if (redirectCount > MAX_REDIRECTS) {
        cleanup();
        reject(new Error("Too many redirects"));
        return;
      }

      activeRequest = https.get(currentUrl, (response) => {
        if (response.statusCode === 302 || response.statusCode === 301) {
          const redirectUrl = response.headers.location;
          if (!redirectUrl) {
            cleanup();
            reject(new Error("Redirect without location header"));
            return;
          }
          request(redirectUrl, redirectCount + 1);
          return;
        }

        if (response.statusCode !== 200) {
          cleanup();
          reject(new Error(`HTTP ${response.statusCode}`));
          return;
        }

        const total = parseInt(response.headers["content-length"], 10);
        let downloaded = 0;

        response.on("data", (chunk) => {
          downloaded += chunk.length;
          const pct = total ? Math.round((downloaded / total) * 100) : 0;
          process.stdout.write(`\r  Downloading: ${pct}%`);
        });

        response.on("error", (err) => {
          cleanup();
          reject(err);
        });

        response.pipe(file);
        file.on("finish", () => {
          file.close();
          console.log(" Done");
          resolve();
        });

        file.on("error", (err) => {
          cleanup();
          reject(err);
        });
      });

      activeRequest.on("error", (err) => {
        cleanup();
        reject(err);
      });

      activeRequest.setTimeout(REQUEST_TIMEOUT, () => {
        cleanup();
        reject(new Error("Connection timed out"));
      });
    };

    request(url);
  }).catch(async (error) => {
    const isTransient = error.message.includes("timed out") ||
      error.code === "ECONNRESET" ||
      error.code === "ETIMEDOUT";

    if (isTransient && retryCount < MAX_RETRIES) {
      console.log(`\n  Retry ${retryCount + 1}/${MAX_RETRIES}: ${error.message}`);
      await sleep(RETRY_DELAY);
      if (fs.existsSync(dest)) {
        fs.unlinkSync(dest);
      }
      return downloadFile(url, dest, retryCount + 1);
    }
    throw error;
  });
}

function extractZip(zipPath, destDir) {
  if (process.platform === "win32") {
    execSync(
      `powershell -command "Expand-Archive -Path '${zipPath}' -DestinationPath '${destDir}' -Force"`,
      { stdio: "inherit" }
    );
  } else {
    execSync(`unzip -o "${zipPath}" -d "${destDir}"`, { stdio: "inherit" });
  }
}

function findBinaryInDir(dir, binaryName, maxDepth = 5, currentDepth = 0) {
  if (currentDepth >= maxDepth) return null;

  const entries = fs.readdirSync(dir, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);

    if (entry.isDirectory()) {
      const found = findBinaryInDir(fullPath, binaryName, maxDepth, currentDepth + 1);
      if (found) return found;
    } else if (entry.name === binaryName) {
      return fullPath;
    }
  }

  return null;
}

function parseArgs() {
  const args = process.argv;
  let targetPlatform = process.platform;
  let targetArch = process.arch;

  const platformIndex = args.indexOf("--platform");
  if (platformIndex !== -1 && args[platformIndex + 1]) {
    targetPlatform = args[platformIndex + 1];
  }

  const archIndex = args.indexOf("--arch");
  if (archIndex !== -1 && args[archIndex + 1]) {
    targetArch = args[archIndex + 1];
  }

  return {
    targetPlatform,
    targetArch,
    platformArch: `${targetPlatform}-${targetArch}`,
    isCurrent: args.includes("--current"),
    isAll: args.includes("--all"),
    shouldCleanup: args.includes("--clean") ||
      process.env.CI === "true" ||
      process.env.GITHUB_ACTIONS === "true",
  };
}

function setExecutable(filePath) {
  if (process.platform !== "win32") {
    fs.chmodSync(filePath, 0o755);
  }
}

function cleanupFiles(binDir, prefix, keepPrefix) {
  const files = fs.readdirSync(binDir).filter((f) => f.startsWith(prefix));
  files.forEach((file) => {
    if (!file.startsWith(keepPrefix)) {
      const filePath = path.join(binDir, file);
      console.log(`Removing old binary: ${file}`);
      fs.unlinkSync(filePath);
    }
  });
}

module.exports = {
  downloadFile,
  extractZip,
  findBinaryInDir,
  parseArgs,
  setExecutable,
  cleanupFiles,
  sleep,
  REQUEST_TIMEOUT,
  MAX_RETRIES,
  RETRY_DELAY,
};
