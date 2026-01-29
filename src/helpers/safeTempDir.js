const os = require("os");
const fs = require("fs");
const path = require("path");

let cachedSafeTempDir = null;

// Returns an ASCII-safe temp directory for native binaries on Windows.
// Falls back to ProgramData when TEMP contains non-ASCII characters.
function getSafeTempDir() {
  if (cachedSafeTempDir) return cachedSafeTempDir;

  const systemTemp = os.tmpdir();

  if (process.platform !== "win32" || /^[\x00-\x7F]*$/.test(systemTemp)) {
    cachedSafeTempDir = systemTemp;
    return systemTemp;
  }

  const fallbackBase = process.env.ProgramData || "C:\\ProgramData";
  const fallback = path.join(fallbackBase, "OpenWhispr", "temp");

  try {
    fs.mkdirSync(fallback, { recursive: true });
    cachedSafeTempDir = fallback;
    return fallback;
  } catch {
    const rootFallback = path.join(process.env.SystemDrive || "C:", "OpenWhispr", "temp");
    try {
      fs.mkdirSync(rootFallback, { recursive: true });
      cachedSafeTempDir = rootFallback;
      return rootFallback;
    } catch {
      cachedSafeTempDir = systemTemp;
      return systemTemp;
    }
  }
}

module.exports = { getSafeTempDir };
