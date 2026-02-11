const fs = require("fs");
const { promises: fsPromises } = require("fs");
const path = require("path");
const https = require("https");
const http = require("http");
const { pipeline } = require("stream");
const debugLogger = require("./debugLogger");

const USER_AGENT = "OpenWhispr/1.0";
const PROGRESS_THROTTLE_MS = 100;
const MAX_REDIRECTS = 5;
const DEFAULT_TIMEOUT = 60000;
const DEFAULT_MAX_RETRIES = 3;
const MAX_BACKOFF_MS = 30000;
const STALL_TIMEOUT_MS = 30000;
const STALE_TMP_AGE_MS = 24 * 60 * 60 * 1000; // 24 hours

const RETRYABLE_CODES = new Set([
  "ECONNRESET",
  "ETIMEDOUT",
  "EPIPE",
  "EAI_AGAIN",
  "ECONNREFUSED",
  "ENOTFOUND",
  "ERR_STREAM_PREMATURE_CLOSE",
  "ERR_DOWNLOAD_INCOMPLETE",
]);

function isRetryable(error) {
  if (error.isAbort || error.isHttpError) return false;
  return RETRYABLE_CODES.has(error.code);
}

function backoffDelay(attempt) {
  return Math.min(1000 * Math.pow(2, attempt), MAX_BACKOFF_MS);
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function resolveRedirects(url, timeout) {
  return new Promise((resolve, reject) => {
    let redirectCount = 0;

    const follow = (currentUrl) => {
      if (redirectCount > MAX_REDIRECTS) {
        reject(Object.assign(new Error("Too many redirects"), { isHttpError: true }));
        return;
      }

      const client = currentUrl.startsWith("https") ? https : http;
      const parsed = new URL(currentUrl);
      const req = client.request({
        method: "HEAD",
        hostname: parsed.hostname,
        port: parsed.port,
        path: parsed.pathname + parsed.search,
        timeout,
        headers: { "User-Agent": USER_AGENT },
      });

      req.on("response", (res) => {
        res.resume();
        if (
          res.statusCode === 301 ||
          res.statusCode === 302 ||
          res.statusCode === 303 ||
          res.statusCode === 307 ||
          res.statusCode === 308
        ) {
          const location = res.headers.location;
          if (!location) {
            reject(
              Object.assign(new Error("Redirect without location header"), { isHttpError: true })
            );
            return;
          }
          redirectCount++;
          follow(location);
          return;
        }
        resolve({ finalUrl: currentUrl, statusCode: res.statusCode });
      });

      req.on("error", reject);
      req.on("timeout", () => {
        req.destroy();
        reject(Object.assign(new Error("Timeout resolving redirects"), { code: "ETIMEDOUT" }));
      });

      req.end();
    };

    follow(url);
  });
}

function downloadAttempt(url, tempPath, { timeout, onProgress, signal, startOffset }) {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(Object.assign(new Error("Download cancelled"), { isAbort: true }));
      return;
    }

    const headers = { "User-Agent": USER_AGENT };
    if (startOffset > 0) {
      headers["Range"] = `bytes=${startOffset}-`;
    }

    const client = url.startsWith("https") ? https : http;
    let activeFile = fs.createWriteStream(tempPath, { flags: startOffset > 0 ? "a" : "w" });

    let downloadedSize = startOffset;
    let totalSize = 0;
    let lastProgressUpdate = 0;
    let request = null;
    let stallTimer = null;

    const cleanup = () => {
      if (stallTimer) {
        clearTimeout(stallTimer);
        stallTimer = null;
      }
      if (request) {
        request.destroy();
        request = null;
      }
      activeFile.destroy();
    };

    const onAbort = () => {
      cleanup();
      reject(Object.assign(new Error("Download cancelled"), { isAbort: true }));
    };

    if (signal) {
      signal.onAbort = onAbort;
    }

    request = client.get(url, { headers, timeout }, (response) => {
      if (signal?.aborted) {
        cleanup();
        reject(Object.assign(new Error("Download cancelled"), { isAbort: true }));
        return;
      }

      const statusCode = response.statusCode;

      if (statusCode === 200 && startOffset > 0) {
        // Server doesn't support Range — restart from beginning
        downloadedSize = 0;
        activeFile.destroy();
        activeFile = fs.createWriteStream(tempPath, { flags: "w" });
        totalSize = parseInt(response.headers["content-length"], 10) || 0;
      } else if (statusCode === 206) {
        const contentRange = response.headers["content-range"];
        if (contentRange) {
          const match = contentRange.match(/\/(\d+)$/);
          if (match) totalSize = parseInt(match[1], 10);
        }
        if (!totalSize) {
          const contentLength = parseInt(response.headers["content-length"], 10) || 0;
          totalSize = startOffset + contentLength;
        }
      } else if (statusCode === 200) {
        totalSize = parseInt(response.headers["content-length"], 10) || 0;
      } else {
        cleanup();
        const err = new Error(`HTTP ${statusCode}`);
        err.isHttpError = true;
        err.statusCode = statusCode;
        reject(err);
        return;
      }

      const resetStallTimer = () => {
        if (stallTimer) clearTimeout(stallTimer);
        stallTimer = setTimeout(() => {
          cleanup();
          reject(
            Object.assign(new Error("Download stalled — no data received for 30s"), {
              code: "ETIMEDOUT",
            })
          );
        }, STALL_TIMEOUT_MS);
      };

      resetStallTimer();

      response.on("data", (chunk) => {
        if (signal?.aborted) {
          cleanup();
          return;
        }
        downloadedSize += chunk.length;
        resetStallTimer();
        emitProgress();
      });

      pipeline(response, activeFile, (err) => {
        if (stallTimer) {
          clearTimeout(stallTimer);
          stallTimer = null;
        }
        if (signal) signal.onAbort = null;
        if (err) {
          if (signal?.aborted) {
            reject(Object.assign(new Error("Download cancelled"), { isAbort: true }));
          } else {
            reject(err);
          }
        } else if (totalSize > 0 && downloadedSize < totalSize) {
          reject(
            Object.assign(
              new Error(`Download incomplete: received ${downloadedSize} of ${totalSize} bytes`),
              { code: "ERR_DOWNLOAD_INCOMPLETE" }
            )
          );
        } else {
          resolve({ downloadedSize, totalSize });
        }
      });
    });

    request.on("error", (err) => {
      if (signal) signal.onAbort = null;
      cleanup();
      if (signal?.aborted) {
        reject(Object.assign(new Error("Download cancelled"), { isAbort: true }));
      } else {
        reject(err);
      }
    });

    request.on("timeout", () => {
      if (signal) signal.onAbort = null;
      cleanup();
      reject(Object.assign(new Error("Socket timeout"), { code: "ETIMEDOUT" }));
    });

    function emitProgress() {
      if (!onProgress || totalSize <= 0) return;
      const now = Date.now();
      if (now - lastProgressUpdate >= PROGRESS_THROTTLE_MS || downloadedSize >= totalSize) {
        lastProgressUpdate = now;
        onProgress(downloadedSize, totalSize);
      }
    }
  });
}

