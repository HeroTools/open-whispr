# Multi-Language Support Implementation Plan

**Design Document:** [../design-docs/multi-language-support.md](../design-docs/multi-language-support.md)
**Created:** 2026-01-19
**Status:** Ready for Implementation

## Overview

This plan implements multi-language support as defined in the v4 design document. The implementation follows a phased approach with clear milestones and verification steps.

## Prerequisites

Before starting:
- [ ] Ensure development environment is set up (`npm install`)
- [ ] Verify whisper.cpp binary is available (`npm run download:whisper-cpp`)
- [ ] Have test audio files in multiple languages (EN, RU, UK, NL)

---

## Phase 1: Core Infrastructure

**Goal:** Add language settings storage and helper functions.

### Task 1.1: Update `src/utils/languages.ts`

**File:** `src/utils/languages.ts`

**Add after existing exports:**

```typescript
// Languages that can be selected (excludes "auto")
export const SELECTABLE_LANGUAGES = LANGUAGE_OPTIONS.filter(
  (lang) => lang.value !== "auto"
);

// Get language label by code
export const getLanguageLabel = (code: string): string => {
  const option = LANGUAGE_OPTIONS.find((lang) => lang.value === code);
  return option?.label || code;
};

// Alias for prompt construction
export const getLanguageName = getLanguageLabel;

// Validate language code
export const isValidLanguageCode = (code: string): boolean =>
  SELECTABLE_LANGUAGES.some((lang) => lang.value === code);

// Maximum recommended languages (to prevent AI confusion)
export const MAX_RECOMMENDED_LANGUAGES = 4;
```

**Verification:**
- [ ] `SELECTABLE_LANGUAGES` has 58 items (59 total minus "auto")
- [ ] `getLanguageLabel("en")` returns "English"
- [ ] `getLanguageLabel("xyz")` returns "xyz" (fallback)
- [ ] `isValidLanguageCode("en")` returns `true`
- [ ] `isValidLanguageCode("auto")` returns `false`

---

### Task 1.2: Add Language Types

**File:** `src/types/language.ts` (NEW)

```typescript
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
```

**Verification:**
- [ ] File compiles without errors
- [ ] Types are importable from other files

---

### Task 1.3: Update `src/hooks/useSettings.ts`

**File:** `src/hooks/useSettings.ts`

**Step 1: Update TranscriptionSettings interface (find and modify):**

```typescript
export interface TranscriptionSettings {
  // ... existing fields ...
  preferredLanguage: string;      // DEPRECATED: Keep for migration
  selectedLanguages: string[];    // NEW
  defaultLanguage: string;        // NEW
}
```

**Step 2: Add new state hooks inside `useSettings()` function:**

```typescript
// NEW: Selected languages (JSON array)
const [selectedLanguages, setSelectedLanguages] = useLocalStorage<string[]>(
  "selectedLanguages",
  [],
  {
    serialize: (value) => JSON.stringify(value),
    deserialize: (value) => {
      try {
        const parsed = JSON.parse(value);
        return Array.isArray(parsed) ? parsed : [];
      } catch {
        return [];
      }
    },
  }
);

// NEW: Default/fallback language
const [defaultLanguage, setDefaultLanguage] = useLocalStorage(
  "defaultLanguage",
  "",
  {
    serialize: String,
    deserialize: String,
  }
);
```

**Step 3: Add migration effect (run once on mount):**

```typescript
// Migration from old preferredLanguage to new format
useEffect(() => {
  const hasNewFormat = localStorage.getItem("selectedLanguages") !== null;
  if (hasNewFormat) return;

  const oldLang = localStorage.getItem("preferredLanguage");
  if (oldLang && oldLang !== "auto") {
    localStorage.setItem("selectedLanguages", JSON.stringify([oldLang]));
    localStorage.setItem("defaultLanguage", oldLang);
  } else {
    localStorage.setItem("selectedLanguages", JSON.stringify([]));
    localStorage.setItem("defaultLanguage", "");
  }
}, []);
```

