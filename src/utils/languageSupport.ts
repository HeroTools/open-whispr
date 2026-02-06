import registry from "../config/languageRegistry.json";

const WHISPER_LANGUAGES = new Set(registry.languages.filter((l) => l.whisper).map((l) => l.code));

const PARAKEET_LANGUAGES = new Set(registry.languages.filter((l) => l.parakeet).map((l) => l.code));

const ASSEMBLYAI_UNIVERSAL3_PRO_LANGUAGES = new Set(
  registry.languages.filter((l) => l.assemblyai).map((l) => l.code)
);

const MODEL_LANGUAGE_MAP: Record<string, Set<string>> = {
  "parakeet-tdt-0.6b-v3": PARAKEET_LANGUAGES,
};

const LANGUAGE_INSTRUCTIONS: Record<string, string> = Object.fromEntries(
  registry.languages
    .filter(
      (l): l is typeof l & { instruction: string } =>
        "instruction" in l && typeof l.instruction === "string"
    )
    .map((l) => [l.code, l.instruction])
);

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
  const template = registry._genericTemplate || "";
  return template.replace("{{code}}", langCode);
}

export { WHISPER_LANGUAGES, PARAKEET_LANGUAGES, ASSEMBLYAI_UNIVERSAL3_PRO_LANGUAGES };
