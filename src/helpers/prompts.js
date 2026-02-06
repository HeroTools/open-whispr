const promptData = require("../config/promptData.json");
const languageInstructionsData = require("../config/languageInstructionsData.json");

const UNIFIED_SYSTEM_PROMPT = promptData.UNIFIED_SYSTEM_PROMPT;
const DICTIONARY_SUFFIX = promptData.DICTIONARY_SUFFIX;

function getLanguageInstruction(language) {
  if (!language || language === "en") return "";
  if (languageInstructionsData[language]) return languageInstructionsData[language];
  const template = languageInstructionsData["_genericTemplate"] || "";
  return template.replace("{{code}}", language);
}

function getSystemPrompt(agentName, customDictionary, language) {
  const name = (agentName && agentName.trim()) || "Assistant";
  let prompt = UNIFIED_SYSTEM_PROMPT.replace(/\{\{agentName\}\}/g, name);

  const langInstruction = getLanguageInstruction(language);
  if (langInstruction) {
    prompt += "\n\n" + langInstruction;
  }

  if (Array.isArray(customDictionary) && customDictionary.length > 0) {
    prompt += DICTIONARY_SUFFIX + customDictionary.join(", ");
  }

  return prompt;
}

function buildPrompt(text, agentName) {
  const systemPrompt = getSystemPrompt(agentName);
  return `${systemPrompt}\n\n${text}`;
}

module.exports = {
  UNIFIED_SYSTEM_PROMPT,
  getSystemPrompt,
  buildPrompt,
};