**Step 4: Update `updateTranscriptionSettings` function:**

```typescript
// Add to the function body:
if (settings.selectedLanguages !== undefined) {
  setSelectedLanguages(settings.selectedLanguages);
}
if (settings.defaultLanguage !== undefined) {
  setDefaultLanguage(settings.defaultLanguage);
}
```

**Step 5: Add to return object:**

```typescript
return {
  // ... existing ...
  selectedLanguages,
  defaultLanguage,
  setSelectedLanguages,
  setDefaultLanguage,
  // ...
};
```

**Verification:**
- [ ] Set `selectedLanguages` to `["en", "ru"]`, refresh page, verify persistence
- [ ] Set `defaultLanguage` to "en", refresh page, verify persistence
- [ ] Clear localStorage, set `preferredLanguage` to "ru", refresh, verify migration creates `selectedLanguages: ["ru"]` and `defaultLanguage: "ru"`

---

## Phase 2: Whisper Integration

**Goal:** Extract detected language from Whisper output.

### Task 2.1: Update `src/helpers/whisper.js` - parseWhisperResult

**File:** `src/helpers/whisper.js`

**Find `parseWhisperResult` method and replace:**

```javascript
parseWhisperResult(output) {
  // Handle string output (plain text from CLI without JSON)
  if (typeof output === 'string') {
    return {
      success: true,
      text: output.trim(),
      detectedLanguage: null,
      detectedConfidence: null,
    };
  }

  // Handle JSON output from whisper.cpp
  // Note: Different whisper.cpp versions have different JSON structures
  if (output && typeof output === 'object') {
    // Try multiple locations for detected language
    const detectedLang =
      output.language ||                          // Standard location
      output.result?.language ||                  // Some versions wrap in result
      output.segments?.[0]?.language ||           // Segment-level detection
      null;

    // Try multiple locations for confidence
    let confidence = null;
    if (output.language_probs && detectedLang) {
      confidence = output.language_probs[detectedLang] || null;
    } else if (output.result?.language_probs && detectedLang) {
      confidence = output.result.language_probs[detectedLang] || null;
    }

    // Extract text (also check multiple locations)
    const text =
      output.text?.trim() ||
      output.result?.text?.trim() ||
      output.transcription?.trim() ||
      '';

    return {
      success: true,
      text,
      detectedLanguage: detectedLang,
      detectedConfidence: confidence,
    };
  }

  return {
    success: false,
    text: '',
    detectedLanguage: null,
    detectedConfidence: null,
    error: 'Invalid whisper output format',
  };
}
```

**Verification:**
- [ ] Test with JSON: `{ text: "hello", language: "en" }` → returns `detectedLanguage: "en"`
- [ ] Test with nested: `{ result: { text: "hello", language: "ru" } }` → returns `detectedLanguage: "ru"`
- [ ] Test with string: `"hello world"` → returns `detectedLanguage: null`

---

### Task 2.2: Verify JSON Output is Enabled

**File:** `src/helpers/whisper.js`

**Find `runWhisperProcess` method and verify these args exist:**

```javascript
const args = [
  "-m", modelPath,
  "-f", audioPath,
  "--output-json",    // This MUST be present
  "-of", outputBasePath,
  "--no-prints",
];

// Only add -l if we have a specific language
if (language && language !== "auto") {
  args.push("-l", language);
}
```

**Verification:**
- [ ] Debug log shows `--output-json` in args
- [ ] When `language` is null, no `-l` flag is added

---

## Phase 3: AudioManager Refactor

**Goal:** Implement Single Pass + Retry on Miss strategy.

### Task 3.1: Add Helper Functions to `src/helpers/audioManager.js`

**File:** `src/helpers/audioManager.js`

**Add at the top of the class (after constructor):**

