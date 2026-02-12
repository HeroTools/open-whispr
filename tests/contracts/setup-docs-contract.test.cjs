const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const repoRoot = path.resolve(__dirname, "../..");

function read(relPath) {
  return fs.readFileSync(path.join(repoRoot, relPath), "utf8");
}

test("README no longer presents npm run setup as primary setup path", () => {
  const readme = read("README.md");

  assert.doesNotMatch(readme, /`npm run setup`\s*-\s*First-time setup/i);
  assert.doesNotMatch(readme, /or use `npm run setup`/i);
});

test("troubleshooting no longer references npm run setup for FFmpeg", () => {
  const troubleshooting = read("TROUBLESHOOTING.md");
  assert.doesNotMatch(troubleshooting, /Run `npm run setup` to verify FFmpeg/i);
});

test("setup script bootstraps from .env.example", () => {
  const setupScript = read("setup.js");

  assert.match(setupScript, /\.env\.example/);
  assert.match(setupScript, /OPENWHISPR_DEV_SERVER_PORT=5191/);
});
