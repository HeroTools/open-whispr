# Multi-Language Support Design Document (v4)

## Overview

This document describes the implementation of multi-language support for OpenWhispr's transcription feature. The goal is to allow multilingual users to configure their spoken languages once, enabling automatic language detection during transcription with intelligent fallback behavior.

## Problem Statement

Currently, users can only select a single "preferred language" for transcription. This is limiting for multilingual users who switch between languages (e.g., English, Russian, Ukrainian) during daily use.

## User Story

> "I speak English, Russian, Ukrainian, and Dutch. I want to define all these languages in settings. When I dictate, I want the app to automatically detect which language I'm speaking. If detection fails or confidence is low, fall back to English."

## Core Design Principle (v4)

**Single Pass + Intelligent Retry + Semantic Correction**

```
┌──────────────────┐     ┌──────────────────┐     ┌──────────────────┐
│  Full Transcribe │────▶│   Hard Filter    │────▶│  Reasoning       │
│  (auto-detect)   │     │   (in list?)     │     │  (all candidates)│
└──────────────────┘     └──────────────────┘     └──────────────────┘
                                │
                         NOT in list?
                                │
                                ▼
                         ┌──────────────────┐
                         │  Retry with      │
                         │  fallback lang   │
                         └──────────────────┘
```

### Key Insight: Acoustic vs Semantic Detection

Whisper is an **acoustic model** - it detects language based on phonemes/sounds. For similar languages (Russian/Ukrainian, Dutch/German, Spanish/Portuguese), it can misidentify:

| User speaks | Whisper detects | Confidence | Reason |
|-------------|-----------------|------------|--------|
| Ukrainian | Russian | 85% | Similar phonemes (Surzhyk) |
| Dutch | German | 70% | Shared sounds |
| Portuguese | Spanish | 75% | Romance overlap |

**Solution:** Don't re-transcribe for "wrong but similar" languages. Let the Reasoning Service (LLM) fix it - it understands semantics, not just sounds.

## Data Model

### Settings Structure

```typescript
interface LanguageSettings {
  selectedLanguages: string[];  // Languages user might speak: ["en", "ru", "uk", "nl"]
  defaultLanguage: string;      // Fallback language: "en" (must be in selectedLanguages)
}
```

### Per-Transcription Result

```typescript
interface TranscriptionResult {
  success: boolean;
  text: string;
  // Language tracking
  detectedLanguage: string | null;    // What Whisper detected
  detectedConfidence: number | null;  // 0.0 - 1.0
  languageUsed: string | null;        // What we actually used
  languageDecisionReason: "single" | "detected" | "fallback" | "auto";
}
```

### Language Context (passed to Reasoning Service)

```typescript
interface LanguageContext {
  detected: string | null;       // What Whisper detected
  confidence: number | null;     // Detection confidence
  candidates: string[];          // ALL user's languages (not just winner!)
  fallback: string;              // Default fallback
  used: string | null;           // Final language used for transcription
  reason: "single" | "detected" | "fallback" | "auto";
}
```

## The Resolution Algorithm (v4)

```typescript
interface LanguageDecision {
  language: string | null;
  reason: "single" | "detected" | "fallback" | "auto";
  needsRetry: boolean;  // NEW: indicates if we should re-transcribe
}

function resolveLanguage(params: {
  selected: string[];
  fallback: string;
  detected: string | null;
  confidence: number | null;
}): LanguageDecision {
  const { selected, fallback, detected, confidence } = params;

  // Case 1: No languages configured → pure auto-detect
  if (!selected || selected.length === 0) {
    return { language: null, reason: "auto", needsRetry: false };
  }

  // Case 2: Single language → always use it (best accuracy)
  if (selected.length === 1) {
    return { language: selected[0], reason: "single", needsRetry: false };
  }

  // Case 3: Multiple languages, detected is in list → USE IT
  // Even if "wrong" (RU vs UA), let Reasoning Service fix semantically
  if (detected && selected.includes(detected)) {
    return { language: detected, reason: "detected", needsRetry: false };
  }

  // Case 4: Detected language NOT in list → RETRY with fallback
  // This is the only case where we re-transcribe
  return { language: fallback || null, reason: "fallback", needsRetry: true };
}
```

