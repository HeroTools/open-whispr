/**
 * Utility for parsing llama.cpp CLI output.
 * Extracts only the generated text, filtering out diagnostic messages and system noise.
 */

// Patterns that indicate diagnostic/system output to filter out
const DIAGNOSTIC_PATTERNS = [
  /^llama_/i,
  /^ggml_/i,
  /^log_/i,
  /^main:/i,
  /^sampling:/i,
  /^generate:/i,
  /^system_info:/i,
  /^\s*load time\s*=/i,
  /^\s*sample time\s*=/i,
  /^\s*prompt eval time\s*=/i,
  /^\s*eval time\s*=/i,
  /^\s*total time\s*=/i,
  /^Log start$/i,
  /^build: \d+/i,
  /^n_threads/i,
  /^Using .* backend/i,
  /^\s*\d+\s+tokens?\s+/i,
];

// Special end tokens that models may output
const END_TOKEN_PATTERNS = [/<\|im_end\|>$/, /<\|end\|>$/, /<\/s>$/, /\[end of text\]$/i];

/**
 * Parse llama.cpp output to extract only the generated text.
 * Filters out diagnostic messages, timing stats, and other noise.
 * @param {string} rawOutput - Raw output from llama.cpp CLI
 * @returns {string} Cleaned output containing only generated text
 */
function parseLlamaCppOutput(rawOutput) {
  if (!rawOutput) return "";

  const lines = rawOutput.split("\n");
  const filteredLines = [];

  for (const line of lines) {
    const trimmedLine = line.trim();

    // Skip empty lines at the start (but keep them in the middle of content)
    if (filteredLines.length === 0 && !trimmedLine) {
      continue;
    }

    // Check if line matches any diagnostic pattern
    const isDiagnostic = DIAGNOSTIC_PATTERNS.some((pattern) => pattern.test(trimmedLine));

    if (!isDiagnostic) {
      filteredLines.push(line);
    }
  }

  // Trim trailing empty lines
  let result = filteredLines.join("\n").trim();

  // Remove common end tokens if they appear at the very end
  for (const pattern of END_TOKEN_PATTERNS) {
    result = result.replace(pattern, "").trim();
  }

  return result;
}

module.exports = {
  parseLlamaCppOutput,
  DIAGNOSTIC_PATTERNS,
  END_TOKEN_PATTERNS,
};
