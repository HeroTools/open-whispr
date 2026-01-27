const { spawn } = require("child_process");
const fs = require("fs");
const path = require("path");
const debugLogger = require("./debugLogger");

let cachedFFmpegPath = null;

/**
 * Get the path to FFmpeg binary, checking bundled and system locations
 * @returns {string|null} Path to FFmpeg binary or null if not found
 */
function getFFmpegPath() {
  if (cachedFFmpegPath) return cachedFFmpegPath;

  try {
    let ffmpegPath = require("ffmpeg-static");
    ffmpegPath = path.normalize(ffmpegPath);

    if (process.platform === "win32" && !ffmpegPath.endsWith(".exe")) {
      ffmpegPath += ".exe";
    }

    // Try unpacked ASAR path first (production builds unpack ffmpeg-static)
    const unpackedPath = ffmpegPath.includes("app.asar")
      ? ffmpegPath.replace(/app\.asar([/\\])/, "app.asar.unpacked$1")
      : null;

    if (unpackedPath && fs.existsSync(unpackedPath)) {
      if (process.platform !== "win32") {
        try {
          fs.accessSync(unpackedPath, fs.constants.X_OK);
        } catch {
          try {
            fs.chmodSync(unpackedPath, 0o755);
          } catch (chmodErr) {
            debugLogger.warn("Failed to chmod FFmpeg", { error: chmodErr.message });
          }
        }
      }
      cachedFFmpegPath = unpackedPath;
      return unpackedPath;
    }

    // Try original path (development or if not in ASAR)
    if (fs.existsSync(ffmpegPath)) {
      if (process.platform !== "win32") {
        try {
          fs.accessSync(ffmpegPath, fs.constants.X_OK);
        } catch {
          debugLogger.debug("FFmpeg exists but not executable", { ffmpegPath });
          throw new Error("Not executable");
        }
      }
      cachedFFmpegPath = ffmpegPath;
      return ffmpegPath;
    }
  } catch (err) {
    debugLogger.debug("Bundled FFmpeg not available", { error: err.message });
  }

  // Try system FFmpeg locations
  const systemCandidates =
    process.platform === "darwin"
      ? ["/opt/homebrew/bin/ffmpeg", "/usr/local/bin/ffmpeg"]
      : process.platform === "win32"
        ? ["C:\\ffmpeg\\bin\\ffmpeg.exe"]
        : ["/usr/bin/ffmpeg", "/usr/local/bin/ffmpeg"];

  for (const candidate of systemCandidates) {
    if (fs.existsSync(candidate)) {
      cachedFFmpegPath = candidate;
      return candidate;
    }
  }

  // Search PATH environment
  const pathEnv = process.env.PATH || "";
  const pathSep = process.platform === "win32" ? ";" : ":";
  const pathDirs = pathEnv.split(pathSep).map((entry) => entry.replace(/^"|"$/g, ""));
  const pathBinary = process.platform === "win32" ? "ffmpeg.exe" : "ffmpeg";

  for (const dir of pathDirs) {
    if (!dir) continue;
    const candidate = path.join(dir, pathBinary);
    if (!fs.existsSync(candidate)) continue;
    if (process.platform !== "win32") {
      try {
        fs.accessSync(candidate, fs.constants.X_OK);
      } catch {
        continue;
      }
    }
    cachedFFmpegPath = candidate;
    return candidate;
  }

  debugLogger.debug("FFmpeg not found");
  return null;
}

/**
 * Check if a buffer contains WAV audio format by examining the RIFF header
 * @param {Buffer} buffer - Audio buffer to check
 * @returns {boolean} True if buffer is WAV format
 */
function isWavFormat(buffer) {
  if (!buffer || buffer.length < 12) return false;

  // Check for RIFF header and WAVE format
  return (
    buffer[0] === 0x52 && // R
    buffer[1] === 0x49 && // I
    buffer[2] === 0x46 && // F
    buffer[3] === 0x46 && // F
    buffer[8] === 0x57 && // W
    buffer[9] === 0x41 && // A
    buffer[10] === 0x56 && // V
    buffer[11] === 0x45 // E
  );
}