### Decision Matrix

| Detected | In List? | Confidence | Action | Reason |
|----------|----------|------------|--------|--------|
| Russian | Yes | Any | Keep text | Reasoning fixes RU↔UA |
| Ukrainian | Yes | Any | Keep text | Reasoning fixes RU↔UA |
| French | No | Any | **Retry with fallback** | User doesn't speak French |
| null | - | - | Keep text | Auto mode |

## Transcription Flow (v4: Single Pass + Retry on Miss)

### Flow Diagram

```
User speaks (multilingual)
         │
         ▼
┌─────────────────────────────────────────────────────────────────────┐
│                    STEP 1: FULL TRANSCRIPTION                        │
│  Run Whisper with auto-detect (no -l flag)                          │
│  Get: { text, detectedLanguage, confidence }                        │
│                                                                     │
│  ⚠️ This is a FULL transcription, not just detection!              │
└─────────────────────────────────────────────────────────────────────┘
         │
         ▼
┌─────────────────────────────────────────────────────────────────────┐
│                    STEP 2: HARD FILTER                              │
│  Is detectedLanguage in selectedLanguages?                          │
│                                                                     │
│  • YES (e.g., "ru" in ["en","ru","uk","nl"]) → Continue             │
│  • NO  (e.g., "fr" not in list) → RETRY with fallback               │
└─────────────────────────────────────────────────────────────────────┘
         │
    ┌────┴────┐
    │         │
   YES        NO
    │         │
    │         ▼
    │    ┌────────────────────────────────────────────────────────────┐
    │    │              STEP 2b: RETRY (rare case)                    │
    │    │  Discard previous result                                   │
    │    │  Re-run Whisper WITH explicit -l fallback                  │
    │    │  This guarantees output in fallback language               │
    │    └────────────────────────────────────────────────────────────┘
    │         │
    └────┬────┘
         │
         ▼
┌─────────────────────────────────────────────────────────────────────┐
│                    STEP 3: REASONING SERVICE                        │
│  Pass text + FULL LanguageContext to LLM                            │
│                                                                     │
│  Context includes:                                                  │
│  - detected: "ru"                                                   │
│  - candidates: ["en", "ru", "uk", "nl"]  ← ALL languages!           │
│  - confidence: 0.85                                                 │
│                                                                     │
│  LLM can fix RU→UA if text is actually Ukrainian                    │
└─────────────────────────────────────────────────────────────────────┘
         │
         ▼
      Final text
```

### Why This is Better Than v3

| Aspect | v3 (Two-Pass) | v4 (Single Pass + Retry) |
|--------|---------------|--------------------------|
| Detection pass | Separate, always | None (use full transcription) |
| Latency (common case) | 2x Whisper runs | 1x Whisper run |
| Retry trigger | Low confidence | Only if NOT in list |
| RU↔UA handling | Re-transcribe | Reasoning fixes semantically |

## File Changes

### 1. src/utils/languages.ts

```typescript
// Existing
export const LANGUAGE_OPTIONS = [
  { value: "auto", label: "Auto-detect" },
  { value: "en", label: "English" },
  // ... 58 more languages
];

// NEW: Languages that can be selected (excludes "auto")
export const SELECTABLE_LANGUAGES = LANGUAGE_OPTIONS.filter(
  (lang) => lang.value !== "auto"
);

// NEW: Get language label by code
export const getLanguageLabel = (code: string): string => {
  const option = LANGUAGE_OPTIONS.find((lang) => lang.value === code);
  return option?.label || code;
};

// NEW: Get full language name for prompts
export const getLanguageName = (code: string): string => {
  return getLanguageLabel(code);
};

// NEW: Validate language code
export const isValidLanguageCode = (code: string): boolean =>
  SELECTABLE_LANGUAGES.some((lang) => lang.value === code);

// NEW: Maximum recommended languages (to prevent AI confusion)
export const MAX_RECOMMENDED_LANGUAGES = 4;
```

### 2. src/hooks/useSettings.ts

