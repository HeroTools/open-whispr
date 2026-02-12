const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const repoRoot = path.resolve(__dirname, "../..");

function read(relPath) {
  return fs.readFileSync(path.join(repoRoot, relPath), "utf8");
}

test("settings default to local transcription", () => {
  const content = read("src/hooks/useSettings.ts");
  assert.match(content, /useLocalStorage\("useLocalWhisper",\s*true,/);
});

test("signed-in onboarding is not explicitly cloud-first", () => {
  const content = read("src/components/OnboardingFlow.tsx");
  assert.doesNotMatch(content, /cloud-first/i);
});
