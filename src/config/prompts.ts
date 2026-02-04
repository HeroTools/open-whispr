import promptData from "./promptData.json";

export const UNIFIED_SYSTEM_PROMPT = promptData.UNIFIED_SYSTEM_PROMPT;
export const LEGACY_PROMPTS = promptData.LEGACY_PROMPTS;
const DICTIONARY_SUFFIX = promptData.DICTIONARY_SUFFIX;

export function buildPrompt(text: string, agentName: string | null): string {
  const name = agentName?.trim() || "Assistant";
  return UNIFIED_SYSTEM_PROMPT.replace(/\{\{agentName\}\}/g, name).replace(/\{\{text\}\}/g, text);
}

export function getSystemPrompt(agentName: string | null, customDictionary?: string[]): string {
  const name = agentName?.trim() || "Assistant";

  let promptTemplate = UNIFIED_SYSTEM_PROMPT;
  if (typeof window !== "undefined" && window.localStorage) {
    const customPrompt = window.localStorage.getItem("customUnifiedPrompt");
    if (customPrompt) {
      try {
        promptTemplate = JSON.parse(customPrompt);
      } catch {
        // Use default if parsing fails
      }
    }
  }

  let prompt = promptTemplate.replace(/\{\{agentName\}\}/g, name);

  if (customDictionary && customDictionary.length > 0) {
    prompt += DICTIONARY_SUFFIX + customDictionary.join(", ");
  }

  return prompt;
}

export function getUserPrompt(text: string): string {
  return text;
}

export default {
  UNIFIED_SYSTEM_PROMPT,
  buildPrompt,
  getSystemPrompt,
  getUserPrompt,
  LEGACY_PROMPTS,
};