```typescript
// Update TranscriptionSettings interface
export interface TranscriptionSettings {
  // ... existing fields
  preferredLanguage: string;      // DEPRECATED: Keep for migration
  selectedLanguages: string[];    // NEW: Languages user speaks
  defaultLanguage: string;        // NEW: Fallback (must be in selectedLanguages)
}

// Inside useSettings():

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

// Migration (run once)
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

### 3. src/helpers/whisper.js

**Key changes: Extract detected language with fallback parsing for different whisper.cpp versions.**

#### 3.1 Update parseWhisperResult (handles JSON variance)

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

#### 3.2 Ensure JSON output is enabled

```javascript
const args = [
  "-m", modelPath,
  "-f", audioPath,
  "--output-json",
  "-of", outputBasePath,
  "--no-prints",
];

// Only add -l if we have a specific language
if (language && language !== "auto") {
  args.push("-l", language);
}
```

### 4. src/helpers/audioManager.js

**Major refactor: Single Pass + Retry on Miss strategy.**

#### 4.1 Add language resolution types and helpers

```javascript
/**
 * @typedef {Object} LanguageDecision
 * @property {string|null} language
 * @property {"single"|"detected"|"fallback"|"auto"} reason
 * @property {boolean} needsRetry
 */

/**
 * @typedef {Object} LanguageContext
 * @property {string[]} candidates - ALL user's languages (for Reasoning)
 * @property {string} fallback - Default fallback language
 * @property {string|null} detected - What Whisper detected
 * @property {number|null} confidence - Detection confidence
 * @property {string|null} used - What we actually used
 * @property {"single"|"detected"|"fallback"|"auto"} reason
 */

/**
 * Resolve which language to use for transcription
 * v4: Only retry if detected language is NOT in user's list
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
 * Get language settings from storage
 */
