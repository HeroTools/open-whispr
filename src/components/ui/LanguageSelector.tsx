import React, { useState, useRef, useEffect } from "react";
import { ChevronDown, Search, X } from "lucide-react";
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
        className={`w-full flex items-center justify-between px-3 py-2 border border-border rounded-md bg-background text-left hover:border-muted-foreground/30 focus:border-ring focus:ring-1 focus:ring-ring focus:outline-none transition-colors ${
          isOpen ? "border-ring ring-1 ring-ring" : ""
        }`}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
      >
        <span className="truncate text-foreground">{getLanguageLabel(value)}</span>
        <ChevronDown
          className={`w-4 h-4 text-muted-foreground transition-transform duration-200 ${
            isOpen ? "rotate-180" : ""
          }`}
        />
      </button>

      {isOpen && (
        <div className="absolute z-50 w-full mt-1 bg-popover border border-border rounded-md shadow-lg max-h-60 overflow-hidden">
          <div className="p-2 border-b border-border">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <input
                ref={searchInputRef}
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Search languages..."
                className="w-full pl-9 pr-8 py-2 text-sm bg-background text-foreground border border-border rounded-md focus:border-ring focus:ring-1 focus:ring-ring focus:outline-none"
              />
              {searchQuery && (
                <button
                  onClick={clearSearch}
                  className="absolute right-3 top-1/2 transform -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>
          <div className="max-h-48 overflow-y-auto">
            {filteredLanguages.length === 0 ? (
              <div className="px-3 py-2 text-sm text-muted-foreground">No languages found</div>
            ) : (
              <div role="listbox">
                {filteredLanguages.map((language, index) => (
                  <button
                    key={language.value}
                    type="button"
                    onClick={() => handleSelect(language.value)}
                    className={`w-full px-3 py-2 text-left text-sm text-foreground hover:bg-muted focus:bg-muted focus:outline-none ${
                      language.value === value
                        ? "bg-primary/10 dark:bg-primary/20 text-primary"
                        : ""
                    } ${index === highlightedIndex ? "bg-muted" : ""}`}
                    role="option"
                    aria-selected={language.value === value}
                  >
                    {language.label}
                    {language.value === value && <span className="ml-2 text-primary">✓</span>}
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