async function downloadFile(url, destPath, options = {}) {
  const {
    onProgress,
    timeout = DEFAULT_TIMEOUT,
    maxRetries = DEFAULT_MAX_RETRIES,
    signal,
  } = options;

  const tempPath = `${destPath}.tmp`;

  debugLogger.info("Download starting", { url: url.substring(0, 80), destPath });

  let startOffset = 0;
  try {
    const stats = await fsPromises.stat(tempPath);
    if (stats.size > 0) {
      startOffset = stats.size;
      debugLogger.info("Resuming download", { startOffset });
    }
  } catch {
    // No existing temp file
  }

  const { finalUrl } = await resolveRedirects(url, timeout);

  let lastError = null;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    if (signal?.aborted) {
      throw Object.assign(new Error("Download cancelled"), { isAbort: true });
    }

    if (attempt > 0) {
      const delay = backoffDelay(attempt - 1);
      debugLogger.info("Retrying download", { attempt, delay, startOffset });
      await sleep(delay);

      // Update startOffset from temp file in case partial data was written
      try {
        const stats = await fsPromises.stat(tempPath);
        if (stats.size > 0) startOffset = stats.size;
      } catch {
        startOffset = 0;
      }
    }

    try {
      await downloadAttempt(finalUrl, tempPath, { timeout, onProgress, signal, startOffset });

      // Atomic move to final path
      try {
        await fsPromises.rename(tempPath, destPath);
      } catch (renameError) {
        if (renameError.code === "EXDEV") {
          await fsPromises.copyFile(tempPath, destPath);
          await fsPromises.unlink(tempPath).catch(() => {});
        } else {
          throw renameError;
        }
      }

      debugLogger.info("Download complete", { destPath });
      return destPath;
    } catch (error) {
      lastError = error;

      if (error.isAbort) {
        await fsPromises.unlink(tempPath).catch(() => {});
        throw error;
      }

      if (!isRetryable(error) || attempt >= maxRetries) {
        await fsPromises.unlink(tempPath).catch(() => {});
        throw error;
      }

      debugLogger.warn("Download attempt failed", {
        attempt: attempt + 1,
        error: error.message,
        code: error.code,
      });
    }
  }

  await fsPromises.unlink(tempPath).catch(() => {});
  throw lastError;
}