getLanguageSettings() {
  try {
    const selectedRaw = localStorage.getItem("selectedLanguages");
    const selected = selectedRaw ? JSON.parse(selectedRaw) : [];
    const fallback = localStorage.getItem("defaultLanguage") || "";
    return { selected, fallback };
  } catch {
    return { selected: [], fallback: "" };
  }
}
```

#### 4.2 Update processWithLocalWhisper (Single Pass + Retry)

```javascript
async processWithLocalWhisper(audioBlob, model = "base", metadata = {}) {
  const timings = {};
  const { selected, fallback } = this.getLanguageSettings();

  try {
    const arrayBuffer = await audioBlob.arrayBuffer();

    // OPTIMIZATION: Single language = skip auto-detect entirely
    if (selected.length === 1) {
      const options = { model, language: selected[0] };
      const result = await window.electronAPI.transcribeLocalWhisper(arrayBuffer, options);

      if (result.success && result.text) {
        const languageContext = {
          candidates: selected,
          fallback,
          detected: selected[0],
          confidence: 1.0,
          used: selected[0],
          reason: "single",
        };

        const text = await this.processTranscription(result.text, "local", languageContext);
        return {
          success: true,
          text,
          source: "local",
          detectedLanguage: selected[0],
          detectedConfidence: 1.0,
          languageUsed: selected[0],
          languageDecisionReason: "single",
          timings,
        };
      }
      throw new Error(result.message || result.error || "Transcription failed");
    }

    // STEP 1: Full transcription with auto-detect (NOT a detection pass!)
    const autoOptions = { model }; // No language = auto-detect
    const transcriptionStart = performance.now();
    const autoResult = await window.electronAPI.transcribeLocalWhisper(arrayBuffer, autoOptions);
    timings.transcriptionProcessingDurationMs = Math.round(performance.now() - transcriptionStart);

    if (!autoResult.success) {
      throw new Error(autoResult.message || "Transcription failed");
    }

    const detected = autoResult.detectedLanguage;
    const confidence = autoResult.detectedConfidence;

    logger.logReasoning("LANGUAGE_DETECTION", {
      detected,
      confidence,
      userLanguages: selected,
      inList: detected ? selected.includes(detected) : false,
    });

    // STEP 2: Resolve language (check if detected is in user's list)
    const decision = this.resolveLanguage({ selected, fallback, detected, confidence });

    logger.logReasoning("LANGUAGE_DECISION", {
      ...decision,
      detected,
      fallback,
    });

    // STEP 2b: RETRY only if detected language NOT in user's list
    let finalText = autoResult.text;
    let usedLanguage = detected;

    if (decision.needsRetry && decision.language) {
      logger.logReasoning("LANGUAGE_RETRY", {
        reason: "Detected language not in user's list",
        detected,
        retryingWith: decision.language,
      });

      const retryStart = performance.now();
      const retryOptions = { model, language: decision.language };
      const retryResult = await window.electronAPI.transcribeLocalWhisper(arrayBuffer, retryOptions);
      timings.retryProcessingDurationMs = Math.round(performance.now() - retryStart);

      if (retryResult.success && retryResult.text) {
        finalText = retryResult.text;
        usedLanguage = decision.language;
      }
      // If retry fails, keep original auto-detect result
    } else {
      usedLanguage = decision.language || detected;
    }

    // STEP 3: Process with Reasoning (pass ALL candidates!)
    const languageContext = {
      candidates: selected,      // ALL languages for semantic correction
      fallback,
      detected,
      confidence,
      used: usedLanguage,
      reason: decision.reason,
    };

    const reasoningStart = performance.now();
    const text = await this.processTranscription(finalText, "local", languageContext);
    timings.reasoningProcessingDurationMs = Math.round(performance.now() - reasoningStart);

    return {
      success: true,
      text,
      source: "local",
      detectedLanguage: detected,
      detectedConfidence: confidence,
      languageUsed: usedLanguage,
      languageDecisionReason: decision.reason,
      timings,
    };

  } catch (error) {
    // ... existing error handling with fallback to OpenAI
    if (error.message === "No audio detected") {
      throw error;
    }

    const allowOpenAIFallback = localStorage.getItem("allowOpenAIFallback") === "true";
    if (allowOpenAIFallback) {
      try {
        const fallbackResult = await this.processWithOpenAIAPI(audioBlob, metadata);
        return { ...fallbackResult, source: "openai-fallback" };
      } catch (fallbackError) {
        throw new Error(
          `Local Whisper failed: ${error.message}. OpenAI fallback also failed: ${fallbackError.message}`
        );
      }
    }
    throw error;
  }
}
```

#### 4.3 Update processWithOpenAIAPI (with verbose_json)

```javascript
async processWithOpenAIAPI(audioBlob, metadata = {}) {
  const timings = {};
  const { selected, fallback } = this.getLanguageSettings();

  try {
    // ... existing setup (optimize audio, get API key, etc.) ...

    const formData = new FormData();
    formData.append("file", optimizedAudio, `audio.${extension}`);
    formData.append("model", model);

    // CRITICAL: Set response format based on language mode
    if (selected.length === 1) {
      // Single language: use explicit, standard JSON is fine
      formData.append("language", selected[0]);
    } else if (selected.length > 1) {
      // Multiple languages: MUST use verbose_json to get detected language
      // NOTE: This disables streaming! verbose_json is not compatible with stream
      formData.append("response_format", "verbose_json");
    }

    const shouldStream = selected.length <= 1 && this.shouldStreamTranscription(model, provider);
    if (shouldStream) {
      formData.append("stream", "true");
    }

    // Make request
    const response = await fetch(endpoint, {
      method: "POST",
      headers,
      body: formData,
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`API Error: ${response.status} ${errorText}`);
    }

    // Parse response based on format
    let result;
    let detected = null;

    if (selected.length > 1) {
      // verbose_json format: { text, language, duration, words, segments }
      result = await response.json();
      detected = result.language; // e.g., "english", "russian"

      // Normalize language code (OpenAI returns full names, we use ISO codes)
      detected = this.normalizeLanguageCode(detected);

      logger.logReasoning("OPENAI_LANGUAGE_DETECTION", {
        rawLanguage: result.language,
        normalized: detected,
        userLanguages: selected,
        inList: detected ? selected.includes(detected) : false,
      });

      // Check if detected language is in user's list
      const decision = this.resolveLanguage({
        selected,
        fallback,
        detected,
        confidence: 0.8, // OpenAI doesn't provide confidence, assume reasonable
      });

      // RETRY if detected NOT in list
      if (decision.needsRetry && decision.language) {
        logger.logReasoning("OPENAI_LANGUAGE_RETRY", {
          detected,
          retryingWith: decision.language,
        });

        const retryFormData = new FormData();
        retryFormData.append("file", optimizedAudio, `audio.${extension}`);
        retryFormData.append("model", model);
        retryFormData.append("language", decision.language);

        const retryResponse = await fetch(endpoint, {
          method: "POST",
          headers,
          body: retryFormData,
        });

        if (retryResponse.ok) {
          result = await retryResponse.json();
          detected = decision.language;
        }
      }
    } else if (shouldStream) {
      // Streaming response
      const streamedText = await this.readTranscriptionStream(response);
      result = { text: streamedText };
      detected = selected[0] || null;
    } else {
      // Standard JSON response
      result = await response.json();
      detected = selected[0] || null;
    }

    // Process with Reasoning
    const languageContext = {
      candidates: selected,
      fallback,
      detected,
      confidence: 0.8,
      used: detected,
      reason: selected.length === 1 ? "single" : "detected",
    };

    const text = await this.processTranscription(result.text, "openai", languageContext);

    return {
      success: true,
      text,
      source: "openai",
      detectedLanguage: detected,
      languageUsed: detected,
      languageDecisionReason: languageContext.reason,
      timings,
    };

  } catch (error) {
    // ... existing error handling
  }
}

