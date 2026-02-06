export interface LanguageOption {
  value: string;
  label: string;
  flag: string;
}

export const LANGUAGE_OPTIONS: LanguageOption[] = [
  { value: "auto", label: "Auto-detect", flag: "\uD83C\uDF10" },
  { value: "af", label: "Afrikaans", flag: "\uD83C\uDDFF\uD83C\uDDE6" },
  { value: "ar", label: "Arabic", flag: "\uD83C\uDDF8\uD83C\uDDE6" },
  { value: "hy", label: "Armenian", flag: "\uD83C\uDDE6\uD83C\uDDF2" },
  { value: "az", label: "Azerbaijani", flag: "\uD83C\uDDE6\uD83C\uDDFF" },
  { value: "be", label: "Belarusian", flag: "\uD83C\uDDE7\uD83C\uDDFE" },
  { value: "bs", label: "Bosnian", flag: "\uD83C\uDDE7\uD83C\uDDE6" },
  { value: "bg", label: "Bulgarian", flag: "\uD83C\uDDE7\uD83C\uDDEC" },
  { value: "ca", label: "Catalan", flag: "\uD83C\uDDEA\uD83C\uDDF8" },
  { value: "zh", label: "Chinese", flag: "\uD83C\uDDE8\uD83C\uDDF3" },
  { value: "hr", label: "Croatian", flag: "\uD83C\uDDED\uD83C\uDDF7" },
  { value: "cs", label: "Czech", flag: "\uD83C\uDDE8\uD83C\uDDFF" },
  { value: "da", label: "Danish", flag: "\uD83C\uDDE9\uD83C\uDDF0" },
  { value: "nl", label: "Dutch", flag: "\uD83C\uDDF3\uD83C\uDDF1" },
  { value: "en", label: "English", flag: "\uD83C\uDDEC\uD83C\uDDE7" },
  { value: "en-US", label: "English (US)", flag: "\uD83C\uDDFA\uD83C\uDDF8" },
  { value: "en-GB", label: "English (UK)", flag: "\uD83C\uDDEC\uD83C\uDDE7" },
  { value: "et", label: "Estonian", flag: "\uD83C\uDDEA\uD83C\uDDEA" },
  { value: "fi", label: "Finnish", flag: "\uD83C\uDDEB\uD83C\uDDEE" },
  { value: "fr", label: "French", flag: "\uD83C\uDDEB\uD83C\uDDF7" },
  { value: "gl", label: "Galician", flag: "\uD83C\uDDEA\uD83C\uDDF8" },
  { value: "de", label: "German", flag: "\uD83C\uDDE9\uD83C\uDDEA" },
  { value: "el", label: "Greek", flag: "\uD83C\uDDEC\uD83C\uDDF7" },
  { value: "he", label: "Hebrew", flag: "\uD83C\uDDEE\uD83C\uDDF1" },
  { value: "hi", label: "Hindi", flag: "\uD83C\uDDEE\uD83C\uDDF3" },
  { value: "hu", label: "Hungarian", flag: "\uD83C\uDDED\uD83C\uDDFA" },
  { value: "is", label: "Icelandic", flag: "\uD83C\uDDEE\uD83C\uDDF8" },
  { value: "id", label: "Indonesian", flag: "\uD83C\uDDEE\uD83C\uDDE9" },
  { value: "it", label: "Italian", flag: "\uD83C\uDDEE\uD83C\uDDF9" },
  { value: "ja", label: "Japanese", flag: "\uD83C\uDDEF\uD83C\uDDF5" },
  { value: "kn", label: "Kannada", flag: "\uD83C\uDDEE\uD83C\uDDF3" },
  { value: "kk", label: "Kazakh", flag: "\uD83C\uDDF0\uD83C\uDDFF" },
  { value: "ko", label: "Korean", flag: "\uD83C\uDDF0\uD83C\uDDF7" },
  { value: "lv", label: "Latvian", flag: "\uD83C\uDDF1\uD83C\uDDFB" },
  { value: "lt", label: "Lithuanian", flag: "\uD83C\uDDF1\uD83C\uDDF9" },
  { value: "mk", label: "Macedonian", flag: "\uD83C\uDDF2\uD83C\uDDF0" },
  { value: "ms", label: "Malay", flag: "\uD83C\uDDF2\uD83C\uDDFE" },
  { value: "mt", label: "Maltese", flag: "\uD83C\uDDF2\uD83C\uDDF9" },
  { value: "mr", label: "Marathi", flag: "\uD83C\uDDEE\uD83C\uDDF3" },
  { value: "mi", label: "Maori", flag: "\uD83C\uDDF3\uD83C\uDDFF" },
  { value: "ne", label: "Nepali", flag: "\uD83C\uDDF3\uD83C\uDDF5" },
  { value: "no", label: "Norwegian", flag: "\uD83C\uDDF3\uD83C\uDDF4" },
  { value: "fa", label: "Persian", flag: "\uD83C\uDDEE\uD83C\uDDF7" },
  { value: "pl", label: "Polish", flag: "\uD83C\uDDF5\uD83C\uDDF1" },
  { value: "pt", label: "Portuguese", flag: "\uD83C\uDDF5\uD83C\uDDF9" },
  { value: "ro", label: "Romanian", flag: "\uD83C\uDDF7\uD83C\uDDF4" },
  { value: "ru", label: "Russian", flag: "\uD83C\uDDF7\uD83C\uDDFA" },
  { value: "sr", label: "Serbian", flag: "\uD83C\uDDF7\uD83C\uDDF8" },
  { value: "sk", label: "Slovak", flag: "\uD83C\uDDF8\uD83C\uDDF0" },
  { value: "sl", label: "Slovenian", flag: "\uD83C\uDDF8\uD83C\uDDEE" },
  { value: "es", label: "Spanish", flag: "\uD83C\uDDEA\uD83C\uDDF8" },
  { value: "sw", label: "Swahili", flag: "\uD83C\uDDF0\uD83C\uDDEA" },
  { value: "sv", label: "Swedish", flag: "\uD83C\uDDF8\uD83C\uDDEA" },
  { value: "tl", label: "Tagalog", flag: "\uD83C\uDDF5\uD83C\uDDED" },
  { value: "ta", label: "Tamil", flag: "\uD83C\uDDEE\uD83C\uDDF3" },
  { value: "th", label: "Thai", flag: "\uD83C\uDDF9\uD83C\uDDED" },
  { value: "tr", label: "Turkish", flag: "\uD83C\uDDF9\uD83C\uDDF7" },
  { value: "uk", label: "Ukrainian", flag: "\uD83C\uDDFA\uD83C\uDDE6" },
  { value: "ur", label: "Urdu", flag: "\uD83C\uDDF5\uD83C\uDDF0" },
  { value: "vi", label: "Vietnamese", flag: "\uD83C\uDDFB\uD83C\uDDF3" },
  {
    value: "cy",
    label: "Welsh",
    flag: "\uD83C\uDFF4\uDB40\uDC67\uDB40\uDC62\uDB40\uDC77\uDB40\uDC6C\uDB40\uDC73\uDB40\uDC7F",
  },
];

export const getLanguageLabel = (code: string): string => {
  const option = LANGUAGE_OPTIONS.find((lang) => lang.value === code);
  return option?.label || code;
};

export const getLanguageFlag = (code: string): string => {
  const option = LANGUAGE_OPTIONS.find((lang) => lang.value === code);
  return option?.flag || "\uD83C\uDF10";
};
