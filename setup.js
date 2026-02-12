const fs = require("fs");
const path = require("path");

console.log("Setting up OpenWhispr local environment...");

const envPath = path.join(process.cwd(), ".env");
const envExamplePath = path.join(process.cwd(), ".env.example");

const fallbackTemplate = `# Local-first development defaults
VITE_DEV_SERVER_PORT=5191
OPENWHISPR_DEV_SERVER_PORT=5191

# Optional cloud provider keys (keep commented unless needed)
# OPENAI_API_KEY=your_openai_api_key_here
# ANTHROPIC_API_KEY=your_anthropic_api_key_here
# GEMINI_API_KEY=your_gemini_api_key_here
# GROQ_API_KEY=your_groq_api_key_here
# MISTRAL_API_KEY=your_mistral_api_key_here

# Optional debug logging
# OPENWHISPR_LOG_LEVEL=debug
`;

if (!fs.existsSync(envPath)) {
  if (fs.existsSync(envExamplePath)) {
    fs.copyFileSync(envExamplePath, envPath);
    console.log("✅ Created .env from .env.example");
  } else {
    fs.writeFileSync(envPath, fallbackTemplate, "utf8");
    console.log("⚠️  .env.example not found, created fallback .env template");
  }
} else {
  console.log("⚠️  .env file already exists (left unchanged)");
}

console.log(`
🎉 Setup complete!

Recommended next steps:
1. Install dependencies: npm ci
2. Download local binaries:
   - npm run download:whisper-cpp
   - npm run download:llama-server
   - npm run download:sherpa-onnx
3. Run local preflight checks: npm run doctor:local
4. Start development: npm run dev

Notes:
- This setup is local-first and privacy-focused by default.
- Cloud keys stay disabled until you uncomment and set them in .env.
`);