/**
 * Normalize OpenAI language names to ISO codes
 * OpenAI returns "english", "russian", etc. - we need "en", "ru"
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
    // ... add more as needed
  };

  const normalized = languageName.toLowerCase().trim();
  return nameToCode[normalized] || normalized.substring(0, 2);
}
```

### 5. src/services/ReasoningService.ts (Critical Update)

**The Reasoning Service must know ALL candidate languages to fix acoustic misidentification.**

#### 5.1 Update LanguageContext type

```typescript
interface LanguageContext {
  candidates: string[];          // ALL user's languages (critical!)
  fallback: string;              // Default fallback
  detected: string | null;       // What Whisper detected
  confidence: number | null;     // Detection confidence
  used: string | null;           // What we actually used
  reason: "single" | "detected" | "fallback" | "auto";
}
```

#### 5.2 Update buildSystemPrompt (semantic language correction)

```typescript
private buildSystemPrompt(languageContext: LanguageContext | null): string {
  // No context or auto mode - generic prompt
  if (!languageContext || languageContext.reason === "auto" || !languageContext.candidates.length) {
    return "You are a dictation assistant. Clean up text by fixing grammar and punctuation. Preserve the original language. Output ONLY the cleaned text.";
  }

  // Single language - simple and specific
  if (languageContext.candidates.length === 1) {
    const langName = getLanguageName(languageContext.candidates[0]);
    return `You are a dictation assistant. The text is in ${langName}. Clean up grammar and punctuation while keeping it in ${langName}. Output ONLY the cleaned text.`;
  }

  // Multiple languages - CRITICAL: Include all candidates for semantic correction
  const allLangNames = languageContext.candidates
    .map(code => getLanguageName(code))
    .join(", ");

  const detectedName = languageContext.detected
    ? getLanguageName(languageContext.detected)
    : "unknown";

  const confidenceNote = languageContext.confidence
    ? ` (${Math.round(languageContext.confidence * 100)}% confidence)`
    : "";

  // This prompt enables semantic correction for similar languages
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

#### 5.3 Update processText signature

```typescript
async processText(
  text: string,
  model: string = "",
  agentName: string | null = null,
  config: ReasoningConfig = {},
  languageContext: LanguageContext | null = null  // NEW
): Promise<string> {
  // ... existing validation ...

  // Use language-aware prompt
  const systemPrompt = this.buildSystemPrompt(languageContext);

  // ... rest of implementation, pass systemPrompt to provider methods
}
```

#### 5.4 Update all provider methods

```typescript
private async callChatCompletionsApi(
  endpoint: string,
  apiKey: string,
  model: string,
  text: string,
  agentName: string | null,
  config: ReasoningConfig,
  providerName: string,
  languageContext: LanguageContext | null = null  // NEW
): Promise<string> {
  const systemPrompt = this.buildSystemPrompt(languageContext);
  // ... rest unchanged
}
```

### 6. src/components/ui/MultiLanguageSelector.tsx (NEW)

```typescript
interface MultiLanguageSelectorProps {
  selectedLanguages: string[];
  defaultLanguage: string;
  onLanguagesChange: (languages: string[]) => void;
  onDefaultChange: (language: string) => void;
}

export default function MultiLanguageSelector({
  selectedLanguages,
  defaultLanguage,
  onLanguagesChange,
  onDefaultChange,
}: MultiLanguageSelectorProps) {
  const [searchQuery, setSearchQuery] = useState("");

  const availableLanguages = SELECTABLE_LANGUAGES.filter(
    (lang) =>
      !selectedLanguages.includes(lang.value) &&
      (lang.label.toLowerCase().includes(searchQuery.toLowerCase()) ||
       lang.value.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  const handleAddLanguage = (code: string) => {
    const newSelected = [...selectedLanguages, code];
    onLanguagesChange(newSelected);
    if (selectedLanguages.length === 0) {
      onDefaultChange(code);
    }
    setSearchQuery("");
  };

  const handleRemoveLanguage = (code: string) => {
    const newSelected = selectedLanguages.filter((l) => l !== code);
    onLanguagesChange(newSelected);
    if (code === defaultLanguage) {
      onDefaultChange(newSelected[0] || "");
    }
  };

  // Soft limit warning
  const showWarning = selectedLanguages.length > MAX_RECOMMENDED_LANGUAGES;

  return (
    <div className="space-y-4">
      {/* Search input */}
      {/* Available languages grid */}
      {/* Selected languages list with star (default) and X (remove) */}

      {/* Mode indicator */}
      <div className="p-3 bg-blue-50 rounded-lg text-sm text-blue-800">
        {selectedLanguages.length === 0 && (
          <p>No languages selected. Using pure auto-detect mode.</p>
        )}
        {selectedLanguages.length === 1 && (
          <p>Single language mode: Optimized for {getLanguageName(selectedLanguages[0])}.</p>
        )}
        {selectedLanguages.length > 1 && (
          <p>
            Multi-language mode: Whisper auto-detects, AI corrects similar languages.
            {defaultLanguage && ` Fallback: ${getLanguageName(defaultLanguage)}.`}
          </p>
        )}
      </div>

      {/* Soft limit warning */}
      {showWarning && (
        <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-sm text-amber-800">
          <strong>Note:</strong> Selecting more than {MAX_RECOMMENDED_LANGUAGES} languages
          may reduce accuracy. Consider removing languages you rarely use.
        </div>
      )}
    </div>
  );
}
```

### 7. src/components/SettingsPage.tsx

```diff
- import LanguageSelector from "./ui/LanguageSelector";
+ import MultiLanguageSelector from "./ui/MultiLanguageSelector";

