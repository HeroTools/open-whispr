import promptData from "./promptData.json";
import { getLanguageInstruction } from "../utils/languageSupport";
import { Agent } from "../types/agent";

export const UNIFIED_SYSTEM_PROMPT = promptData.UNIFIED_SYSTEM_PROMPT;
export const LEGACY_PROMPTS = promptData.LEGACY_PROMPTS;
const DICTIONARY_SUFFIX = promptData.DICTIONARY_SUFFIX;

export function buildPrompt(text: string, agentName: string | null): string {
  const name = agentName?.trim() || "Assistant";
  return UNIFIED_SYSTEM_PROMPT.replace(/\{\{agentName\}\}/g, name).replace(/\{\{text\}\}/g, text);
}

/**
 * Génère le prompt système pour un agent
 * @param agent - Objet agent complet (ou null pour utiliser le nom par défaut)
 * @param customDictionary - Dictionnaire personnalisé de mots
 * @param language - Code de langue pour instructions spécifiques
 * @returns Le prompt système complet
 */
export function getSystemPrompt(
  agent: Agent | null,
  customDictionary?: string[],
  language?: string
): string {
  const name = agent?.name?.trim() || "Assistant";

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

  const langInstruction = getLanguageInstruction(language);
  if (langInstruction) {
    prompt += "\n\n" + langInstruction;
  }

  // Ajouter les instructions personnalisées de l'agent
  if (agent?.customInstructions?.trim()) {
    prompt += "\n\nADDITIONAL AGENT INSTRUCTIONS:\n" + agent.customInstructions.trim();
  }

  if (customDictionary && customDictionary.length > 0) {
    prompt += DICTIONARY_SUFFIX + customDictionary.join(", ");
  }

  return prompt;
}

/**
 * Version legacy pour compatibilité - accepte string ou Agent
 */
export function getSystemPromptLegacy(
  agentNameOrAgent: string | Agent | null,
  customDictionary?: string[],
  language?: string
): string {
  if (typeof agentNameOrAgent === 'string' || agentNameOrAgent === null) {
    // Compatibilité avec l'ancien système
    return getSystemPrompt(null, customDictionary, language);
  }
  return getSystemPrompt(agentNameOrAgent, customDictionary, language);
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
