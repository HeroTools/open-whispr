import deTranslation from "./de/translation.json";
import enTranslation from "./en/translation.json";
import esTranslation from "./es/translation.json";
import frTranslation from "./fr/translation.json";
import itTranslation from "./it/translation.json";
import ptTranslation from "./pt/translation.json";

export const TRANSLATIONS_BY_LOCALE = {
  en: enTranslation,
  es: esTranslation,
  fr: frTranslation,
  de: deTranslation,
  pt: ptTranslation,
  it: itTranslation,
} as const;