// In transcription section:
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

## Edge Cases

### 1. Russian vs Ukrainian (Acoustic Confusion)

| Scenario | v3 Behavior | v4 Behavior |
|----------|-------------|-------------|
| Speak Ukrainian, Whisper detects Russian | Re-transcribe with fallback | Keep text, Reasoning fixes semantically |
| Speak Surzhyk (mixed) | Re-transcribe (loses mix) | Reasoning preserves mixed language |

### 2. Language Not in List

| Detected | In List | Action |
|----------|---------|--------|
| French | No | Retry with fallback language |
| (null) | - | Keep auto-detect result |

### 3. Validation

```typescript
// Default must be in selected (or empty)
const validateSettings = (selected: string[], default_: string) => {
  if (default_ && !selected.includes(default_)) {
    return { selected: [...selected, default_], default: default_ };
  }
  return { selected, default: default_ };
};
```

## Testing Plan

### Unit Tests

1. **resolveLanguage function:**
   - Empty selected → `{ reason: "auto", needsRetry: false }`
   - Single selected → `{ reason: "single", needsRetry: false }`
   - Multiple, detected IN list → `{ reason: "detected", needsRetry: false }`
   - Multiple, detected NOT in list → `{ reason: "fallback", needsRetry: true }`

2. **parseWhisperResult:**
   - Extracts language from top-level
   - Falls back to `result.language`
   - Falls back to `segments[0].language`
   - Handles missing fields

