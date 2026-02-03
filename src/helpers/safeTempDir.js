const os = require("os");
const fs = require("fs");
const path = require("path");

let cachedSafeTempDir = null;

// Returns a safe temp directory for native binaries on Windows.
// Falls back to ProgramData when TEMP contains spaces or non-ASCII characters,
// as many native binaries (whisper-server, ffmpeg) don't handle these paths correctly.
function getSafeTempDir() {
  if (cachedSafeTempDir) return cachedSafeTempDir;

  const systemTemp = os.tmpdir();

  // On non-Windows platforms, use system temp directly
  // On Windows, check for problematic characters: non-ASCII or spaces
  const hasProblematicChars = !/^[\x21-\x7E]*$/.test(systemTemp);
  if (process.platform !== "win32" || !hasProblematicChars) {
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
