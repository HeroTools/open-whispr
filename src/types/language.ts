export interface LanguageDecision {
  language: string | null;
  reason: "single" | "detected" | "fallback" | "auto";
  needsRetry: boolean;
}

export interface LanguageContext {
  candidates: string[];
  fallback: string;
  detected: string | null;
  confidence: number | null;
  used: string | null;
  reason: "single" | "detected" | "fallback" | "auto";
}

export interface LanguageSettings {
  selectedLanguages: string[];
  defaultLanguage: string;
}