```javascript
/**
 * Resolve which language to use for transcription
 * v4: Only retry if detected language is NOT in user's list
 * @param {Object} params
 * @param {string[]} params.selected - User's selected languages
 * @param {string} params.fallback - Default fallback language
 * @param {string|null} params.detected - Whisper's detected language
 * @param {number|null} params.confidence - Detection confidence
 * @returns {{language: string|null, reason: string, needsRetry: boolean}}
 */
resolveLanguage({ selected, fallback, detected, confidence }) {
  // No languages configured → pure auto
  if (!selected || selected.length === 0) {
    return { language: null, reason: "auto", needsRetry: false };
  }

  // Single language → always use it
  if (selected.length === 1) {
    return { language: selected[0], reason: "single", needsRetry: false };
  }

  // Multiple languages: check if detected is in list
  if (detected && selected.includes(detected)) {
    // Even if "wrong" (RU vs UA), Reasoning Service will fix semantically
    return { language: detected, reason: "detected", needsRetry: false };
  }

  // Detected NOT in list → need to retry with fallback
  return { language: fallback || null, reason: "fallback", needsRetry: true };
}

/**
 * Get language settings from localStorage
 * @returns {{selected: string[], fallback: string}}
 */
getLanguageSettings() {
  try {
    const selectedRaw = localStorage.getItem("selectedLanguages");
    const selected = selectedRaw ? JSON.parse(selectedRaw) : [];
    const fallback = localStorage.getItem("defaultLanguage") || "";
    return { selected, fallback };
  } catch (error) {
    debugLogger.warn("Failed to parse language settings", { error: error.message });
    return { selected: [], fallback: "" };
  }
}

/**
 * Normalize OpenAI language names to ISO codes
 * OpenAI returns "english", "russian" - we need "en", "ru"
 * @param {string} languageName
 * @returns {string|null}
 */
normalizeLanguageCode(languageName) {
  if (!languageName) return null;

  const nameToCode = {
    "english": "en",
    "russian": "ru",
    "ukrainian": "uk",
    "dutch": "nl",
    "german": "de",
    "french": "fr",
    "spanish": "es",
    "portuguese": "pt",
    "italian": "it",
    "polish": "pl",
    "japanese": "ja",
    "chinese": "zh",
    "korean": "ko",
    "arabic": "ar",
    "hindi": "hi",
    "turkish": "tr",
    "vietnamese": "vi",
    "thai": "th",
    "indonesian": "id",
    "malay": "ms",
  };

  const normalized = languageName.toLowerCase().trim();
  return nameToCode[normalized] || normalized.substring(0, 2);
}
```

**Verification:**
- [ ] `resolveLanguage({ selected: [], fallback: "en", detected: "ru", confidence: 0.9 })` → `{ reason: "auto", needsRetry: false }`
- [ ] `resolveLanguage({ selected: ["en"], fallback: "en", detected: "ru", confidence: 0.9 })` → `{ reason: "single", needsRetry: false }`
- [ ] `resolveLanguage({ selected: ["en", "ru"], fallback: "en", detected: "ru", confidence: 0.9 })` → `{ reason: "detected", needsRetry: false }`
- [ ] `resolveLanguage({ selected: ["en", "ru"], fallback: "en", detected: "fr", confidence: 0.9 })` → `{ reason: "fallback", needsRetry: true }`

---

### Task 3.2: Update `processWithLocalWhisper`

**File:** `src/helpers/audioManager.js`

**Find `processWithLocalWhisper` method and refactor:**

This is a significant change. Key modifications:
1. Get language settings at start
2. Single language → direct transcription with `-l` flag
3. Multiple languages → auto-detect, check result, retry if needed
4. Build and pass `languageContext` to `processTranscription`

**See design document Section 4.2 for full implementation.**

**Key code blocks to add:**

