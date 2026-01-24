const path = require("path");
const fs = require("fs");
const { app } = require("electron");

class EnvironmentManager {
  constructor() {
    this.loadEnvironmentVariables();
    this.configPath = path.join(app.getPath("userData"), "config.json");
    this.config = this.loadConfig();
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

  // NEW: Dictation (transcription) API keys
  getDictationOpenAIKey() {
    return this._getKey("DICTATION_OPENAI_API_KEY");
  }

  saveDictationOpenAIKey(key) {
    return this._saveKey("DICTATION_OPENAI_API_KEY", key);
  }

  getDictationGroqKey() {
    return this._getKey("DICTATION_GROQ_API_KEY");
  }

  saveDictationGroqKey(key) {
    return this._saveKey("DICTATION_GROQ_API_KEY", key);
  }

  getDictationCustomKey() {
    return this._getKey("DICTATION_CUSTOM_API_KEY");
  }

  saveDictationCustomKey(key) {
    return this._saveKey("DICTATION_CUSTOM_API_KEY", key);
  }

  // NEW: Reasoning (post-processing) API keys
  getReasoningOpenAIKey() {
    return this._getKey("REASONING_OPENAI_API_KEY");
  }

  saveReasoningOpenAIKey(key) {
    return this._saveKey("REASONING_OPENAI_API_KEY", key);
  }

  getReasoningAnthropicKey() {
    return this._getKey("REASONING_ANTHROPIC_API_KEY");
  }

  saveReasoningAnthropicKey(key) {
    return this._saveKey("REASONING_ANTHROPIC_API_KEY", key);
  }

  getReasoningGeminiKey() {
    return this._getKey("REASONING_GEMINI_API_KEY");
  }

  saveReasoningGeminiKey(key) {
    return this._saveKey("REASONING_GEMINI_API_KEY", key);
  }

  getReasoningGroqKey() {
    return this._getKey("REASONING_GROQ_API_KEY");
  }

  saveReasoningGroqKey(key) {
    return this._saveKey("REASONING_GROQ_API_KEY", key);
  }

  getReasoningCustomKey() {
    return this._getKey("REASONING_CUSTOM_API_KEY");
  }

  saveReasoningCustomKey(key) {
    return this._saveKey("REASONING_CUSTOM_API_KEY", key);
  }

  // LEGACY: Keep for backward compatibility
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

# Dictation (transcription) API Keys
`;

    if (process.env.DICTATION_OPENAI_API_KEY) {
      envContent += `DICTATION_OPENAI_API_KEY=${process.env.DICTATION_OPENAI_API_KEY}\n`;
    }
    if (process.env.DICTATION_GROQ_API_KEY) {
      envContent += `DICTATION_GROQ_API_KEY=${process.env.DICTATION_GROQ_API_KEY}\n`;
    }
    if (process.env.DICTATION_CUSTOM_API_KEY) {
      envContent += `DICTATION_CUSTOM_API_KEY=${process.env.DICTATION_CUSTOM_API_KEY}\n`;
    }

    envContent += `\n# Reasoning (post-processing) API Keys\n`;

    if (process.env.REASONING_OPENAI_API_KEY) {
      envContent += `REASONING_OPENAI_API_KEY=${process.env.REASONING_OPENAI_API_KEY}\n`;
    }
    if (process.env.REASONING_ANTHROPIC_API_KEY) {
      envContent += `REASONING_ANTHROPIC_API_KEY=${process.env.REASONING_ANTHROPIC_API_KEY}\n`;
    }
    if (process.env.REASONING_GEMINI_API_KEY) {
      envContent += `REASONING_GEMINI_API_KEY=${process.env.REASONING_GEMINI_API_KEY}\n`;
    }
    if (process.env.REASONING_GROQ_API_KEY) {
      envContent += `REASONING_GROQ_API_KEY=${process.env.REASONING_GROQ_API_KEY}\n`;
    }
    if (process.env.REASONING_CUSTOM_API_KEY) {
      envContent += `REASONING_CUSTOM_API_KEY=${process.env.REASONING_CUSTOM_API_KEY}\n`;
    }

    // LEGACY keys (for backward compatibility)
    envContent += `\n# Legacy API Keys (backward compatibility)\n`;

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

    fs.writeFileSync(envPath, envContent, "utf8");

    // Reload the env file
    require("dotenv").config({ path: envPath });

    return { success: true, path: envPath };
  }

  // Configuration file management
  loadConfig() {
    try {
      if (fs.existsSync(this.configPath)) {
        const data = fs.readFileSync(this.configPath, "utf8");
        return JSON.parse(data);
      }
    } catch (error) {
      console.error("Failed to load config:", error);
    }
    return {};
  }

  saveConfig() {
    try {
      fs.writeFileSync(this.configPath, JSON.stringify(this.config, null, 2), "utf8");
      return { success: true };
    } catch (error) {
      console.error("Failed to save config:", error);
      return { success: false, error: error.message };
    }
  }

  // Hotkey management
  getHotkey() {
    return this.config.hotkey || "";
  }

  saveHotkey(hotkey) {
    this.config.hotkey = hotkey;
    return this.saveConfig();
  }
}

module.exports = EnvironmentManager;
