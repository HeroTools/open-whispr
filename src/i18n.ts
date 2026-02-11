import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import { PROMPTS_BY_LOCALE } from "./locales/prompts";
import { TRANSLATIONS_BY_LOCALE } from "./locales/translations";

export const SUPPORTED_UI_LANGUAGES = ["en", "es", "fr", "de", "pt", "it"] as const;
export type UiLanguage = (typeof SUPPORTED_UI_LANGUAGES)[number];

export function normalizeUiLanguage(language: string | null | undefined): UiLanguage {
  const candidate = (language || "").trim().toLowerCase();
  const base = candidate.split("-")[0] as UiLanguage;

  if (SUPPORTED_UI_LANGUAGES.includes(base)) {
    return base;
  }

  return "en";
}

const resources = {
  en: {
    translation: TRANSLATIONS_BY_LOCALE.en,
    prompts: PROMPTS_BY_LOCALE.en,
  },
  es: {
    translation: TRANSLATIONS_BY_LOCALE.es,
    prompts: PROMPTS_BY_LOCALE.es,
  },
  fr: {
    translation: TRANSLATIONS_BY_LOCALE.fr,
    prompts: PROMPTS_BY_LOCALE.fr,
  },
  de: {
    translation: TRANSLATIONS_BY_LOCALE.de,
    prompts: PROMPTS_BY_LOCALE.de,
  },
  pt: {
    translation: TRANSLATIONS_BY_LOCALE.pt,
    prompts: PROMPTS_BY_LOCALE.pt,
  },
  it: {
    translation: TRANSLATIONS_BY_LOCALE.it,
    prompts: PROMPTS_BY_LOCALE.it,
  },
} as const;

const browserLanguage =
  typeof navigator !== "undefined" ? navigator.language || navigator.languages?.[0] : undefined;

const storageLanguage =
  typeof window !== "undefined" ? window.localStorage.getItem("uiLanguage") : undefined;

const initialLanguage = normalizeUiLanguage(storageLanguage || browserLanguage || "en");

void i18n.use(initReactI18next).init({
  resources,
  lng: initialLanguage,
  fallbackLng: "en",
  ns: ["translation", "prompts"],
  defaultNS: "translation",
  interpolation: {
    escapeValue: false,
  },
  returnEmptyString: false,
  returnNull: false,
});

export default i18n;
