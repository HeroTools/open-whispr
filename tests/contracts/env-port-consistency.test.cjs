const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const repoRoot = path.resolve(__dirname, "../..");

function read(relPath) {
  return fs.readFileSync(path.join(repoRoot, relPath), "utf8");
}

test("vite and main-process dev server defaults use port 5191", () => {
  const viteConfig = read("src/vite.config.mjs");
  const devServerManager = read("src/helpers/devServerManager.js");

  assert.match(viteConfig, /DEFAULT_DEV_SERVER_PORT\s*=\s*5191/);
  assert.match(devServerManager, /DEFAULT_DEV_SERVER_PORT\s*=\s*5191/);
});

test("neon auth callback fallback supports OPENWHISPR_DEV_SERVER_PORT", () => {
  const neonAuth = read("src/lib/neonAuth.ts");

  assert.match(
    neonAuth,
    /VITE_DEV_SERVER_PORT\s*\|\|\s*import\.meta\.env\.OPENWHISPR_DEV_SERVER_PORT\s*\|\|\s*"5191"/
  );
});