function createDownloadSignal() {
  const signal = { aborted: false, onAbort: null };
  return {
    signal,
    abort() {
      signal.aborted = true;
      if (typeof signal.onAbort === "function") {
        signal.onAbort();
      }
    },
  };
}

async function validateFileSize(filePath, expectedSizeBytes, tolerancePercent = 10) {
  const stats = await fsPromises.stat(filePath);
  const minSize = expectedSizeBytes * (1 - tolerancePercent / 100);
  if (stats.size < minSize) {
    await fsPromises.unlink(filePath).catch(() => {});
    throw Object.assign(
      new Error(
        `Download appears corrupted: file is ${Math.round(stats.size / 1_000_000)}MB, ` +
          `expected at least ${Math.round(minSize / 1_000_000)}MB`
      ),
      { code: "ERR_FILE_TOO_SMALL" }
    );
  }
  return stats.size;
}

async function cleanupStaleDownloads(directory) {
  try {
    const entries = await fsPromises.readdir(directory);
    const now = Date.now();
    for (const entry of entries) {
      if (!entry.endsWith(".tmp") && !entry.startsWith("temp-extract-")) continue;
      const fullPath = path.join(directory, entry);
      try {
        const stats = await fsPromises.stat(fullPath);
        if (now - stats.mtimeMs > STALE_TMP_AGE_MS) {
          if (stats.isDirectory()) {
            await fsPromises.rm(fullPath, { recursive: true, force: true });
          } else {
            await fsPromises.unlink(fullPath);
          }
          debugLogger.info("Cleaned up stale download artifact", { path: fullPath });
        }
      } catch {
        // Skip files we can't stat or delete
      }
    }
  } catch {
    // Directory may not exist yet
  }
}

async function checkDiskSpace(directory, requiredBytes) {
  try {
    const stats = await fsPromises.statfs(directory);
    const availableBytes = stats.bavail * stats.bsize;
    return { ok: availableBytes >= requiredBytes, availableBytes };
  } catch {
    // statfs not supported or directory doesn't exist — skip check
    return { ok: true, availableBytes: Infinity };
  }
}

module.exports = {
  downloadFile,
  createDownloadSignal,
  validateFileSize,
  cleanupStaleDownloads,
  checkDiskSpace,
};
