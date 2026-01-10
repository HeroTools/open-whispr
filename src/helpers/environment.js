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

    let envLoaded = false;

    for (const envPath of possibleEnvPaths) {
      try {
        if (fs.existsSync(envPath)) {
          const result = require("dotenv").config({ path: envPath });
          if (!result.error) {
            envLoaded = true;
            break;
          }
        }
      } catch (error) {
        // Continue to next path
      }
    }
  }

  getOpenAIKey() {
    const apiKey = process.env.OPENAI_API_KEY;
    return apiKey || "";
  }

  saveOpenAIKey(key) {
    try {
      // Update the environment variable in memory for immediate use
      process.env.OPENAI_API_KEY = key;
      // Persist all keys to file
      this.saveAllKeysToEnvFile();
      return { success: true };
    } catch (error) {
      // Silent error - already throwing
      throw error;
    }
  }

  getAnthropicKey() {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    return apiKey || "";
  }

  saveAnthropicKey(key) {
    try {
      // Update the environment variable in memory for immediate use
      process.env.ANTHROPIC_API_KEY = key;
      // Persist all keys to file
      this.saveAllKeysToEnvFile();
      return { success: true };
    } catch (error) {
      // Silent error - already throwing
      throw error;
    }
  }

  getGeminiKey() {
    const apiKey = process.env.GEMINI_API_KEY;
    return apiKey || "";
  }

  saveGeminiKey(key) {
    try {
      // Update the environment variable in memory for immediate use
      process.env.GEMINI_API_KEY = key;
      // Persist all keys to file
      this.saveAllKeysToEnvFile();
      return { success: true };
    } catch (error) {
      // Silent error - already throwing
      throw error;
    }
  }

  getGroqKey() {
    const apiKey = process.env.GROQ_API_KEY;
    return apiKey || "";
  }

  saveGroqKey(key) {
    try {
      // Update the environment variable in memory for immediate use
      process.env.GROQ_API_KEY = key;
      // Persist all keys to file
      this.saveAllKeysToEnvFile();
      return { success: true };
    } catch (error) {
      // Silent error - already throwing
      throw error;
    }
  }

  createProductionEnvFile(apiKey) {
    try {
      const envPath = path.join(app.getPath("userData"), ".env");

      const envContent = `# OpenWhispr Environment Variables
# This file was created automatically for production use
OPENAI_API_KEY=${apiKey}
`;

      fs.writeFileSync(envPath, envContent, "utf8");

      require("dotenv").config({ path: envPath });

      return { success: true, path: envPath };
    } catch (error) {
      // Silent error - already throwing
      throw error;
    }
  }

  saveAllKeysToEnvFile() {
    try {
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

      fs.writeFileSync(envPath, envContent, "utf8");

      // Reload the env file
      require("dotenv").config({ path: envPath });

      return { success: true, path: envPath };
    } catch (error) {
      throw error;
    }
  }
}

module.exports = EnvironmentManager;
