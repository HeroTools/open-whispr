#!/usr/bin/env node
"use strict";

const fs = require("fs");
const os = require("os");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");
const HOME = os.homedir();
const PLATFORM_ARCH = `${process.platform}-${process.arch}`;

const FILES = {
  env: path.join(ROOT, ".env"),
  envExample: path.join(ROOT, ".env.example"),
  viteConfig: path.join(ROOT, "src", "vite.config.mjs"),
  devServerManager: path.join(ROOT, "src", "helpers", "devServerManager.js"),
  neonAuth: path.join(ROOT, "src", "lib", "neonAuth.ts"),
  whisperDownload: path.join(ROOT, "scripts", "download-whisper-cpp.js"),
  sherpaDownload: path.join(ROOT, "scripts", "download-sherpa-onnx.js"),
  llamaDownload: path.join(ROOT, "scripts", "download-llama-server.js"),
  runElectron: path.join(ROOT, "scripts", "run-electron.js"),
  binDir: path.join(ROOT, "resources", "bin"),
};

const CACHE_DIRS = {
  whisper: path.join(HOME, ".cache", "openwhispr", "whisper-models"),
  parakeet: path.join(HOME, ".cache", "openwhispr", "parakeet-models"),
  llm: path.join(HOME, ".cache", "openwhispr", "models"),
};

const BINARIES = {
  "win32-x64": {
    whisper: "whisper-server-win32-x64.exe",
    sherpa: "sherpa-onnx-ws-win32-x64.exe",
    llama: "llama-server-win32-x64.exe",
  },
  "darwin-arm64": {
    whisper: "whisper-server-darwin-arm64",
    sherpa: "sherpa-onnx-ws-darwin-arm64",
    llama: "llama-server-darwin-arm64",
  },
  "darwin-x64": {
    whisper: "whisper-server-darwin-x64",
    sherpa: "sherpa-onnx-ws-darwin-x64",
    llama: "llama-server-darwin-x64",
  },
  "linux-x64": {
    whisper: "whisper-server-linux-x64",
    sherpa: "sherpa-onnx-ws-linux-x64",
    llama: "llama-server-linux-x64",
  },
};

function exists(filePath) {
  try {
    fs.accessSync(filePath, fs.constants.F_OK);
    return true;
  } catch {
    return false;
  }
}

function readText(filePath) {
  try {
    return fs.readFileSync(filePath, "utf8");
  } catch {
    return "";
  }
}

function parseEnv(filePath) {
  const env = {};
  for (const rawLine of readText(filePath).split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) {
      continue;
    }

    const equalsIndex = line.indexOf("=");
    if (equalsIndex <= 0) {
      continue;
    }

    const key = line.slice(0, equalsIndex).trim();
    env[key] = line.slice(equalsIndex + 1).trim();
  }

  return env;
}

function findFirstMatch(text, regex) {
  const match = text.match(regex);
  return match ? match[1] : null;
}

function printStatus(ok, label, details = "") {
  const icon = ok ? "[PASS]" : "[WARN]";
  if (details) {
    console.log(`${icon} ${label} - ${details}`);
    return;
  }

  console.log(`${icon} ${label}`);
}

function countEntries(dirPath, filterFn) {
  try {
    return fs.readdirSync(dirPath).filter(filterFn).length;
  } catch {
    return 0;
  }
}

function main() {
  console.log("OpenWhispr Local Doctor");
  console.log(`Platform: ${PLATFORM_ARCH}`);
  console.log("");

  printStatus(exists(FILES.whisperDownload), "download-whisper-cpp script", FILES.whisperDownload);
  printStatus(exists(FILES.sherpaDownload), "download-sherpa-onnx script", FILES.sherpaDownload);
  printStatus(exists(FILES.llamaDownload), "download-llama-server script", FILES.llamaDownload);
  printStatus(exists(FILES.runElectron), "run-electron wrapper", FILES.runElectron);

  const mapped = BINARIES[PLATFORM_ARCH];
  if (!mapped) {
    printStatus(false, "platform binary mapping", `Unsupported ${PLATFORM_ARCH}`);
  } else {
    printStatus(exists(path.join(FILES.binDir, mapped.whisper)), "whisper-server binary");
    printStatus(exists(path.join(FILES.binDir, mapped.sherpa)), "sherpa-onnx ws binary");
    printStatus(
      exists(path.join(FILES.binDir, mapped.llama)),
      "llama-server binary (optional for local reasoning)"
    );
  }

  const whisperCount = countEntries(CACHE_DIRS.whisper, (entry) => /^ggml-.*\.bin$/i.test(entry));
  const ggufCount = countEntries(CACHE_DIRS.llm, (entry) => /\.gguf$/i.test(entry));
  const parakeetCount = countEntries(CACHE_DIRS.parakeet, (entry) => {
    const modelDir = path.join(CACHE_DIRS.parakeet, entry);
    return (
      exists(path.join(modelDir, "encoder.int8.onnx")) &&
      exists(path.join(modelDir, "decoder.int8.onnx")) &&
      exists(path.join(modelDir, "joiner.int8.onnx")) &&
      exists(path.join(modelDir, "tokens.txt"))
    );
  });

  printStatus(
    whisperCount > 0,
    "whisper model cache",
    `${CACHE_DIRS.whisper} (${whisperCount} file(s))`
  );
  printStatus(
    parakeetCount > 0,
    "parakeet model cache",
    `${CACHE_DIRS.parakeet} (${parakeetCount} model dir(s))`
  );
  printStatus(
    ggufCount > 0,
    "local reasoning model cache (optional)",
    `${CACHE_DIRS.llm} (${ggufCount} gguf file(s))`
  );

  const envValues = parseEnv(FILES.env);
  const vitePort = envValues.VITE_DEV_SERVER_PORT;
  const mainPort = envValues.OPENWHISPR_DEV_SERVER_PORT;
  printStatus(exists(FILES.env), "project .env file", FILES.env);
  printStatus(
    Boolean(vitePort && mainPort),
    "dev ports configured",
    `VITE=${vitePort || "<unset>"} OPENWHISPR=${mainPort || "<unset>"}`
  );
  printStatus(
    Boolean(vitePort && mainPort && vitePort === mainPort),
    "dev ports match",
    "Vite and Electron should use same port"
  );

  const viteConfig = readText(FILES.viteConfig);
  const managerConfig = readText(FILES.devServerManager);
  const neonAuth = readText(FILES.neonAuth);

  const viteDefaultPort = findFirstMatch(viteConfig, /DEFAULT_DEV_SERVER_PORT\s*=\s*(\d+)/);
  const managerDefaultPort = findFirstMatch(managerConfig, /DEFAULT_DEV_SERVER_PORT\s*=\s*(\d+)/);
  const neonDefaultPort = findFirstMatch(
    neonAuth,
    /VITE_DEV_SERVER_PORT\s*\|\|\s*import\.meta\.env\.OPENWHISPR_DEV_SERVER_PORT\s*\|\|\s*"(\d+)"/
  );

  printStatus(Boolean(viteDefaultPort), "vite default dev port", viteDefaultPort || "not found");
  printStatus(
    Boolean(managerDefaultPort),
    "main-process default dev port",
    managerDefaultPort || "not found"
  );
  printStatus(
    Boolean(neonDefaultPort),
    "neon callback fallback port",
    neonDefaultPort || "not found"
  );

  printStatus(exists(FILES.envExample), ".env.example exists", FILES.envExample);
}

main();
