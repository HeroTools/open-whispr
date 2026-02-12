const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const repoRoot = path.resolve(__dirname, "../..");

function read(relPath) {
  return fs.readFileSync(path.join(repoRoot, relPath), "utf8");
}

test("env template keeps cloud keys commented by default", () => {
  const envExample = read(".env.example");

  assert.match(envExample, /^# OPENAI_API_KEY=/m);
  assert.match(envExample, /^# ANTHROPIC_API_KEY=/m);
  assert.match(envExample, /^# GEMINI_API_KEY=/m);
  assert.match(envExample, /^# GROQ_API_KEY=/m);
  assert.match(envExample, /^# MISTRAL_API_KEY=/m);
});

test("env template pins local dev ports and keeps debug optional", () => {
  const envExample = read(".env.example");

  assert.match(envExample, /^VITE_DEV_SERVER_PORT=5191$/m);
  assert.match(envExample, /^OPENWHISPR_DEV_SERVER_PORT=5191$/m);
  assert.match(envExample, /^# OPENWHISPR_LOG_LEVEL=debug$/m);
});
