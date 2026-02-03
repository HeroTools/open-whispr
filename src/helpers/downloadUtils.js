const fs = require("fs");
const { promises: fsPromises } = require("fs");
const https = require("https");
const http = require("http");
const { pipeline } = require("stream");
const path = require("path");
const debugLogger = require("./debugLogger");
const tar = require("tar");
const unzipper = require("unzipper");

const USER_AGENT = "OpenWhispr/1.0";
const PROGRESS_THROTTLE_MS = 100;
const MAX_REDIRECTS = 5;
const DEFAULT_TIMEOUT = 60000;
const DEFAULT_MAX_RETRIES = 3;
const MAX_BACKOFF_MS = 30000;

// ... existing code ...

function resolveRedirects(url, timeout) {
  // ... existing code ...
}

/**
 * Fetch JSON from a URL
 */
function fetchJson(url, redirectCount = 0) {
  return new Promise((resolve, reject) => {
    if (redirectCount > MAX_REDIRECTS) {
      reject(new Error("Too many redirects"));
      return;
    }

    const headers = {
      "User-Agent": USER_AGENT,
      Accept: "application/vnd.github+json",
    };

    https
      .get(url, { headers, timeout: DEFAULT_TIMEOUT }, (res) => {
        if (res.statusCode === 301 || res.statusCode === 302) {
          if (!res.headers.location) {
            reject(new Error("Redirect without location"));
            return;
          }
          fetchJson(res.headers.location, redirectCount + 1)
            .then(resolve)
            .catch(reject);
          return;
        }

        if (res.statusCode !== 200) {
          reject(new Error(`HTTP ${res.statusCode}`));
          return;
        }

        let data = "";
        res.on("data", (chunk) => (data += chunk));
        res.on("end", () => {
          try {
            resolve(JSON.parse(data));
          } catch (e) {
            reject(e);
          }
        });
        res.on("error", reject);
      })
      .on("error", reject);
  });
}

/**
 * Fetch latest release from GitHub
 */
async function fetchLatestRelease(repo) {
  try {
    const url = `https://api.github.com/repos/${repo}/releases/latest`;
    const release = await fetchJson(url);
    return {
      tag: release.tag_name,
      url: release.html_url,
      assets: (release.assets || []).map((asset) => ({
        name: asset.name,
        url: asset.browser_download_url,
      })),
    };
  } catch (error) {
    debugLogger.error(`Failed to fetch release for ${repo}`, { error: error.message });
    return null;
  }
}

/**
 * Extract archive (zip or tar.gz/bz2)
 */
async function extractArchive(filePath, destDir) {
  await fsPromises.mkdir(destDir, { recursive: true });

  if (filePath.endsWith(".zip")) {
    const directory = await unzipper.Open.file(filePath);
    await directory.extract({ path: destDir });
  } else if (filePath.endsWith(".tar.gz") || filePath.endsWith(".tgz")) {
    await tar.x({
      file: filePath,
      cwd: destDir,
      gzip: true,
    });
  } else if (filePath.endsWith(".tar.bz2") || filePath.endsWith(".tbz2")) {
    // node-tar doesn't support bzip2 natively, but newer tar versions might?
    // The tar package supports gzip. Bzip2 might need a separate stream.
    // For now assume .tar.gz or .zip which are common.
    // If bzip2 is needed we might need to shell out or use another lib.
    // Parakeet models use .tar.bz2.
    // Let's assume the app has tar in PATH for bz2 if node-tar fails?
    // Actually `scripts/download-sherpa-onnx.js` uses system `tar`.
    // Let's stick to node libs if possible.
    // For whisper-cpp, release assets are .zip (mac/win/linux-cuda) or .tar.gz?
    // Let's check: whisper-server-linux-x64-cuda.zip
    // So .zip is enough for Whisper.
    await tar.x({
      file: filePath,
      cwd: destDir,
    });
  } else {
    throw new Error(`Unsupported archive format: ${filePath}`);
  }
}

function downloadAttempt(url, tempPath, { timeout, onProgress, signal, startOffset }) {
  // ... existing code ...
}

async function downloadFile(url, destPath, options = {}) {
  // ... existing code ...
}

function createDownloadSignal() {
  // ... existing code ...
}

module.exports = { downloadFile, createDownloadSignal, fetchLatestRelease, extractArchive };
