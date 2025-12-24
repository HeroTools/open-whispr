import { getLanguageLabel } from "../utils/languages";

export interface TranslationConfig {
  text: string;
  sourceLanguage: string;
  targetLanguage: string;
  provider: "openai" | "anthropic" | "gemini";
  apiKey: string;
  model?: string;
}

export interface TranslationResult {
  translatedText: string;
  success: boolean;
  error?: string;
}

class TranslationService {
  private translationCache: Map<string, { translatedText: string; timestamp: number }>;
  private readonly CACHE_TTL = 60 * 60 * 1000; // 1 hour
  private readonly MAX_CACHE_SIZE = 100;

  constructor() {
    this.translationCache = new Map();
  }

  private getCacheKey(text: string, sourceLanguage: string, targetLanguage: string): string {
    // Create a unique cache key based on text content and languages
    return `${sourceLanguage}->${targetLanguage}:${text.substring(0, 200)}`;
  }

  private getFromCache(cacheKey: string): string | null {
    const cached = this.translationCache.get(cacheKey);
    if (!cached) return null;

    // Check if cache entry is still valid
    const now = Date.now();
    if (now - cached.timestamp > this.CACHE_TTL) {
      this.translationCache.delete(cacheKey);
      return null;
    }

    console.log("[TranslationService] Cache HIT - returning cached translation");
    return cached.translatedText;
  }

  private saveToCache(cacheKey: string, translatedText: string): void {
    // Limit cache size
    if (this.translationCache.size >= this.MAX_CACHE_SIZE) {
      // Remove oldest entry
      const firstKey = this.translationCache.keys().next().value;
      this.translationCache.delete(firstKey);
    }

    this.translationCache.set(cacheKey, {
      translatedText,
      timestamp: Date.now(),
    });
    console.log("[TranslationService] Saved to cache. Cache size:", this.translationCache.size);
  }

