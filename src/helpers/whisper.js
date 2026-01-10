const { spawn } = require("child_process");
const fs = require("fs");
const fsPromises = require("fs").promises;
const os = require("os");
const path = require("path");
const crypto = require("crypto");
const PythonInstaller = require("./pythonInstaller");
const { runCommand, TIMEOUTS } = require("../utils/process");
const debugLogger = require("./debugLogger");

// Cache TTL - mirrors CACHE_CONFIG.AVAILABILITY_CHECK_TTL in src/config/constants.ts
const CACHE_TTL_MS = 30000;

class WhisperManager {
  constructor() {
    this.pythonCmd = null;
    this.whisperInstalled = null;
    this.isInitialized = false;
    this.currentDownloadProcess = null;
    this.pythonInstaller = new PythonInstaller();
    this.cachedFFmpegPath = null;
    this.ffmpegAvailabilityCache = { result: null, expiresAt: 0 };
  }

  sanitizeErrorMessage(message = "") {
    if (!message) {
      return "";
    }
    return message.replace(/\x1B\[[0-9;]*m/g, "");
  }

  shouldRetryWithUserInstall(message = "") {
    const normalized = this.sanitizeErrorMessage(message).toLowerCase();
    const shouldUseUser = (
      normalized.includes("permission denied") ||
      normalized.includes("access is denied") ||
      normalized.includes("externally-managed-environment") ||
      normalized.includes("externally managed environment") ||
      normalized.includes("pep 668") ||
      normalized.includes("--break-system-packages")
    );
    return shouldUseUser;
  }

  isTomlResolverError(message = "") {
    const normalized = this.sanitizeErrorMessage(message).toLowerCase();
    return (
      normalized.includes("pyproject.toml") || normalized.includes("tomlerror")
    );
  }

  formatWhisperInstallError(message = "") {
    let formatted = this.sanitizeErrorMessage(message) || "Whisper installation failed.";
    const lower = formatted.toLowerCase();

    if (lower.includes("microsoft visual c++")) {
      return "Microsoft Visual C++ build tools required. Install Visual Studio Build Tools.";
    }

    if (lower.includes("no matching distribution")) {
      return "Python version incompatible. OpenAI Whisper requires Python 3.8-3.11.";
    }

    return formatted;
  }

  getWhisperScriptPath() {
    // In production, the file is unpacked from ASAR
    if (process.env.NODE_ENV === "development") {
      return path.join(__dirname, "..", "..", "whisper_bridge.py");
    } else {
      // In production, use the unpacked path
      return path.join(
        process.resourcesPath,
        "app.asar.unpacked",
        "whisper_bridge.py"
      );
    }
  }

  async initializeAtStartup() {
    try {
      await this.findPythonExecutable();
      await this.checkWhisperInstallation();
      this.isInitialized = true;
    } catch (error) {
      // Whisper not available at startup is not critical
      this.isInitialized = true;
    }
  }

  async transcribeLocalWhisper(audioBlob, options = {}) {
    debugLogger.logWhisperPipeline('transcribeLocalWhisper - start', {
      options,
      audioBlobType: audioBlob?.constructor?.name,
      audioBlobSize: audioBlob?.byteLength || audioBlob?.size || 0
    });
    
    // First check if FFmpeg is available
    const ffmpegCheck = await this.checkFFmpegAvailability();
    debugLogger.logWhisperPipeline('FFmpeg availability check', ffmpegCheck);
    
    if (!ffmpegCheck.available) {
      debugLogger.error('FFmpeg not available', ffmpegCheck);
      throw new Error(`FFmpeg not available: ${ffmpegCheck.error || 'Unknown error'}`);
    }
    
    const tempAudioPath = await this.createTempAudioFile(audioBlob);
    const model = options.model || "base";
    const language = options.language || null;

    try {
      const result = await this.runWhisperProcess(
        tempAudioPath,
        model,
        language
      );
      return this.parseWhisperResult(result);
    } catch (error) {
      throw error;
    } finally {
      await this.cleanupTempFile(tempAudioPath);
    }
  }

  async createTempAudioFile(audioBlob) {
    const tempDir = os.tmpdir();
    const filename = `whisper_audio_${crypto.randomUUID()}.wav`;
    const tempAudioPath = path.join(tempDir, filename);

    debugLogger.logAudioData('createTempAudioFile', audioBlob);
    debugLogger.log('Creating temp file at:', tempAudioPath);

    let buffer;
    if (audioBlob instanceof ArrayBuffer) {
      buffer = Buffer.from(audioBlob);
    } else if (audioBlob instanceof Uint8Array) {
      buffer = Buffer.from(audioBlob);
    } else if (typeof audioBlob === "string") {
      buffer = Buffer.from(audioBlob, "base64");
    } else if (audioBlob && audioBlob.buffer) {
      buffer = Buffer.from(audioBlob.buffer);
    } else {
      debugLogger.error('Unsupported audio data type:', typeof audioBlob, audioBlob);
      throw new Error(`Unsupported audio data type: ${typeof audioBlob}`);
    }

    debugLogger.log('Buffer created, size:', buffer.length);

    // Validate buffer before writing
    if (!buffer || buffer.length === 0) {
      debugLogger.error('Buffer is empty before writing');
      throw new Error("Audio buffer is empty - no audio data received");
    }

    // Minimum viable audio file size (WAV header is 44 bytes minimum)
    const MIN_AUDIO_SIZE = 44;
    if (buffer.length < MIN_AUDIO_SIZE) {
      debugLogger.error('Buffer too small to be valid audio:', buffer.length, 'bytes');
      throw new Error(`Audio data too small (${buffer.length} bytes) - recording may have failed`);
    }

    // Validate WAV header if present
    const hasValidWavHeader = this.validateWavHeader(buffer);
    if (!hasValidWavHeader) {
      debugLogger.log('No valid WAV header detected, buffer may need conversion');
      // Don't throw error - FFmpeg can handle headerless audio data
    }

    await fsPromises.writeFile(tempAudioPath, buffer);

    // Verify file was written correctly
    const stats = await fsPromises.stat(tempAudioPath);
    const fileInfo = {
      path: tempAudioPath,
      size: stats.size,
      isFile: stats.isFile(),
      permissions: stats.mode.toString(8),
      hasWavHeader: hasValidWavHeader
    };
    debugLogger.logWhisperPipeline('Temp audio file created', fileInfo);

    if (stats.size === 0) {
      debugLogger.error('Audio file is empty after writing');
      throw new Error("Audio file is empty - file write failed");
    }

    if (stats.size < MIN_AUDIO_SIZE) {
      debugLogger.error('Audio file too small after writing:', stats.size, 'bytes');
      throw new Error(`Audio file too small (${stats.size} bytes) - recording failed`);
    }

    return tempAudioPath;
  }

  validateWavHeader(buffer) {
    try {
      if (!buffer || buffer.length < 44) {
        return false;
      }

      // Check RIFF header
      const riff = buffer.toString('ascii', 0, 4);
      if (riff !== 'RIFF') {
        return false;
      }

      // Check WAVE format
      const wave = buffer.toString('ascii', 8, 12);
      if (wave !== 'WAVE') {
        return false;
      }

      // Check fmt subchunk
      const fmt = buffer.toString('ascii', 12, 16);
      if (fmt !== 'fmt ') {
        return false;
      }

      debugLogger.log('Valid WAV header detected');
      return true;
    } catch (error) {
      debugLogger.error('WAV header validation error:', error.message);
      return false;
    }
  }

  async getFFmpegPath() {
    if (this.cachedFFmpegPath) {
      return this.cachedFFmpegPath;
    }

    let ffmpegPath;

    try {
      ffmpegPath = require("ffmpeg-static");
      debugLogger.logFFmpegDebug('Initial ffmpeg-static path', ffmpegPath);

      // Normalize path separators for cross-platform compatibility
      ffmpegPath = path.normalize(ffmpegPath);

      // Add Windows .exe extension if missing
      if (process.platform === "win32" && !ffmpegPath.endsWith(".exe")) {
        ffmpegPath += ".exe";
      }

      if (fs.existsSync(ffmpegPath)) {
        // Validate executable permissions (skip on Windows - uses different permission model)
        if (process.platform !== "win32") {
          try {
            fs.accessSync(ffmpegPath, fs.constants.X_OK);
          } catch (e) {
            debugLogger.error('FFmpeg exists but is not executable:', e.message);
            throw new Error('FFmpeg not executable');
          }
        }
        debugLogger.log('Found bundled FFmpeg at:', ffmpegPath);
      } else if (process.env.NODE_ENV !== "development") {
        const possiblePaths = [
          ffmpegPath.replace(/app\.asar([/\\])/, "app.asar.unpacked$1"),
          ffmpegPath.replace(/app\.asar/g, "app.asar.unpacked"),
          ffmpegPath.replace(/.*app\.asar/, path.join(__dirname, "..", "..", "app.asar.unpacked")),
          process.resourcesPath ? path.join(
            process.resourcesPath,
            "app.asar.unpacked",
            "node_modules",
            "ffmpeg-static",
            process.platform === "win32" ? "ffmpeg.exe" : "ffmpeg"
          ) : null,
          process.resourcesPath ? path.join(
            process.resourcesPath,
            "app.asar.unpacked",
            "node_modules",
            "ffmpeg-static",
            "bin",
            process.platform === "win32" ? "ffmpeg.exe" : "ffmpeg"
          ) : null,
        ].filter(Boolean);

        debugLogger.log('FFmpeg not found at primary path, checking alternatives');

        for (const possiblePath of possiblePaths) {
          const normalizedPath = path.normalize(possiblePath);
          if (!fs.existsSync(normalizedPath)) {
            continue;
          }
          // Validate on non-Windows platforms
          if (process.platform !== "win32") {
            try {
              fs.accessSync(normalizedPath, fs.constants.X_OK);
            } catch (e) {
              continue;
            }
          }
          ffmpegPath = normalizedPath;
          debugLogger.log('FFmpeg found at:', normalizedPath);
          break;
        }
      }

      if (!ffmpegPath || !fs.existsSync(ffmpegPath)) {
        debugLogger.log('Bundled FFmpeg not found, trying system FFmpeg');
        throw new Error('Bundled FFmpeg not found');
      }
    } catch (bundledError) {
      debugLogger.log('Bundled FFmpeg error:', bundledError.message);

      // Try system FFmpeg with enhanced Windows support
      const systemCandidates = await this.getSystemFfmpegCandidates();

      for (const candidate of systemCandidates) {
        try {
          await runCommand(candidate, ["--version"], { timeout: TIMEOUTS.QUICK_CHECK });
          debugLogger.log('Using system FFmpeg:', candidate);
          ffmpegPath = candidate;
          break;
        } catch (error) {
          continue;
        }
      }

      if (!ffmpegPath) {
        debugLogger.error('No FFmpeg found (bundled or system)');
        return null;
      }
    }

    this.cachedFFmpegPath = ffmpegPath;
    return ffmpegPath;
  }

  async getSystemFfmpegCandidates() {
    const candidates = [];

    if (process.platform === "win32") {
      // Windows-specific paths
      candidates.push("ffmpeg.exe", "ffmpeg");

      // Common Windows installation directories
      const commonDirs = [
        path.join(process.env.ProgramFiles || "C:\\Program Files", "ffmpeg", "bin"),
        path.join(process.env["ProgramFiles(x86)"] || "C:\\Program Files (x86)", "ffmpeg", "bin"),
        path.join(process.env.LOCALAPPDATA || "", "Programs", "ffmpeg", "bin"),
        "C:\\ffmpeg\\bin",
      ];

      for (const dir of commonDirs) {
        if (dir) {
          const ffmpegExe = path.join(dir, "ffmpeg.exe");
          if (fs.existsSync(ffmpegExe)) {
            candidates.push(ffmpegExe);
          }
        }
      }
    } else if (process.platform === "darwin") {
      // macOS-specific paths
      candidates.push(
        "ffmpeg",
        "/opt/homebrew/bin/ffmpeg",
        "/usr/local/bin/ffmpeg",
        "/usr/bin/ffmpeg"
      );
    } else {
      // Linux
      candidates.push("ffmpeg", "/usr/bin/ffmpeg", "/usr/local/bin/ffmpeg");
    }

    return candidates;
  }

  async runWhisperProcess(tempAudioPath, model, language) {
    const pythonCmd = await this.findPythonExecutable();
    const whisperScriptPath = this.getWhisperScriptPath();

    if (!fs.existsSync(whisperScriptPath)) {
      throw new Error(`Whisper script not found at: ${whisperScriptPath}`);
    }

    const args = [whisperScriptPath, tempAudioPath, "--model", model];
    if (language) {
      args.push("--language", language);
    }
    args.push("--output-format", "json");

    return new Promise(async (resolve, reject) => {
      const ffmpegPath = await this.getFFmpegPath();
      if (!ffmpegPath) {
        reject(new Error('FFmpeg not found. Please ensure FFmpeg is installed or bundled correctly.'));
        return;
      }

      let effectiveFfmpegPath = ffmpegPath;
      if (effectiveFfmpegPath.includes("app.asar") && !effectiveFfmpegPath.includes("app.asar.unpacked")) {
        const unpackedPath = effectiveFfmpegPath.replace("app.asar", "app.asar.unpacked");
        if (fs.existsSync(unpackedPath)) {
          effectiveFfmpegPath = unpackedPath;
          debugLogger.log('Using unpacked FFmpeg path:', unpackedPath);
        }
      }

      const absoluteFFmpegPath = path.resolve(effectiveFfmpegPath);
      const enhancedEnv = {
        ...process.env,
        FFMPEG_PATH: absoluteFFmpegPath,
        FFMPEG_EXECUTABLE: absoluteFFmpegPath,
        FFMPEG_BINARY: absoluteFFmpegPath,
      };

      debugLogger.logFFmpegDebug('Setting FFmpeg env vars', absoluteFFmpegPath);

      // Add ffmpeg directory to PATH if we have a valid path
      if (ffmpegPath) {
        const ffmpegDir = path.dirname(absoluteFFmpegPath);
        const currentPath = enhancedEnv.PATH || "";
        const pathSeparator = process.platform === "win32" ? ";" : ":";

        if (!currentPath.includes(ffmpegDir)) {
          enhancedEnv.PATH = `${ffmpegDir}${pathSeparator}${currentPath}`;
        }
      }
      
      // Add common system paths for macOS GUI launches
      if (process.platform === "darwin") {
        const commonPaths = [
          "/usr/local/bin",
          "/opt/homebrew/bin",
          "/opt/homebrew/sbin",
          "/usr/bin",
          "/bin",
          "/usr/sbin",
          "/sbin"
        ];
        
        const currentPath = enhancedEnv.PATH || "";
        const pathsToAdd = commonPaths.filter(p => !currentPath.includes(p));
        
        if (pathsToAdd.length > 0) {
          enhancedEnv.PATH = `${currentPath}:${pathsToAdd.join(":")}`;
          debugLogger.log('Added system paths for GUI launch');
        }
      }

      debugLogger.logProcessStart(pythonCmd, args, { env: enhancedEnv });

      const whisperProcess = spawn(pythonCmd, args, {
        stdio: ["ignore", "pipe", "pipe"],
        windowsHide: true,
        env: enhancedEnv,
      });

      let stdout = "";
      let stderr = "";
      let isResolved = false;

      // Set timeout for longer recordings
      const timeout = setTimeout(() => {
        if (!isResolved) {
          whisperProcess.kill("SIGTERM");
          reject(new Error("Whisper transcription timed out (120 seconds)"));
        }
      }, 1200000);

      whisperProcess.stdout.on("data", (data) => {
        stdout += data.toString();
        debugLogger.logProcessOutput('Whisper', 'stdout', data);
      });

      whisperProcess.stderr.on("data", (data) => {
        const stderrText = data.toString();
        stderr += stderrText;

        debugLogger.logProcessOutput('Whisper', 'stderr', data);
      });

      whisperProcess.on("close", (code) => {
        if (isResolved) return;
        isResolved = true;
        clearTimeout(timeout);

        debugLogger.logWhisperPipeline('Process closed', {
          code,
          stdoutLength: stdout.length,
          stderrLength: stderr.length
        });

        if (code === 0) {
          debugLogger.log('Transcription successful');
          resolve(stdout);
        } else {
          // Better error message for FFmpeg issues
          let errorMessage = `Whisper transcription failed (code ${code}): ${stderr}`;

          if (
            stderr.includes("ffmpeg") ||
            stderr.includes("No such file or directory") ||
            stderr.includes("FFmpeg not found")
          ) {
            errorMessage +=
              "\n\nFFmpeg issue detected. Try restarting the app or reinstalling.";
          }

          reject(new Error(errorMessage));
        }
      });

      whisperProcess.on("error", (error) => {
        if (isResolved) return;
        isResolved = true;
        clearTimeout(timeout);

        if (error.code === "ENOENT") {
          const platformHelp =
            process.platform === "win32"
              ? 'Install Python 3.11+ from python.org with the "Install launcher" option, or set OPENWHISPR_PYTHON to the full path (for example C:\\\\Python312\\\\python.exe).'
              : "Install Python 3.11+ (for example `brew install python@3.11`) or set OPENWHISPR_PYTHON to the interpreter you want OpenWhispr to use.";
          const fallbackHelp =
            "You can also disable Local Whisper or enable the OpenAI fallback in Settings to continue using cloud transcription.";
          const message = [
            "Local Whisper could not start because Python was not found on this system.",
            platformHelp,
            fallbackHelp,
          ].join(" ");
          reject(new Error(message));
          return;
        }

        reject(new Error(`Whisper process error: ${error.message}`));
      });
    });
  }

  parseWhisperResult(stdout) {
    debugLogger.logWhisperPipeline('Parsing result', { stdoutLength: stdout.length });
    try {
      // Clean stdout by removing any non-JSON content
      const lines = stdout.split("\n").filter((line) => line.trim());
      let jsonLine = "";

      // Find the line that looks like JSON (starts with { and ends with })
      for (const line of lines) {
        const trimmed = line.trim();
        if (trimmed.startsWith("{") && trimmed.endsWith("}")) {
          jsonLine = trimmed;
          break;
        }
      }

      if (!jsonLine) {
        throw new Error("No JSON output found in Whisper response");
      }

      const result = JSON.parse(jsonLine);
      
      if (!result.text || result.text.trim().length === 0) {
        return { success: false, message: "No audio detected" };
      }
      return { success: true, text: result.text.trim() };
    } catch (parseError) {
      debugLogger.error('Failed to parse Whisper output');
      throw new Error(`Failed to parse Whisper output: ${parseError.message}`);
    }
  }

  async cleanupTempFile(tempAudioPath) {
    try {
      await fsPromises.unlink(tempAudioPath);
    } catch (cleanupError) {
      // Temp file cleanup error is not critical
    }
  }

  async findPythonExecutable() {
    if (this.pythonCmd) {
      return this.pythonCmd;
    }

    const candidateSet = new Set();
    const addCandidate = (candidate) => {
      if (!candidate || typeof candidate !== "string") {
        return;
      }
      const sanitized = candidate.trim().replace(/^["']|["']$/g, "");
      if (sanitized.length === 0) {
        return;
      }
      candidateSet.add(sanitized);
    };

    if (process.env.OPENWHISPR_PYTHON) {
      addCandidate(process.env.OPENWHISPR_PYTHON);
    }

    if (process.platform === "win32") {
      // Windows: Get registry-based candidates first (most reliable)
      const registryCandidates = await this.getWindowsRegistryPython();
      registryCandidates.forEach(addCandidate);

      // Then add filesystem candidates
      this.getWindowsPythonCandidates().forEach(addCandidate);
    }

    const commonCandidates = [
      "python3.12",
      "python3.11",
      "python3.10",
      "python3",
      "python",
      "/usr/bin/python3.12",
      "/usr/bin/python3.11",
      "/usr/bin/python3.10",
      "/usr/bin/python3",
      "/usr/local/bin/python3.12",
      "/usr/local/bin/python3.11",
      "/usr/local/bin/python3.10",
      "/usr/local/bin/python3",
      "/opt/homebrew/bin/python3.12",
      "/opt/homebrew/bin/python3.11",
      "/opt/homebrew/bin/python3.10",
      "/opt/homebrew/bin/python3",
      "/usr/bin/python",
      "/usr/local/bin/python",
    ];
    commonCandidates.forEach(addCandidate);

    for (const pythonPath of candidateSet) {
      // Windows-specific: resolve relative commands to absolute paths
      let resolvedPath = pythonPath;
      if (process.platform === "win32" && !path.isAbsolute(pythonPath)) {
        resolvedPath = await this.resolveWindowsCommand(pythonPath);
        if (!resolvedPath) {
          debugLogger.log(`Could not resolve Windows command: ${pythonPath}`);
          continue;
        }
      }

      // Skip absolute paths that don't exist
      if (path.isAbsolute(resolvedPath) && !fs.existsSync(resolvedPath)) {
        debugLogger.log(`Python path does not exist: ${resolvedPath}`);
        continue;
      }

      try {
        const version = await this.getPythonVersion(resolvedPath);
        if (this.isPythonVersionSupported(version)) {
          this.pythonCmd = resolvedPath;
          debugLogger.log(`Found Python: ${resolvedPath} (version ${version.major}.${version.minor})`);
          return resolvedPath;
        }
      } catch (error) {
        debugLogger.log(`Python version check failed for ${resolvedPath}: ${error.message}`);
        continue;
      }
    }

    throw new Error(
      'Python 3.x not found. Click "Install Python" in Settings or set OPENWHISPR_PYTHON to a valid interpreter path.'
    );
  }

  async getWindowsRegistryPython() {
    if (process.platform !== "win32") {
      return [];
    }

    const candidates = [];
    debugLogger.logWindowsPythonSearch?.('Starting registry search', { method: 'registry' });

    try {
      // Query Windows Registry for Python installations
      const registryKeys = [
        'HKLM\\SOFTWARE\\Python\\PythonCore',
        'HKCU\\SOFTWARE\\Python\\PythonCore',
        'HKLM\\SOFTWARE\\Wow6432Node\\Python\\PythonCore',
      ];

      for (const registryKey of registryKeys) {
        try {
          debugLogger.log(`Querying registry key: ${registryKey}`);

          // List all Python versions in registry
          const { output } = await runCommand('reg', ['query', registryKey], {
            timeout: TIMEOUTS.QUICK_CHECK
          });

          // Parse version folders (e.g., "3.11", "3.12")
          const versionMatches = output.match(/PythonCore\\([\d.]+)/g);
          debugLogger.log(`Found ${versionMatches?.length || 0} Python versions in ${registryKey}`);

          if (versionMatches) {
            for (const match of versionMatches) {
              const version = match.replace('PythonCore\\', '');

              // Query InstallPath for this version
              try {
                const installPathKey = `${registryKey}\\${version}\\InstallPath`;
                const { output: pathOutput } = await runCommand('reg', ['query', installPathKey, '/ve'], {
                  timeout: TIMEOUTS.QUICK_CHECK
                });

                // Extract path from registry output
                const pathMatch = pathOutput.match(/REG_SZ\s+(.+)/);
                if (pathMatch && pathMatch[1]) {
                  const installPath = pathMatch[1].trim();
                  const pythonExe = path.join(installPath, 'python.exe');

                  debugLogger.log(`Checking Python ${version} at: ${pythonExe}`);

                  if (fs.existsSync(pythonExe)) {
                    candidates.push(pythonExe);
                    debugLogger.log(`✓ Found valid Python in registry: ${pythonExe}`);
                  } else {
                    debugLogger.log(`✗ Python exe not found at: ${pythonExe}`);
                  }
                }
              } catch (error) {
                debugLogger.log(`Failed to query InstallPath for ${version}: ${error.message}`);
              }
            }
          }
        } catch (error) {
          debugLogger.log(`Failed to query registry key ${registryKey}: ${error.message}`);
        }
      }
    } catch (error) {
      debugLogger.log('Registry query failed:', error.message);
    }

    debugLogger.logWindowsPythonSearch?.('Registry search complete', {
      foundCount: candidates.length,
      candidates
    });

    return candidates;
  }

  async resolveWindowsCommand(command) {
    if (process.platform !== "win32") {
      return command;
    }

    try {
      // Use 'where' command to find executable in PATH
      const { output } = await runCommand('where', [command], {
        timeout: TIMEOUTS.QUICK_CHECK
      });

      // 'where' returns multiple paths, take the first one
      const paths = output.trim().split('\n');
      if (paths.length > 0) {
        const resolvedPath = paths[0].trim();
        if (fs.existsSync(resolvedPath)) {
          debugLogger.log(`Resolved ${command} to ${resolvedPath}`);
          return resolvedPath;
        }
      }
    } catch (error) {
      // Command not found in PATH
    }

    return null;
  }

  getWindowsPythonCandidates() {
    const candidates = [];
    const versionSuffixes = ["313", "312", "311", "310", "39", "38"];

    const systemDrive = process.env.SystemDrive || "C:";
    const windowsDir =
      process.env.WINDIR || path.join(systemDrive, "Windows");

    candidates.push("py");
    candidates.push("py.exe");
    candidates.push("python3");
    candidates.push("python3.exe");
    candidates.push("python");
    candidates.push("python.exe");
    candidates.push(path.join(windowsDir, "py.exe"));

    const baseDirs = [];
    if (process.env.LOCALAPPDATA) {
      baseDirs.push(path.join(process.env.LOCALAPPDATA, "Programs", "Python"));
      const windowsApps = path.join(
        process.env.LOCALAPPDATA,
        "Microsoft",
        "WindowsApps"
      );
      candidates.push(path.join(windowsApps, "python.exe"));
      candidates.push(path.join(windowsApps, "python3.exe"));
    }
    if (process.env.ProgramFiles) {
      baseDirs.push(process.env.ProgramFiles);
    }
    if (process.env["ProgramFiles(x86)"]) {
      baseDirs.push(process.env["ProgramFiles(x86)"]);
    }
    baseDirs.push(systemDrive);

    for (const baseDir of baseDirs) {
      if (!baseDir) {
        continue;
      }

      for (const suffix of versionSuffixes) {
        const folderName = `Python${suffix}`;
        candidates.push(path.join(baseDir, folderName, "python.exe"));
      }
    }

    return candidates;
  }

  async installPython(progressCallback = null) {
    try {
      // Clear cached Python command since we're installing new one
      this.pythonCmd = null;
      
      const result = await this.pythonInstaller.installPython(progressCallback);
      
      // After installation, try to find Python again
      try {
        await this.findPythonExecutable();
        return result;
      } catch (findError) {
        throw new Error("Python installed but not found in PATH. Please restart the application.");
      }
      
    } catch (error) {
      console.error("Python installation failed:", error);
      throw error;
    }
  }

  async checkPythonInstallation() {
    return await this.pythonInstaller.isPythonInstalled();
  }

  async getPythonVersion(pythonPath) {
    return new Promise((resolve) => {
      // Use shell: false on Windows to ensure exact path is used
      const spawnOptions = process.platform === "win32"
        ? { windowsHide: true, shell: false }
        : {};

      const testProcess = spawn(pythonPath, ["--version"], spawnOptions);
      let output = "";

      testProcess.stdout.on("data", (data) => output += data);
      testProcess.stderr.on("data", (data) => output += data);

      testProcess.on("close", (code) => {
        if (code === 0) {
          const match = output.match(/Python (\d+)\.(\d+)/i);
          resolve(match ? { major: +match[1], minor: +match[2] } : null);
        } else {
          resolve(null);
        }
      });

      testProcess.on("error", (error) => {
        debugLogger.log(`Python version check error for ${pythonPath}: ${error.message}`);
        resolve(null);
      });
    });
  }

  isPythonVersionSupported(version) {
    // Accept any Python 3.x version
    return version && version.major === 3;
  }

  async checkWhisperInstallation() {
    // Return cached result if available
    if (this.whisperInstalled !== null) {
      return this.whisperInstalled;
    }

    try {
      const pythonCmd = await this.findPythonExecutable();

      const result = await new Promise((resolve) => {
        const checkProcess = spawn(pythonCmd, [
          "-c",
          'import whisper; print("OK")',
        ]);

        let output = "";
        checkProcess.stdout.on("data", (data) => {
          output += data.toString();
        });

        checkProcess.on("close", (code) => {
          if (code === 0 && output.includes("OK")) {
            resolve({ installed: true, working: true });
          } else {
            resolve({ installed: false, working: false });
          }
        });

        checkProcess.on("error", (error) => {
          resolve({ installed: false, working: false, error: error.message });
        });
      });

      this.whisperInstalled = result; // Cache the result
      return result;
    } catch (error) {
      const errorResult = {
        installed: false,
        working: false,
        error: error.message,
      };
      this.whisperInstalled = errorResult;
      return errorResult;
    }
  }

  async checkFFmpegAvailability() {
    debugLogger.logWhisperPipeline('checkFFmpegAvailability - start', {});

    try {
      const now = Date.now();
      if (
        this.ffmpegAvailabilityCache &&
        now < this.ffmpegAvailabilityCache.expiresAt &&
        this.ffmpegAvailabilityCache.result !== null
      ) {
        return this.ffmpegAvailabilityCache.result;
      }

      const pythonCmd = await this.findPythonExecutable();
      const whisperScriptPath = this.getWhisperScriptPath();
      const ffmpegPath = await this.getFFmpegPath();
      if (!ffmpegPath) {
        debugLogger.log('FFmpeg not found by resolver');
        const result = {
          available: false,
          error: "FFmpeg not found"
        };
        this.ffmpegAvailabilityCache = {
          result,
          expiresAt: Date.now() + CACHE_TTL_MS,
        };
        return result;
      }

      debugLogger.log('FFmpeg resolved for availability check:', ffmpegPath);

      const result = await new Promise((resolve) => {
        const env = {
          ...process.env,
          FFMPEG_PATH: ffmpegPath || "",
          FFMPEG_EXECUTABLE: ffmpegPath || "",
          FFMPEG_BINARY: ffmpegPath || ""
        };

        const checkProcess = spawn(pythonCmd, [
          whisperScriptPath,
          "--mode",
          "check-ffmpeg",
        ], {
          env: env
        });

        let output = "";
        let stderr = "";

        checkProcess.stdout.on("data", (data) => {
          output += data.toString();
        });

        checkProcess.stderr.on("data", (data) => {
          stderr += data.toString();
        });

        checkProcess.on("close", (code) => {
          debugLogger.logWhisperPipeline('FFmpeg check process closed', {
            code,
            outputLength: output.length,
            stderrLength: stderr.length
          });
          
          if (code === 0) {
            try {
              const result = JSON.parse(output);
              debugLogger.log('FFmpeg check result:', result);
              resolve(result);
            } catch (parseError) {
              debugLogger.error('Failed to parse FFmpeg check result:', parseError);
              resolve({
                available: false,
                error: "Failed to parse FFmpeg check result",
              });
            }
          } else {
            debugLogger.error('FFmpeg check failed with code:', code, 'stderr:', stderr);
            resolve({
              available: false,
              error: stderr || "FFmpeg check failed",
            });
          }
        });

        checkProcess.on("error", (error) => {
          resolve({ available: false, error: error.message });
        });
      });

      this.ffmpegAvailabilityCache = {
        result,
        expiresAt: Date.now() + CACHE_TTL_MS,
      };
      return result;
    } catch (error) {
      const result = { available: false, error: error.message };
      this.ffmpegAvailabilityCache = {
        result,
        expiresAt: Date.now() + CACHE_TTL_MS,
      };
      return result;
    }
  }

  upgradePip(pythonCmd) {
    return runCommand(pythonCmd, ["-m", "pip", "install", "--upgrade", "pip"], { timeout: TIMEOUTS.PIP_UPGRADE });
  }

  // Removed - now using shared runCommand from utils/process.js

  async installWhisper() {
    const pythonCmd = await this.findPythonExecutable();
    
    // Upgrade pip first to avoid version issues
    try {
      await this.upgradePip(pythonCmd);
    } catch (error) {
      const cleanUpgradeError = this.sanitizeErrorMessage(error.message);
      debugLogger.log("First pip upgrade attempt failed:", cleanUpgradeError);
      
      // Try user install for pip upgrade
      try {
        await runCommand(pythonCmd, ["-m", "pip", "install", "--user", "--upgrade", "pip"], { timeout: TIMEOUTS.PIP_UPGRADE });
      } catch (userError) {
        const cleanUserError = this.sanitizeErrorMessage(userError.message);
        // If pip upgrade fails completely, try to detect if it's the TOML error
        if (this.isTomlResolverError(cleanUpgradeError) || this.isTomlResolverError(cleanUserError)) {
          // Try installing with legacy resolver as a workaround
          try {
            await runCommand(pythonCmd, ["-m", "pip", "install", "--use-deprecated=legacy-resolver", "--upgrade", "pip"], { timeout: TIMEOUTS.PIP_UPGRADE });
          } catch (legacyError) {
            throw new Error("Failed to upgrade pip. Please manually run: python -m pip install --upgrade pip");
          }
        } else {
          debugLogger.log("Pip upgrade failed completely, attempting to continue");
        }
      }
    }
    
    const buildInstallArgs = ({ user = false, legacy = false } = {}) => {
      const args = ["-m", "pip", "install"];
      if (legacy) {
        args.push("--use-deprecated=legacy-resolver");
      }
      if (user) {
        args.push("--user");
      }
      args.push("-U", "openai-whisper");
      return args;
    };
    
    try {
      return await runCommand(pythonCmd, buildInstallArgs(), { timeout: TIMEOUTS.DOWNLOAD });
    } catch (error) {
      const cleanMessage = this.sanitizeErrorMessage(error.message);
      
      if (this.shouldRetryWithUserInstall(cleanMessage)) {
        try {
          return await runCommand(pythonCmd, buildInstallArgs({ user: true }), { timeout: TIMEOUTS.DOWNLOAD });
        } catch (userError) {
          const userMessage = this.sanitizeErrorMessage(userError.message);
          if (this.isTomlResolverError(userMessage)) {
            return await runCommand(pythonCmd, buildInstallArgs({ user: true, legacy: true }), { timeout: TIMEOUTS.DOWNLOAD });
          }
          throw new Error(this.formatWhisperInstallError(userMessage));
        }
      }
      
      if (this.isTomlResolverError(cleanMessage)) {
        try {
          return await runCommand(pythonCmd, buildInstallArgs({ legacy: true }), { timeout: TIMEOUTS.DOWNLOAD });
        } catch (legacyError) {
          const legacyMessage = this.sanitizeErrorMessage(legacyError.message);
          if (this.shouldRetryWithUserInstall(legacyMessage)) {
            return await runCommand(pythonCmd, buildInstallArgs({ user: true, legacy: true }), { timeout: TIMEOUTS.DOWNLOAD });
          }
          throw new Error(this.formatWhisperInstallError(legacyMessage));
        }
      }
      
      throw new Error(this.formatWhisperInstallError(cleanMessage));
    }
  }

  async downloadWhisperModel(modelName, progressCallback = null) {
    try {
      const pythonCmd = await this.findPythonExecutable();
      const whisperScriptPath = this.getWhisperScriptPath();

      const args = [
        whisperScriptPath,
        "--mode",
        "download",
        "--model",
        modelName,
      ];

      return new Promise((resolve, reject) => {
        const downloadProcess = spawn(pythonCmd, args);
        this.currentDownloadProcess = downloadProcess; // Store for potential cancellation

        let stdout = "";
        let stderr = "";

        downloadProcess.stdout.on("data", (data) => {
          stdout += data.toString();
        });

        downloadProcess.stderr.on("data", (data) => {
          const output = data.toString();
          stderr += output;

          // Parse progress updates from stderr
          const lines = output.split("\n");
          for (const line of lines) {
            const trimmed = line.trim();
            if (trimmed.startsWith("PROGRESS:")) {
              try {
                const progressData = JSON.parse(trimmed.substring(9));
                if (progressCallback) {
                  progressCallback({
                    type: "progress",
                    model: modelName,
                    ...progressData,
                  });
                }
              } catch (parseError) {
                // Ignore parsing errors for progress data
              }
            }
          }
        });

        downloadProcess.on("close", (code) => {
          this.currentDownloadProcess = null; // Clear process reference

          if (code === 0) {
            try {
              const result = JSON.parse(stdout);
              resolve(result);
            } catch (parseError) {
              console.error("Failed to parse download result:", parseError);
              reject(
                new Error(
                  `Failed to parse download result: ${parseError.message}`
                )
              );
            }
          } else {
            // Handle cancellation cases (SIGTERM, SIGKILL, or null exit codes)
            if (code === 143 || code === 137 || code === null) {
              reject(new Error("Download interrupted by user"));
            } else {
              console.error("Model download failed with code:", code);
              reject(new Error(`Model download failed (exit code ${code})`));
            }
          }
        });

        downloadProcess.on("error", (error) => {
          this.currentDownloadProcess = null;
          console.error("Model download process error:", error);
          reject(new Error(`Model download process error: ${error.message}`));
        });

        const timeout = setTimeout(() => {
          downloadProcess.kill("SIGTERM");
          setTimeout(() => {
            if (!downloadProcess.killed) {
              downloadProcess.kill("SIGKILL");
            }
          }, 5000);
          reject(new Error("Model download timed out (20 minutes)"));
        }, 1200000);

        downloadProcess.on("close", () => {
          clearTimeout(timeout);
        });
      });
    } catch (error) {
      console.error("Model download error:", error);
      throw error;
    }
  }

  async cancelDownload() {
    if (this.currentDownloadProcess) {
      try {
        this.currentDownloadProcess.kill("SIGTERM");
        setTimeout(() => {
          if (
            this.currentDownloadProcess &&
            !this.currentDownloadProcess.killed
          ) {
            this.currentDownloadProcess.kill("SIGKILL");
          }
        }, 3000);
        return { success: true, message: "Download cancelled" };
      } catch (error) {
        console.error("Error cancelling download:", error);
        return { success: false, error: error.message };
      }
    } else {
      return { success: false, error: "No active download to cancel" };
    }
  }

  async checkModelStatus(modelName) {
    try {
      const pythonCmd = await this.findPythonExecutable();
      const whisperScriptPath = this.getWhisperScriptPath();

      const args = [whisperScriptPath, "--mode", "check", "--model", modelName];

      return new Promise((resolve, reject) => {
        const checkProcess = spawn(pythonCmd, args);

        let stdout = "";
        let stderr = "";

        checkProcess.stdout.on("data", (data) => {
          stdout += data.toString();
        });

        checkProcess.stderr.on("data", (data) => {
          stderr += data.toString();
        });

        checkProcess.on("close", (code) => {
          if (code === 0) {
            try {
              const result = JSON.parse(stdout);
              resolve(result);
            } catch (parseError) {
              console.error("Failed to parse model status:", parseError);
              reject(
                new Error(`Failed to parse model status: ${parseError.message}`)
              );
            }
          } else {
            console.error("Model status check failed with code:", code);
            reject(
              new Error(`Model status check failed (code ${code}): ${stderr}`)
            );
          }
        });

        checkProcess.on("error", (error) => {
              reject(new Error(`Model status check error: ${error.message}`));
        });
      });
    } catch (error) {
      throw error;
    }
  }

  async listWhisperModels() {
    try {
      const pythonCmd = await this.findPythonExecutable();
      const whisperScriptPath = this.getWhisperScriptPath();

      const args = [whisperScriptPath, "--mode", "list"];

      return new Promise((resolve, reject) => {
        const listProcess = spawn(pythonCmd, args);

        let stdout = "";
        let stderr = "";

        listProcess.stdout.on("data", (data) => {
          stdout += data.toString();
        });

        listProcess.stderr.on("data", (data) => {
          stderr += data.toString();
        });

        listProcess.on("close", (code) => {
          if (code === 0) {
            try {
              const result = JSON.parse(stdout);
              resolve(result);
            } catch (parseError) {
              console.error("Failed to parse model list:", parseError);
              reject(
                new Error(`Failed to parse model list: ${parseError.message}`)
              );
            }
          } else {
            console.error("Model list failed with code:", code);
            reject(new Error(`Model list failed (code ${code}): ${stderr}`));
          }
        });

        listProcess.on("error", (error) => {
              reject(new Error(`Model list error: ${error.message}`));
        });
      });
    } catch (error) {
      throw error;
    }
  }

  async deleteWhisperModel(modelName) {
    try {
      const pythonCmd = await this.findPythonExecutable();
      const whisperScriptPath = this.getWhisperScriptPath();

      const args = [
        whisperScriptPath,
        "--mode",
        "delete",
        "--model",
        modelName,
      ];

      return new Promise((resolve, reject) => {
        const deleteProcess = spawn(pythonCmd, args);

        let stdout = "";
        let stderr = "";

        deleteProcess.stdout.on("data", (data) => {
          stdout += data.toString();
        });

        deleteProcess.stderr.on("data", (data) => {
          stderr += data.toString();
        });

        deleteProcess.on("close", (code) => {
          if (code === 0) {
            try {
              const result = JSON.parse(stdout);
              resolve(result);
            } catch (parseError) {
              console.error("Failed to parse delete result:", parseError);
              reject(
                new Error(
                  `Failed to parse delete result: ${parseError.message}`
                )
              );
            }
          } else {
            console.error("Model delete failed with code:", code);
            reject(new Error(`Model delete failed (code ${code}): ${stderr}`));
          }
        });

        deleteProcess.on("error", (error) => {
              reject(new Error(`Model delete error: ${error.message}`));
        });
      });
    } catch (error) {
      throw error;
    }
  }
}

module.exports = WhisperManager;