/**
 * Convert audio file to 16kHz mono WAV format using FFmpeg
 * @param {string} inputPath - Path to input audio file
 * @param {string} outputPath - Path to output WAV file
 * @param {Object} options - Conversion options
 * @param {number} options.sampleRate - Output sample rate (default: 16000)
 * @param {number} options.channels - Output channels (default: 1 for mono)
 * @returns {Promise<void>}
 */
function convertToWav(inputPath, outputPath, options = {}) {
  const { sampleRate = 16000, channels = 1 } = options;

  return new Promise((resolve, reject) => {
    const ffmpegPath = getFFmpegPath();
    if (!ffmpegPath) {
      reject(new Error("FFmpeg not found - required for audio conversion"));
      return;
    }

    const args = [
      "-i",
      inputPath,
      "-ar",
      String(sampleRate),
      "-ac",
      String(channels),
      "-c:a",
      "pcm_s16le",
      "-y", // Overwrite output file
      outputPath,
    ];

    debugLogger.debug("Converting audio with FFmpeg", {
      input: inputPath,
      output: outputPath,
      sampleRate,
      channels,
    });

    const proc = spawn(ffmpegPath, args, {
      stdio: ["ignore", "pipe", "pipe"],
      windowsHide: true,
    });

    let stderr = "";

    proc.stderr.on("data", (data) => {
      stderr += data.toString();
    });

    proc.on("error", (error) => {
      reject(new Error(`FFmpeg process error: ${error.message}`));
    });

    proc.on("close", (code) => {
      if (code !== 0) {
        const stderrPreview = stderr.slice(-500).trim();
        debugLogger.debug("FFmpeg conversion failed", { code, stderr: stderrPreview });
        reject(
          new Error(`FFmpeg exited with code ${code}${stderrPreview ? `: ${stderrPreview}` : ""}`)
        );
        return;
      }

      // Verify output file exists and has content
      if (!fs.existsSync(outputPath)) {
        reject(new Error("FFmpeg conversion produced no output file"));
        return;
      }

      const stats = fs.statSync(outputPath);
      if (stats.size === 0) {
        reject(new Error("FFmpeg conversion produced empty output file"));
        return;
      }

      debugLogger.debug("FFmpeg conversion complete", { outputSize: stats.size });
      resolve();
    });
  });
}

function wavToFloat32Samples(wavBuffer) {
  if (!isWavFormat(wavBuffer)) {
    throw new Error("Buffer is not a valid WAV file");
  }

  // Parse WAV header to find data chunk
  let offset = 12; // Skip RIFF header (4) + size (4) + WAVE (4)
  let dataOffset = -1;
  let dataSize = 0;
  let bitsPerSample = 16;

  while (offset < wavBuffer.length - 8) {
    const chunkId = wavBuffer.toString("ascii", offset, offset + 4);
    const chunkSize = wavBuffer.readUInt32LE(offset + 4);

    if (chunkId === "fmt ") {
      bitsPerSample = wavBuffer.readUInt16LE(offset + 22);
    } else if (chunkId === "data") {
      dataOffset = offset + 8;
      dataSize = chunkSize;
      break;
    }

    offset += 8 + chunkSize;
  }

  if (dataOffset < 0) {
    throw new Error("WAV data chunk not found");
  }

  const bytesPerSample = bitsPerSample / 8;
  const numSamples = Math.floor(dataSize / bytesPerSample);
  const float32 = Buffer.alloc(numSamples * 4);

  for (let i = 0; i < numSamples; i++) {
    const sampleOffset = dataOffset + i * bytesPerSample;
    const intVal =
      bitsPerSample === 16 ? wavBuffer.readInt16LE(sampleOffset) : wavBuffer.readInt8(sampleOffset);
    const maxVal = bitsPerSample === 16 ? 32768 : 128;
    float32.writeFloatLE(intVal / maxVal, i * 4);
  }

  return float32;
}

function clearCache() {
  cachedFFmpegPath = null;
}

module.exports = {
  getFFmpegPath,
  isWavFormat,
  convertToWav,
  wavToFloat32Samples,
  clearCache,
};