  async translate(config: TranslationConfig): Promise<TranslationResult> {
    const { text, sourceLanguage, targetLanguage, provider, apiKey, model } = config;

    if (!text || !apiKey) {
      return {
        translatedText: text,
        success: false,
        error: "Missing text or API key",
      };
    }

    // If source and target are the same, no translation needed
    if (sourceLanguage === targetLanguage) {
      return {
        translatedText: text,
        success: true,
      };
    }

    // Check cache first
    const cacheKey = this.getCacheKey(text, sourceLanguage, targetLanguage);
    const cachedTranslation = this.getFromCache(cacheKey);
    if (cachedTranslation) {
      return {
        translatedText: cachedTranslation,
        success: true,
      };
    }

    const sourceLang = getLanguageLabel(sourceLanguage);
    const targetLang = getLanguageLabel(targetLanguage);

    const prompt = `Translate the following text from ${sourceLang} to ${targetLang}. Only output the translation, nothing else:\n\n${text}`;

    try {
      let result: TranslationResult;

      switch (provider) {
        case "openai":
          result = await this.translateWithOpenAI(prompt, apiKey, model || "gpt-4o-mini");
          break;
        case "anthropic":
          result = await this.translateWithAnthropic(
            prompt,
            apiKey,
            model || "claude-3-5-haiku-20241022"
          );
          break;
        case "gemini":
          result = await this.translateWithGemini(prompt, apiKey, model || "gemini-2.5-flash");
          break;
        default:
          result = {
            translatedText: text,
            success: false,
            error: `Unknown provider: ${provider}`,
          };
      }

      // Save successful translations to cache
      if (result.success && result.translatedText) {
        this.saveToCache(cacheKey, result.translatedText);
      }

      return result;
    } catch (error) {
      console.error("Translation error:", error);
      return {
        translatedText: text,
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }

  private async translateWithOpenAI(
    prompt: string,
    apiKey: string,
    model: string
  ): Promise<TranslationResult> {
    try {
      console.log("[TranslationService OpenAI] Starting translation with model:", model);
      console.log("[TranslationService OpenAI] API key exists:", !!apiKey);

      // Try Responses API first (newer models)
      const baseUrl = localStorage.getItem("cloudReasoningBaseUrl") || "https://api.openai.com/v1";
      console.log("[TranslationService OpenAI] Using base URL:", baseUrl);

      // Check if model requires Responses API
      const requiresResponsesApi =
        model.startsWith("gpt-5") || model.startsWith("o3") || model.startsWith("o4");

      console.log("[TranslationService OpenAI] Requires Responses API:", requiresResponsesApi);

      if (requiresResponsesApi) {
        console.log("[TranslationService OpenAI] Using Responses API endpoint");
        const response = await fetch(`${baseUrl}/responses`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${apiKey}`,
          },
          body: JSON.stringify({
            model,
            input: [{ type: "text", text: prompt }],
          }),
        });

        console.log("[TranslationService OpenAI] Response status:", response.status);

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          console.error("[TranslationService OpenAI] API error details:", errorData);
          throw new Error(`OpenAI API error: ${response.statusText} - ${JSON.stringify(errorData)}`);
        }

        const data = await response.json();
        console.log("[TranslationService OpenAI] Response data:", data);
        const translatedText = data.output?.[0]?.text || data.output?.[0]?.content?.[0]?.text || "";

        return {
          translatedText: translatedText.trim(),
          success: true,
        };
      }

      // Use Chat Completions API for older models
      console.log("[TranslationService OpenAI] Using Chat Completions API endpoint");
      const response = await fetch(`${baseUrl}/chat/completions`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model,
          messages: [{ role: "user", content: prompt }],
          temperature: 0.3,
          max_tokens: 2000,
        }),
      });

      console.log("[TranslationService OpenAI] Response status:", response.status);

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        console.error("[TranslationService OpenAI] API error details:", errorData);
        throw new Error(`OpenAI API error: ${response.statusText} - ${JSON.stringify(errorData)}`);
      }

      const data = await response.json();
      console.log("[TranslationService OpenAI] Response data:", data);
      const translatedText = data.choices?.[0]?.message?.content || "";

      return {
        translatedText: translatedText.trim(),
        success: true,
      };
    } catch (error) {
      console.error("[TranslationService OpenAI] Translation error:", error);
      throw error;
    }
  }

  private async translateWithAnthropic(
    prompt: string,
    apiKey: string,
    model: string
  ): Promise<TranslationResult> {
    try {
      console.log("[TranslationService Anthropic] Starting translation with model:", model);
      console.log("[TranslationService Anthropic] API key exists:", !!apiKey);

      // Use IPC for Anthropic to avoid CORS
      if (typeof window !== "undefined" && window.electronAPI?.anthropicRequest) {
        console.log("[TranslationService Anthropic] Using IPC bridge");
        const result = await window.electronAPI.anthropicRequest({
          model,
          messages: [{ role: "user", content: prompt }],
          max_tokens: 2000,
          temperature: 0.3,
        });

        console.log("[TranslationService Anthropic] Response received:", result);

        if (result.error) {
          console.error("[TranslationService Anthropic] API error:", result.error);
          throw new Error(result.error);
        }

        const translatedText = result.content?.[0]?.text || "";
        console.log("[TranslationService Anthropic] Translation successful");
        return {
          translatedText: translatedText.trim(),
          success: true,
        };
      }

      console.error("[TranslationService Anthropic] IPC bridge not available");
      throw new Error("Anthropic IPC bridge not available");
    } catch (error) {
      console.error("[TranslationService Anthropic] Translation error:", error);
      throw error;
    }
  }

  private async translateWithGemini(
    prompt: string,
    apiKey: string,
    model: string
  ): Promise<TranslationResult> {
    try {
      console.log("[TranslationService Gemini] Starting translation with model:", model);
      console.log("[TranslationService Gemini] API key exists:", !!apiKey);

      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            contents: [
              {
                parts: [{ text: prompt }],
              },
            ],
            generationConfig: {
              temperature: 0.3,
              maxOutputTokens: 2000,
            },
          }),
        }
      );

      console.log("[TranslationService Gemini] Response status:", response.status);

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        console.error("[TranslationService Gemini] API error details:", errorData);
        throw new Error(`Gemini API error: ${response.statusText} - ${JSON.stringify(errorData)}`);
      }

      const data = await response.json();
      console.log("[TranslationService Gemini] Response data:", data);
      const translatedText = data.candidates?.[0]?.content?.parts?.[0]?.text || "";

      console.log("[TranslationService Gemini] Translation successful");
      return {
        translatedText: translatedText.trim(),
        success: true,
      };
    } catch (error) {
      console.error("[TranslationService Gemini] Translation error:", error);
      throw error;
    }
  }
}

export default new TranslationService();
