const fs = require("fs");

console.log("Setting up OpenWhispr...");

const envTemplate = `# OpenAI API Configuration
# Get your API key from: https://platform.openai.com/api-keys
OPENAI_API_KEY=your_openai_api_key_here

# Optional: Customize the Whisper model
# Available models: whisper-1 (default), whisper-1-large, whisper-1-large-v2
WHISPER_MODEL=whisper-1

# Optional: Set language for better transcription accuracy
# Leave empty for auto-detection, or use language codes like 'en', 'es', 'fr', etc.
LANGUAGE=

# Optional: Debug mode (set to 'true' to enable verbose logging)
DEBUG=false`;

if (!fs.existsSync(".env")) {
  fs.writeFileSync(".env", envTemplate);
  console.log("✅ Created .env file template");
} else {
  console.log("⚠️  .env file already exists");
}

console.log(`
🎉 Setup complete!

Next steps:
1. Add your OpenAI API key to the .env file
2. Install dependencies: npm install
3. Run the app: npm start

Features:
- Global hotkey: Customizable (default: backtick \`) - set your own in Control Panel
- Draggable dictation panel: Click and drag to position anywhere on screen
- ESC to close the app
- Automatic text pasting at cursor location
- FFmpeg bundled (no separate installation needed)

Note: Make sure you have the necessary system permissions for:
- Microphone access
- Accessibility permissions (for text pasting)

For local Whisper processing, OpenWhispr uses whisper.cpp (bundled with the app).
Models are downloaded automatically on first use.
`);