```javascript
async processWithLocalWhisper(audioBlob, model = "base", metadata = {}) {
  const timings = {};
  const { selected, fallback } = this.getLanguageSettings();

  try {
    const arrayBuffer = await audioBlob.arrayBuffer();

    // OPTIMIZATION: Single language = skip auto-detect entirely
    if (selected.length === 1) {
      const options = { model, language: selected[0] };
      // ... single language path
    }

    // STEP 1: Full transcription with auto-detect
    const autoOptions = { model }; // No language = auto-detect
    const autoResult = await window.electronAPI.transcribeLocalWhisper(arrayBuffer, autoOptions);

    const detected = autoResult.detectedLanguage;
    const confidence = autoResult.detectedConfidence;

    // STEP 2: Resolve language
    const decision = this.resolveLanguage({ selected, fallback, detected, confidence });

    // STEP 2b: RETRY only if detected NOT in list
    if (decision.needsRetry && decision.language) {
      // Re-transcribe with fallback
    }

    // STEP 3: Build language context and process
    const languageContext = {
      candidates: selected,
      fallback,
      detected,
      confidence,
      used: usedLanguage,
      reason: decision.reason,
    };

    const text = await this.processTranscription(finalText, "local", languageContext);
    // ...
  }
}
```

**Verification:**
- [ ] Single language: only 1 Whisper call in logs
- [ ] Multi-language with detected in list: only 1 Whisper call
- [ ] Multi-language with detected NOT in list: 2 Whisper calls (retry)
- [ ] `languageContext` logged correctly

---

### Task 3.3: Update `processWithOpenAIAPI`

**File:** `src/helpers/audioManager.js`

**Key changes:**
1. Single language → add `language` to formData
2. Multiple languages → add `response_format: "verbose_json"`
3. Parse detected language from verbose response
4. Apply same resolve + retry logic

```javascript
// For multi-language mode:
if (selected.length > 1) {
  formData.append("response_format", "verbose_json");
}
```

**Verification:**
- [ ] Single language: `language` in formData, no `response_format`
- [ ] Multi-language: `response_format: "verbose_json"` in formData
- [ ] Language extracted from verbose_json response

---

### Task 3.4: Update `processTranscription` Signature

**File:** `src/helpers/audioManager.js`

**Change signature:**

```javascript
// Old:
async processTranscription(text, source) {

// New:
async processTranscription(text, source, languageContext = null) {
```

**Update the call to reasoning service:**

```javascript
const result = await this.processWithReasoningModel(
  normalizedText,
  reasoningModel,
  agentName,
  {},
  languageContext  // NEW parameter
);
```

---

### Task 3.5: Update `processWithReasoningModel`

**File:** `src/helpers/audioManager.js`

**Change signature and pass context:**

```javascript
// Old:
async processWithReasoningModel(text, model, agentName) {

// New:
async processWithReasoningModel(text, model, agentName, config = {}, languageContext = null) {
  // ...
  const result = await ReasoningService.processText(text, model, agentName, config, languageContext);
  // ...
}
```

---

## Phase 4: Reasoning Service

**Goal:** Make LLM aware of all candidate languages for semantic correction.

### Task 4.1: Add LanguageContext Type

**File:** `src/services/ReasoningService.ts`

**Add at top (after imports):**

```typescript
interface LanguageContext {
  candidates: string[];
  fallback: string;
  detected: string | null;
  confidence: number | null;
  used: string | null;
  reason: "single" | "detected" | "fallback" | "auto";
}
```

---

### Task 4.2: Add `buildSystemPrompt` Method

**File:** `src/services/ReasoningService.ts`

**Add new private method:**

```typescript
private buildSystemPrompt(languageContext: LanguageContext | null): string {
  // Import getLanguageName from languages.ts
  const { getLanguageName } = require("../utils/languages");

  // No context or auto mode - generic prompt
  if (!languageContext || languageContext.reason === "auto" || !languageContext.candidates.length) {
    return "You are a dictation assistant. Clean up text by fixing grammar and punctuation. Preserve the original language. Output ONLY the cleaned text.";
  }

  // Single language - simple and specific
  if (languageContext.candidates.length === 1) {
    const langName = getLanguageName(languageContext.candidates[0]);
    return `You are a dictation assistant. The text is in ${langName}. Clean up grammar and punctuation while keeping it in ${langName}. Output ONLY the cleaned text.`;
  }

  // Multiple languages - include ALL candidates for semantic correction
  const allLangNames = languageContext.candidates
    .map((code: string) => getLanguageName(code))
    .join(", ");

  const detectedName = languageContext.detected
    ? getLanguageName(languageContext.detected)
    : "unknown";

  const confidenceNote = languageContext.confidence
    ? ` (${Math.round(languageContext.confidence * 100)}% confidence)`
    : "";

  return `You are a multilingual dictation assistant.

