const path = require("path");
const fs = require("fs");
const { app } = require("electron");

class EnvironmentManager {
  constructor() {
    this.loadEnvironmentVariables();
  }

  loadEnvironmentVariables() {
    // In production, try multiple locations for .env file
    const possibleEnvPaths = [
      // Development path
      path.join(__dirname, "..", ".env"),
      // Production packaged app paths
      path.join(process.resourcesPath, ".env"),
      path.join(process.resourcesPath, "app.asar.unpacked", ".env"),
      path.join(app.getPath("userData"), ".env"), // User data directory
      // Legacy paths
      path.join(process.resourcesPath, "app", ".env"),
    ];

    for (const envPath of possibleEnvPaths) {
      try {
        if (fs.existsSync(envPath)) {
          const result = require("dotenv").config({ path: envPath });
          if (!result.error) {
            break;
          }
        }
      } catch (error) {
        // Continue to next path
      }
    }
  }

  _getKey(envVarName) {
    return process.env[envVarName] || "";
  }

  _saveKey(envVarName, key) {
    process.env[envVarName] = key;
    return { success: true };
  }

  getOpenAIKey() {
    return this._getKey("OPENAI_API_KEY");
  }

  saveOpenAIKey(key) {
    return this._saveKey("OPENAI_API_KEY", key);
  }

  getAnthropicKey() {
    return this._getKey("ANTHROPIC_API_KEY");
  }

  saveAnthropicKey(key) {
    return this._saveKey("ANTHROPIC_API_KEY", key);
  }

  getGeminiKey() {
    return this._getKey("GEMINI_API_KEY");
  }

  saveGeminiKey(key) {
    return this._saveKey("GEMINI_API_KEY", key);
  }

  getGroqKey() {
    return this._getKey("GROQ_API_KEY");
  }

  saveGroqKey(key) {
    return this._saveKey("GROQ_API_KEY", key);
  }

  getCustomTranscriptionKey() {
    return this._getKey("CUSTOM_TRANSCRIPTION_API_KEY");
  }

  saveCustomTranscriptionKey(key) {
    return this._saveKey("CUSTOM_TRANSCRIPTION_API_KEY", key);
  }

  getCustomReasoningKey() {
    return this._getKey("CUSTOM_REASONING_API_KEY");
  }

  saveCustomReasoningKey(key) {
    return this._saveKey("CUSTOM_REASONING_API_KEY", key);
  }

  createProductionEnvFile(apiKey) {
    const envPath = path.join(app.getPath("userData"), ".env");

    const envContent = `# OpenWhispr Environment Variables
# This file was created automatically for production use
OPENAI_API_KEY=${apiKey}
`;

    fs.writeFileSync(envPath, envContent, "utf8");

    require("dotenv").config({ path: envPath });

    return { success: true, path: envPath };
  }

  saveAllKeysToEnvFile() {
    const envPath = path.join(app.getPath("userData"), ".env");

    // Build env content with all current keys
    let envContent = `# OpenWhispr Environment Variables
# This file was created automatically for production use
`;

    if (process.env.OPENAI_API_KEY) {
      envContent += `OPENAI_API_KEY=${process.env.OPENAI_API_KEY}\n`;
    }
    if (process.env.ANTHROPIC_API_KEY) {
      envContent += `ANTHROPIC_API_KEY=${process.env.ANTHROPIC_API_KEY}\n`;
    }
    if (process.env.GEMINI_API_KEY) {
      envContent += `GEMINI_API_KEY=${process.env.GEMINI_API_KEY}\n`;
    }
    if (process.env.GROQ_API_KEY) {
      envContent += `GROQ_API_KEY=${process.env.GROQ_API_KEY}\n`;
    }
    if (process.env.CUSTOM_TRANSCRIPTION_API_KEY) {
      envContent += `CUSTOM_TRANSCRIPTION_API_KEY=${process.env.CUSTOM_TRANSCRIPTION_API_KEY}\n`;
    }
    if (process.env.CUSTOM_REASONING_API_KEY) {
      envContent += `CUSTOM_REASONING_API_KEY=${process.env.CUSTOM_REASONING_API_KEY}\n`;
    }
    if (process.env.LOCAL_TRANSCRIPTION_PROVIDER) {
      envContent += `LOCAL_TRANSCRIPTION_PROVIDER=${process.env.LOCAL_TRANSCRIPTION_PROVIDER}\n`;
    }
    if (process.env.PARAKEET_MODEL) {
      envContent += `PARAKEET_MODEL=${process.env.PARAKEET_MODEL}\n`;
    }

    fs.writeFileSync(envPath, envContent, "utf8");

    // Reload the env file
    require("dotenv").config({ path: envPath });

    return { success: true, path: envPath };
  }
}

module.exports = EnvironmentManager;
