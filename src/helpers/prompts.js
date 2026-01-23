const promptData = require("../config/promptData.json");

const UNIFIED_SYSTEM_PROMPT = promptData.UNIFIED_SYSTEM_PROMPT;

function getSystemPrompt(agentName) {
  const name = (agentName && agentName.trim()) || "Assistant";
  return UNIFIED_SYSTEM_PROMPT.replace(/\{\{agentName\}\}/g, name);
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
