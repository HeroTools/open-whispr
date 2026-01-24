import React, { useState, useRef, useEffect, useMemo } from "react";
import { Search, X, Star, AlertCircle } from "lucide-react";
import {
  SELECTABLE_LANGUAGES,
  getLanguageName,
  MAX_RECOMMENDED_LANGUAGES,
} from "../../utils/languages";

interface MultiLanguageSelectorProps {
  selectedLanguages: string[];
  defaultLanguage: string;
  onSelectedLanguagesChange: (languages: string[]) => void;
  onDefaultLanguageChange: (language: string) => void;
  className?: string;
}

type ModeType = "auto" | "single" | "multi";

function getModeInfo(count: number): { mode: ModeType; label: string; description: string } {
  if (count === 0) {
    return {
      mode: "auto",
      label: "Auto-detect",
      description: "Whisper will automatically detect the language",
    };
  }
  if (count === 1) {
    return {
      mode: "single",
      label: "Single language",
      description: "All transcriptions will use this language",
    };
  }
  return {
    mode: "multi",
    label: "Multi-language",
    description: "Whisper auto-detects, falls back to default if not in list",
  };
}

export default function MultiLanguageSelector({
  selectedLanguages,
  defaultLanguage,
  onSelectedLanguagesChange,
  onDefaultLanguageChange,
  className = "",
}: MultiLanguageSelectorProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [isSearchFocused, setIsSearchFocused] = useState(false);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const modeInfo = useMemo(() => getModeInfo(selectedLanguages.length), [selectedLanguages.length]);

  const filteredLanguages = useMemo(() => {
    return SELECTABLE_LANGUAGES.filter(
      (lang) =>
        !selectedLanguages.includes(lang.value) &&
        (lang.label.toLowerCase().includes(searchQuery.toLowerCase()) ||
          lang.value.toLowerCase().includes(searchQuery.toLowerCase()))
    );
  }, [searchQuery, selectedLanguages]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsSearchFocused(false);
        setSearchQuery("");
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleAddLanguage = (langCode: string) => {
    const newSelected = [...selectedLanguages, langCode];
    onSelectedLanguagesChange(newSelected);

    // If this is the first language or no default is set, make it the default
    if (newSelected.length === 1 || !defaultLanguage) {
      onDefaultLanguageChange(langCode);
    }

    setSearchQuery("");
    searchInputRef.current?.focus();
  };

  const handleRemoveLanguage = (langCode: string) => {
    const newSelected = selectedLanguages.filter((l) => l !== langCode);
    onSelectedLanguagesChange(newSelected);

    // If we removed the default, set the first remaining language as default
    if (langCode === defaultLanguage) {
      onDefaultLanguageChange(newSelected[0] || "");
    }
  };

  const handleSetDefault = (langCode: string) => {
    onDefaultLanguageChange(langCode);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && filteredLanguages.length > 0 && searchQuery) {
      e.preventDefault();
      handleAddLanguage(filteredLanguages[0].value);
    } else if (e.key === "Escape") {
      setIsSearchFocused(false);
      setSearchQuery("");
    }
  };

  const showWarning = selectedLanguages.length > MAX_RECOMMENDED_LANGUAGES;

  return (
    <div className={`space-y-4 ${className}`} ref={containerRef}>
      {/* Mode indicator */}
      <div className="flex items-center gap-2 p-3 bg-gray-50 rounded-lg">
        <div
          className={`w-2 h-2 rounded-full ${
            modeInfo.mode === "auto"
              ? "bg-blue-500"
              : modeInfo.mode === "single"
                ? "bg-green-500"
                : "bg-purple-500"
          }`}
        />
        <div>
          <span className="text-sm font-medium text-gray-900">{modeInfo.label}</span>
          <span className="text-xs text-gray-500 ml-2">{modeInfo.description}</span>
        </div>
      </div>

      {/* Selected languages */}
      {selectedLanguages.length > 0 && (
        <div className="space-y-2">
          <label className="text-sm font-medium text-gray-700">Selected Languages</label>
          <div className="flex flex-wrap gap-2">
            {selectedLanguages.map((langCode) => {
              const isDefault = langCode === defaultLanguage;
              return (
                <div
                  key={langCode}
                  className={`flex items-center gap-1 px-3 py-1.5 rounded-full text-sm ${
                    isDefault
                      ? "bg-blue-100 text-blue-800 border border-blue-300"
                      : "bg-gray-100 text-gray-800 border border-gray-200"
                  }`}
                >
                  {selectedLanguages.length > 1 && (
                    <button
                      type="button"
                      onClick={() => handleSetDefault(langCode)}
                      className={`p-0.5 rounded-full transition-colors ${
                        isDefault ? "text-blue-600" : "text-gray-400 hover:text-yellow-500"
                      }`}
                      title={isDefault ? "Default language" : "Set as default"}
                    >
                      <Star className={`w-3.5 h-3.5 ${isDefault ? "fill-current" : ""}`} />
                    </button>
                  )}
                  <span>{getLanguageName(langCode)}</span>
                  <button
                    type="button"
                    onClick={() => handleRemoveLanguage(langCode)}
                    className="p-0.5 text-gray-400 hover:text-red-500 transition-colors"
                    title="Remove language"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              );
            })}
          </div>
          {selectedLanguages.length > 1 && (
            <p className="text-xs text-gray-500">
              Click the star to set the fallback language for unknown detections.
            </p>
          )}
        </div>
      )}

      {/* Warning for too many languages */}
      {showWarning && (
        <div className="flex items-start gap-2 p-3 bg-amber-50 border border-amber-200 rounded-lg">
          <AlertCircle className="w-4 h-4 text-amber-600 mt-0.5 flex-shrink-0" />
          <div className="text-sm text-amber-800">
            <p className="font-medium">Many languages selected</p>
            <p className="text-xs mt-0.5">
              With {selectedLanguages.length} languages, auto-detection may be less accurate.
              Consider limiting to {MAX_RECOMMENDED_LANGUAGES} or fewer languages you actually use.
            </p>
          </div>
        </div>
      )}

      {/* Search and add */}
      <div className="space-y-2">
        <label className="text-sm font-medium text-gray-700">
          {selectedLanguages.length === 0 ? "Add Languages" : "Add More Languages"}
        </label>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            ref={searchInputRef}
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onFocus={() => setIsSearchFocused(true)}
            onKeyDown={handleKeyDown}
            placeholder="Search languages to add..."
            className="w-full pl-9 pr-4 py-2 text-sm border border-gray-300 rounded-md focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none"
          />
        </div>

        {/* Dropdown with available languages */}
        {isSearchFocused && (
          <div className="border border-gray-200 rounded-md shadow-sm max-h-48 overflow-y-auto bg-white">
            {filteredLanguages.length === 0 ? (
              <div className="px-3 py-2 text-sm text-gray-500">
                {searchQuery ? "No matching languages" : "All languages selected"}
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-1 p-2">
                {filteredLanguages.slice(0, 20).map((lang) => (
                  <button
                    key={lang.value}
                    type="button"
                    onClick={() => handleAddLanguage(lang.value)}
                    className="px-3 py-1.5 text-left text-sm rounded hover:bg-gray-100 transition-colors truncate"
                  >
                    {lang.label}
                  </button>
                ))}
              </div>
            )}
            {filteredLanguages.length > 20 && (
              <div className="px-3 py-2 text-xs text-gray-400 border-t">
                Type to search {filteredLanguages.length - 20} more languages...
              </div>
            )}
          </div>
        )}
      </div>

      {/* Quick select for common languages when empty */}
      {selectedLanguages.length === 0 && !isSearchFocused && (
        <div className="space-y-2">
          <label className="text-xs text-gray-500">Quick select:</label>
          <div className="flex flex-wrap gap-2">
            {["en", "es", "fr", "de", "zh", "ja", "ru", "pt"].map((code) => (
              <button
                key={code}
                type="button"
                onClick={() => handleAddLanguage(code)}
                className="px-3 py-1 text-xs bg-gray-100 hover:bg-gray-200 rounded-full transition-colors"
              >
                {getLanguageName(code)}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
