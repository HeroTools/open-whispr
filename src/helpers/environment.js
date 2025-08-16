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
      return { success: true };
    } catch (error) {
      console.error("Error saving OpenAI API key:", error.message);
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
      return { success: true };
    } catch (error) {
      console.error("Error saving Anthropic API key:", error.message);
      throw error;
    }
  }

  createProductionEnvFile(apiKey) {
    try {
      const envPath = path.join(app.getPath("userData"), ".env");

      const envContent = `# OpenWispr Environment Variables
# This file was created automatically for production use
OPENAI_API_KEY=${apiKey}
`;

      fs.writeFileSync(envPath, envContent, "utf8");

      require("dotenv").config({ path: envPath });

      return { success: true, path: envPath };
    } catch (error) {
      console.error("Error creating production .env file:", error.message);
      throw error;
    }
  }
}

module.exports = EnvironmentManager;