3. **normalizeLanguageCode:**
   - "english" → "en"
   - "russian" → "ru"
   - Unknown → first 2 chars

### Integration Tests

1. **Single Language Mode:**
   - Only one Whisper call
   - Correct `-l` flag passed

2. **Multi-Language, Detected in List:**
   - Only one Whisper call
   - No retry triggered
   - Reasoning gets all candidates

3. **Multi-Language, Detected NOT in List:**
   - Two Whisper calls
   - Second with fallback language
   - `languageDecisionReason: "fallback"`

4. **OpenAI verbose_json:**
   - Language extracted correctly
   - Normalized to ISO code

### Manual Testing: The RU↔UA Test

1. Configure: `selectedLanguages: ["en", "ru", "uk"]`
2. Speak Ukrainian sentence
3. Verify Whisper detects (probably "ru")
4. Verify NO retry (ru is in list)
5. Verify Reasoning corrects to Ukrainian
6. Check debug logs for language context

## Implementation Order

### Phase 1: Core Infrastructure
1. Add types and `resolveLanguage` to `audioManager.js`
2. Update `whisper.js` parseWhisperResult (handle JSON variance)
3. Add `normalizeLanguageCode` helper
4. Add settings to `useSettings.ts`

### Phase 2: Transcription Logic
1. Implement Single Pass + Retry in `processWithLocalWhisper`
2. Add `verbose_json` for OpenAI multi-language mode
3. Implement retry logic in `processWithOpenAIAPI`

### Phase 3: Reasoning Integration
1. Update `ReasoningService` to accept `LanguageContext`
2. Implement multi-language aware prompt with ALL candidates
3. Update all provider methods

### Phase 4: UI
1. Create `MultiLanguageSelector` component
2. Add soft limit warning (>4 languages)
3. Add mode indicator
4. Update `SettingsPage`

### Phase 5: Polish
1. Add comprehensive logging
2. Add result language display (optional)
3. Consider per-language hotkeys as power-user feature

## Summary: v3 → v4 Changes

| Aspect | v3 | v4 |
|--------|----|----|
| Strategy | Two-Pass always | Single Pass + Retry on Miss |
| Retry trigger | Low confidence | Only if NOT in list |
| RU↔UA fix | Re-transcribe | Reasoning fixes semantically |
| Latency (common) | 2x Whisper | 1x Whisper |
| Reasoning prompt | Simple | Includes ALL candidates |
| OpenAI format | Not specified | verbose_json required |
| JSON parsing | Single location | Multiple fallback locations |
| UI warning | None | Soft limit >4 languages |

## Alternative Approach: Per-Language Hotkeys

Instead of auto-detection, users could press different hotkeys for different languages:

| Hotkey | Language |
|--------|----------|
| `Globe` (default) | Auto-detect |
| `Globe + 1` | English |
| `Globe + 2` | Russian |
| `Globe + 3` | Ukrainian |

**Recommendation:** Start with auto-detect (v4), add hotkeys as power-user feature later.

## Files Modified

```
src/
├── utils/
│   └── languages.ts                  # Add helpers, MAX_RECOMMENDED_LANGUAGES
├── hooks/
│   └── useSettings.ts                # Add selectedLanguages, defaultLanguage
├── helpers/
│   ├── audioManager.js               # resolveLanguage, Single Pass + Retry
│   └── whisper.js                    # parseWhisperResult with fallbacks
├── services/
│   └── ReasoningService.ts           # Multi-language prompt with ALL candidates
└── components/
    ├── ui/
    │   └── MultiLanguageSelector.tsx # NEW, with soft limit warning
    └── SettingsPage.tsx              # Use new component
```
