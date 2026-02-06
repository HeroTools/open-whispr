import languageInstructionsData from "../config/languageInstructionsData.json";

// STT model language support sets
const WHISPER_LANGUAGES = new Set([
  "af",
  "ar",
  "hy",
  "az",
  "be",
  "bs",
  "bg",
  "ca",
  "zh",
  "hr",
  "cs",
  "da",
  "nl",
  "en",
  "et",
  "fi",
  "fr",
  "gl",
  "de",
  "el",
  "he",
  "hi",
  "hu",
  "is",
  "id",
  "it",
  "ja",
  "kn",
  "kk",
  "ko",
  "lv",
  "lt",
  "mk",
  "ms",
  "mr",
  "mi",
  "ne",
  "no",
  "fa",
  "pl",
  "pt",
  "ro",
  "ru",
  "sr",
  "sk",
  "sl",
  "es",
  "sw",
  "sv",
  "tl",
  "ta",
  "th",
  "tr",
  "uk",
  "ur",
  "vi",
  "cy",
]);

const PARAKEET_LANGUAGES = new Set([
  "bg",
  "hr",
  "cs",
  "da",
  "nl",
  "en",
  "et",
  "fi",
  "fr",
  "de",
  "el",
  "hu",
  "it",
  "lv",
  "lt",
  "mt",
  "pl",
  "pt",
  "ro",
  "sk",
  "sl",
  "es",
  "sv",
  "ru",
  "uk",
]);

const ASSEMBLYAI_UNIVERSAL3_PRO_LANGUAGES = new Set(["en", "es", "pt", "fr", "de", "it"]);

const MODEL_LANGUAGE_MAP: Record<string, Set<string>> = {
  "parakeet-tdt-0.6b-v3": PARAKEET_LANGUAGES,
};

const LANGUAGE_INSTRUCTIONS: Record<string, string> = languageInstructionsData;

export function getBaseLanguageCode(language: string | null | undefined): string | undefined {
  if (!language || language === "auto") return undefined;
  return language.split("-")[0];
}

export function validateLanguageForModel(
  language: string | null | undefined,
  modelId: string
): string | undefined {
  const baseCode = getBaseLanguageCode(language);
  if (!baseCode) return undefined;

  const supportedSet = MODEL_LANGUAGE_MAP[modelId];
  if (!supportedSet) return baseCode;

  return supportedSet.has(baseCode) ? baseCode : undefined;
}

export function getLanguageInstruction(language: string | undefined): string {
  if (!language || language === "en") return "";
  return LANGUAGE_INSTRUCTIONS[language] || buildGenericInstruction(language);
}

function buildGenericInstruction(langCode: string): string {
  const template = LANGUAGE_INSTRUCTIONS["_genericTemplate"] || "";
  return template.replace("{{code}}", langCode);
}

export { WHISPER_LANGUAGES, PARAKEET_LANGUAGES, ASSEMBLYAI_UNIVERSAL3_PRO_LANGUAGES };
