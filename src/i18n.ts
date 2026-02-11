import i18n from "i18next";
import { initReactI18next } from "react-i18next";

import enTranslation from "./locales/en/translation.json";
import esTranslation from "./locales/es/translation.json";
import frTranslation from "./locales/fr/translation.json";
import deTranslation from "./locales/de/translation.json";
import ptTranslation from "./locales/pt/translation.json";
import itTranslation from "./locales/it/translation.json";

import enPrompts from "./locales/en/prompts.json";
import esPrompts from "./locales/es/prompts.json";
import frPrompts from "./locales/fr/prompts.json";
import dePrompts from "./locales/de/prompts.json";
import ptPrompts from "./locales/pt/prompts.json";
import itPrompts from "./locales/it/prompts.json";

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
    translation: enTranslation,
    prompts: enPrompts,
  },
  es: {
    translation: esTranslation,
    prompts: esPrompts,
  },
  fr: {
    translation: frTranslation,
    prompts: frPrompts,
  },
  de: {
    translation: deTranslation,
    prompts: dePrompts,
  },
  pt: {
    translation: ptTranslation,
    prompts: ptPrompts,
  },
  it: {
    translation: itTranslation,
    prompts: itPrompts,
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
