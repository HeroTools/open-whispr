const i18next = require("i18next");

const enTranslation = require("../locales/en/translation.json");
const esTranslation = require("../locales/es/translation.json");
const frTranslation = require("../locales/fr/translation.json");
const deTranslation = require("../locales/de/translation.json");
const ptTranslation = require("../locales/pt/translation.json");
const itTranslation = require("../locales/it/translation.json");

const enPrompts = require("../locales/en/prompts.json");
const esPrompts = require("../locales/es/prompts.json");
const frPrompts = require("../locales/fr/prompts.json");
const dePrompts = require("../locales/de/prompts.json");
const ptPrompts = require("../locales/pt/prompts.json");
const itPrompts = require("../locales/it/prompts.json");

const SUPPORTED_UI_LANGUAGES = ["en", "es", "fr", "de", "pt", "it"];

function normalizeUiLanguage(language) {
  const candidate = (language || "").trim().toLowerCase();
  const base = candidate.split("-")[0];

  return SUPPORTED_UI_LANGUAGES.includes(base) ? base : "en";
}

const i18nMain = i18next.createInstance();

void i18nMain.init({
  initImmediate: false,
  resources: {
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
  },
  lng: normalizeUiLanguage(process.env.UI_LANGUAGE),
  fallbackLng: "en",
  ns: ["translation", "prompts"],
  defaultNS: "translation",
  interpolation: {
    escapeValue: false,
  },
  returnEmptyString: false,
  returnNull: false,
});

function changeLanguage(language) {
  const normalized = normalizeUiLanguage(language);

  if (i18nMain.language !== normalized) {
    void i18nMain.changeLanguage(normalized);
  }

  return normalized;
}

module.exports = {
  i18nMain,
  changeLanguage,
  normalizeUiLanguage,
  SUPPORTED_UI_LANGUAGES,
};