CONTEXT:
- Whisper detected language: ${detectedName}${confidenceNote}
- User's known languages: ${allLangNames}

INSTRUCTIONS:
1. Whisper uses acoustic detection which can confuse similar languages (e.g., Russian/Ukrainian, Dutch/German).
2. Analyze the text semantically. If it looks like a DIFFERENT language from the user's list (not ${detectedName}), correct it to that language.
3. For example: If detected as "Russian" but contains Ukrainian words/grammar, format it as Ukrainian.
4. Clean up grammar and punctuation in the correct language.
5. NEVER translate to a different language - only identify and correct within the user's known languages.
6. Output ONLY the cleaned text, no explanations.`;
}
```

---

### Task 4.3: Update `processText` Signature

**File:** `src/services/ReasoningService.ts`

**Find and update:**

```typescript
// Old:
async processText(
  text: string,
  model: string = "",
  agentName: string | null = null,
  config: ReasoningConfig = {}
): Promise<string> {

// New:
async processText(
  text: string,
  model: string = "",
  agentName: string | null = null,
  config: ReasoningConfig = {},
  languageContext: LanguageContext | null = null
): Promise<string> {
```

---

### Task 4.4: Update Provider Methods

**Update these methods to use dynamic system prompt:**

1. `processWithOpenAI` - Replace hardcoded systemPrompt
2. `processWithGemini` - Replace hardcoded systemPrompt
3. `callChatCompletionsApi` - Add languageContext parameter
4. Pass through IPC for `processWithAnthropic` and `processWithLocal`

**Example for `processWithOpenAI`:**

```typescript
// Old:
const systemPrompt = "You are a dictation assistant. Clean up text by fixing grammar and punctuation. Output ONLY the cleaned text without any explanations, options, or commentary.";

// New:
const systemPrompt = this.buildSystemPrompt(languageContext);
```

**Verification:**
- [ ] Single language prompt is simple and specific
- [ ] Multi-language prompt includes all candidates
- [ ] RU↔UA test: speak Ukrainian, verify Reasoning corrects if needed

---

## Phase 5: UI Components

**Goal:** Create language selector UI.

### Task 5.1: Create `MultiLanguageSelector.tsx`

**File:** `src/components/ui/MultiLanguageSelector.tsx` (NEW)

Create the component with:
- Search input
- Available languages grid (clickable chips)
- Selected languages list with star (default) and X (remove)
- Mode indicator
- Soft limit warning (>4 languages)

**See design document Section 6 for full implementation.**

**Key imports:**

```typescript
import React, { useState } from "react";
import { Search, X, Star } from "lucide-react";
import {
  SELECTABLE_LANGUAGES,
  getLanguageLabel,
  MAX_RECOMMENDED_LANGUAGES,
} from "../../utils/languages";
```

---

### Task 5.2: Update `SettingsPage.tsx`

**File:** `src/components/SettingsPage.tsx`

**Step 1: Add import:**

```typescript
import MultiLanguageSelector from "./ui/MultiLanguageSelector";
```

**Step 2: Get settings from hook:**

```typescript
const {
  // ... existing
  selectedLanguages,
  defaultLanguage,
  updateTranscriptionSettings,
} = useSettings();
```

**Step 3: Replace LanguageSelector in transcription section:**

Find the existing language selector and replace with:

```tsx
<div className="border-t pt-6 mt-6">
  <h4 className="text-md font-medium text-gray-900 mb-2">Your Languages</h4>
  <p className="text-sm text-gray-600 mb-4">
    Select all languages you speak. Whisper auto-detects which one you're using,
    and the AI corrects any misidentification between similar languages.
  </p>
  <MultiLanguageSelector
    selectedLanguages={selectedLanguages}
    defaultLanguage={defaultLanguage}
    onLanguagesChange={(langs) => updateTranscriptionSettings({ selectedLanguages: langs })}
    onDefaultChange={(lang) => updateTranscriptionSettings({ defaultLanguage: lang })}
  />
</div>
```

