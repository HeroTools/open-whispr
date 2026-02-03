import React, { useState, useRef, useEffect } from "react";
import { ChevronDown, Search, X, Check } from "lucide-react";
import { LANGUAGE_OPTIONS, getLanguageLabel } from "../../utils/languages";

interface LanguageSelectorProps {
  value: string;
  onChange: (value: string) => void;
  className?: string;
}

export default function LanguageSelector({
  value,
  onChange,
  className = "",
}: LanguageSelectorProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [highlightedIndex, setHighlightedIndex] = useState(0);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  const filteredLanguages = LANGUAGE_OPTIONS.filter(
    (lang) =>
      lang.label.toLowerCase().includes(searchQuery.toLowerCase()) ||
      lang.value.toLowerCase().includes(searchQuery.toLowerCase())
  );

  useEffect(() => {
    setHighlightedIndex(0);
  }, [searchQuery]);

  useEffect(() => {
    if (isOpen && searchInputRef.current) {
      searchInputRef.current.focus();
    }
  }, [isOpen]);
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
        setSearchQuery("");
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!isOpen) {
      if (e.key === "Enter" || e.key === " " || e.key === "ArrowDown") {
        e.preventDefault();
        setIsOpen(true);
      }
      return;
    }

    switch (e.key) {
      case "ArrowDown":
        e.preventDefault();
        setHighlightedIndex((prev) => (prev < filteredLanguages.length - 1 ? prev + 1 : 0));
        break;
      case "ArrowUp":
        e.preventDefault();
        setHighlightedIndex((prev) => (prev > 0 ? prev - 1 : filteredLanguages.length - 1));
        break;
      case "Enter":
        e.preventDefault();
        if (filteredLanguages[highlightedIndex]) {
          handleSelect(filteredLanguages[highlightedIndex].value);
        }
        break;
      case "Escape":
        e.preventDefault();
        setIsOpen(false);
        setSearchQuery("");
        break;
    }
  };

  const handleSelect = (languageValue: string) => {
    onChange(languageValue);
    setIsOpen(false);
    setSearchQuery("");
  };

  const clearSearch = () => {
    setSearchQuery("");
    if (searchInputRef.current) {
      searchInputRef.current.focus();
    }
  };

  return (
    <div className={`relative ${className}`} ref={dropdownRef}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        onKeyDown={handleKeyDown}
        className={`w-full flex items-center justify-between px-3 py-2 border rounded-lg bg-white/5 dark:bg-white/3 text-left transition-all duration-200 ${
          isOpen
            ? "border-primary/50 ring-1 ring-primary/20 bg-white/8"
            : "border-white/10 dark:border-white/5 hover:border-white/20 hover:bg-white/8"
        }`}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
      >
        <span className="truncate text-sm text-foreground">{getLanguageLabel(value)}</span>
        <ChevronDown
          className={`w-3.5 h-3.5 text-muted-foreground transition-transform duration-200 ${
            isOpen ? "rotate-180" : ""
          }`}
        />
      </button>

      {isOpen && (
        <div className="absolute z-50 w-full mt-1.5 bg-popover/95 backdrop-blur-xl border border-white/10 dark:border-white/5 rounded-xl shadow-xl max-h-60 overflow-hidden">
          <div className="p-2 border-b border-white/5">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 transform -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
              <input
                ref={searchInputRef}
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Search..."
                className="w-full pl-8 pr-7 py-1.5 text-sm bg-white/5 dark:bg-white/3 text-foreground border border-white/10 rounded-lg focus:border-primary/50 focus:ring-1 focus:ring-primary/20 focus:outline-none placeholder:text-muted-foreground/50"
              />
              {searchQuery && (
                <button
                  onClick={clearSearch}
                  className="absolute right-2.5 top-1/2 transform -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>
          <div className="max-h-44 overflow-y-auto">
            {filteredLanguages.length === 0 ? (
              <div className="px-3 py-2 text-sm text-muted-foreground">No languages found</div>
            ) : (
              <div role="listbox" className="p-1">
                {filteredLanguages.map((language, index) => (
                  <button
                    key={language.value}
                    type="button"
                    onClick={() => handleSelect(language.value)}
                    className={`w-full px-2.5 py-1.5 text-left text-sm rounded-md transition-colors ${
                      language.value === value
                        ? "bg-primary/15 text-primary font-medium"
                        : "text-foreground hover:bg-white/5"
                    } ${index === highlightedIndex && language.value !== value ? "bg-white/5" : ""}`}
                    role="option"
                    aria-selected={language.value === value}
                  >
                    <span className="flex items-center justify-between">
                      {language.label}
                      {language.value === value && <Check className="w-3.5 h-3.5" />}
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
