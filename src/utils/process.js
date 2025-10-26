const { spawn } = require("child_process");

// Timeout constants
const TIMEOUTS = {
  QUICK_CHECK: 5000, // 5 seconds for quick checks
  COMMAND: 30000, // 30 seconds for general commands
  INSTALL: 300000, // 5 minutes for installations
  DOWNLOAD: 600000, // 10 minutes for downloads
  PIP_UPGRADE: 60000, // 1 minute for pip upgrade
};

// Command whitelist for shell operations
const SAFE_SHELL_COMMANDS = new Set(["brew", "apt", "yum", "pacman"]);

/**
 * Validate command arguments for safety
 * @param {string} cmd - Command to validate
 * @param {string[]} args - Arguments to validate
 * @param {boolean} shell - Whether shell is being used
 * @throws {Error} If validation fails
 */
function validateCommand(cmd, args, shell) {
  // Reject shell usage for non-whitelisted commands
  if (shell && !SAFE_SHELL_COMMANDS.has(cmd)) {
    throw new Error(`Shell execution not allowed for command: ${cmd}`);
  }

  // Check for dangerous characters in arguments
  const dangerousChars = /[;&|`$<>]/;
  if (args.some((arg) => dangerousChars.test(arg))) {
    throw new Error("Command arguments contain potentially dangerous characters");
  }
}

/**
 * Run a command with proper error handling and timeout
 * @param {string} cmd - Command to run
 * @param {string[]} args - Command arguments
 * @param {Object} options - Options object
 * @param {number} options.timeout - Timeout in milliseconds
 * @param {boolean} options.shell - Whether to use shell (avoid unless necessary)
 * @returns {Promise<{success: boolean, output: string}>}
 */
async function runCommand(cmd, args = [], options = {}) {
  const { timeout = TIMEOUTS.COMMAND, shell = false } = options;

  // Validate command for security
  validateCommand(cmd, args, shell);

  return new Promise((resolve, reject) => {
    let process;
    let stdout = "";
    let stderr = "";
    let completed = false;
    let timer;

    try {
      process = spawn(cmd, args, { shell });
    } catch (error) {
      reject(error);
      return;
    }

    const cleanup = () => {
      if (timer) {
        clearTimeout(timer);
        timer = null;
      }
      if (process && !completed) {
        completed = true;
        try {
          process.kill("SIGTERM");
          // Force kill after 5 seconds if still running
          setTimeout(() => {
            if (process.exitCode === null) {
              process.kill("SIGKILL");
            }
          }, 5000);
        } catch (e) {
          // Process already dead
        }
      }
    };

    timer = setTimeout(() => {
      cleanup();
      reject(new Error(`Command timed out after ${timeout}ms`));
    }, timeout);

    process.stdout.on("data", (data) => {
      stdout += data.toString();
    });

    process.stderr.on("data", (data) => {
      stderr += data.toString();
    });

    process.on("close", (code) => {
      if (completed) return; // Already handled
      completed = true;
      clearTimeout(timer);

      if (code === 0) {
        resolve({ success: true, output: stdout });
      } else {
        reject(new Error(stderr || `Command failed with code ${code}`));
      }
    });

    process.on("error", (error) => {
      if (completed) return; // Already handled
      completed = true;
      cleanup();
      reject(error);
    });
  });
}

module.exports = {
  runCommand,
  TIMEOUTS,
};