**Verification:**
- [ ] UI renders without errors
- [ ] Can add/remove languages
- [ ] Star icon sets default
- [ ] Mode indicator shows correct state
- [ ] Settings persist after refresh

---

## Phase 6: Testing & Polish

### Task 6.1: Manual Testing Checklist

**Single Language Mode:**
- [ ] Select only English
- [ ] Record English speech
- [ ] Verify only 1 Whisper call in logs
- [ ] Verify `-l en` flag in args

**Multi-Language Mode (Happy Path):**
- [ ] Select English, Russian, Ukrainian
- [ ] Record Russian speech
- [ ] Verify detected as "ru"
- [ ] Verify NO retry (ru is in list)
- [ ] Output is correct Russian

**Multi-Language Mode (Retry Path):**
- [ ] Select English, Russian, Ukrainian
- [ ] Somehow trigger detection of "French" (may need to force in code)
- [ ] Verify RETRY occurs with fallback language
- [ ] Verify 2 Whisper calls in logs

**RU↔UA Semantic Correction:**
- [ ] Select English, Russian, Ukrainian
- [ ] Record clear Ukrainian sentence
- [ ] If Whisper detects "ru", verify Reasoning corrects to Ukrainian
- [ ] Check debug logs for language context

**Migration:**
- [ ] Clear localStorage
- [ ] Set `preferredLanguage: "de"`
- [ ] Refresh app
- [ ] Verify `selectedLanguages: ["de"]` and `defaultLanguage: "de"`

**Edge Cases:**
- [ ] No languages selected → auto-detect mode
- [ ] Remove last language → clears default
- [ ] Remove default → first remaining becomes default
- [ ] Select >4 languages → warning appears

---

### Task 6.2: Add Debug Logging

Ensure these log points exist:

```javascript
// In audioManager.js
logger.logReasoning("LANGUAGE_SETTINGS", { selected, fallback });
logger.logReasoning("LANGUAGE_DETECTION", { detected, confidence, inList });
logger.logReasoning("LANGUAGE_DECISION", { ...decision });
logger.logReasoning("LANGUAGE_RETRY", { from: detected, to: fallback });
logger.logReasoning("LANGUAGE_CONTEXT", languageContext);
```

---

### Task 6.3: Error Handling

Ensure graceful fallbacks:

```javascript
// If localStorage is corrupted
getLanguageSettings() {
  try {
    // ...
  } catch (error) {
    debugLogger.warn("Failed to parse language settings", { error });
    return { selected: [], fallback: "" };  // Safe default
  }
}

// If Whisper doesn't return language
if (!autoResult.detectedLanguage) {
  // Fall back to auto mode, don't crash
}
```

---

## Implementation Order Summary

| Phase | Tasks | Priority | Effort |
|-------|-------|----------|--------|
| 1 | Core Infrastructure | High | Low |
| 2 | Whisper Integration | High | Low |
| 3 | AudioManager Refactor | High | Medium |
| 4 | Reasoning Service | High | Medium |
| 5 | UI Components | Medium | Medium |
| 6 | Testing & Polish | High | Low |

**Total Estimated Effort:** ~4-6 hours

---

## Rollback Plan

If issues are discovered after deployment:

1. **Quick fix:** Set `selectedLanguages: []` in localStorage to revert to auto-detect
2. **Code rollback:** The old `preferredLanguage` setting is preserved and can be used if needed
3. **Feature flag:** Add `useNewLanguageSystem: boolean` setting to toggle between old/new

---

## Future Enhancements (Out of Scope)

- [ ] Per-language hotkeys (Globe+1, Globe+2, etc.)
- [ ] Language usage statistics in history
- [ ] Auto-suggest languages based on usage patterns
- [ ] Quick-switch in tray menu
