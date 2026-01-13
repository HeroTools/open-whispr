import { getModelProvider } from "../models/ModelRegistry";
import { SecureCache } from "../utils/SecureCache";
import { withRetry, createApiRetryStrategy } from "../utils/retry";
import { API_ENDPOINTS, TOKEN_LIMITS, buildApiUrl } from "../config/constants";
import logger from "../utils/logger";

// Cache configuration for translations
const TRANSLATION_CACHE_TTL = 3600000; // 1 hour
const TRANSLATION_CACHE_MAX_SIZE = 100;

export interface TranslationConfig {
  maxTokens?: number;
  temperature?: number;
  sourceLanguage?: string;
  targetLanguage: string;
}

interface TranslationCacheEntry {
  translatedText: string;
  sourceLanguage: string;
  targetLanguage: string;
  model: string;
}

class TranslationService {
  private isProcessing = false;
  private translationCache: SecureCache<TranslationCacheEntry>;
  private apiKeyCache: SecureCache<string>;
  private cacheCleanupStop: (() => void) | undefined;
  private cacheSize = 0;

  constructor() {
    this.translationCache = new SecureCache(TRANSLATION_CACHE_TTL);
    this.apiKeyCache = new SecureCache();
    this.cacheCleanupStop = this.translationCache.startAutoCleanup();
  }

  /**
   * Generate a cache key for translation lookups
   */
  private getCacheKey(text: string, targetLanguage: string, model: string): string {
    // Simple hash combining text, target language, and model
    const input = `${text}|${targetLanguage}|${model}`;
    let hash = 0;
    for (let i = 0; i < input.length; i++) {
      const char = input.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return `trans_${hash.toString(36)}`;
  }

  /**
   * Check if a translation is cached
   */
  getCachedTranslation(
    text: string,
    targetLanguage: string,
    model: string
  ): string | undefined {
    const key = this.getCacheKey(text, targetLanguage, model);
    const entry = this.translationCache.get(key);

    if (entry) {
      logger.logReasoning("TRANSLATION_CACHE_HIT", {
        targetLanguage,
        model,
        textLength: text.length,
      });
      return entry.translatedText;
    }

    return undefined;
  }

  /**
   * Store a translation in the cache
   */
  private cacheTranslation(
    text: string,
    translatedText: string,
    sourceLanguage: string,
    targetLanguage: string,
    model: string
  ): void {
    // Enforce max cache size by cleaning up if needed
    if (this.cacheSize >= TRANSLATION_CACHE_MAX_SIZE) {
      this.translationCache.cleanup();
      this.cacheSize = Math.floor(this.cacheSize * 0.8); // Rough estimate after cleanup
    }

    const key = this.getCacheKey(text, targetLanguage, model);
    this.translationCache.set(key, {
      translatedText,
      sourceLanguage,
      targetLanguage,
      model,
    });
    this.cacheSize++;

    logger.logReasoning("TRANSLATION_CACHED", {
      targetLanguage,
      model,
      textLength: text.length,
      cacheSize: this.cacheSize,
    });
  }

  /**
   * Get API key for the specified provider
   */
  private async getApiKey(
    provider: "openai" | "anthropic" | "gemini" | "groq"
  ): Promise<string> {
    let apiKey = this.apiKeyCache.get(provider);

    if (!apiKey) {
      try {
        const keyGetters = {
          openai: () => window.electronAPI.getOpenAIKey(),
          anthropic: () => window.electronAPI.getAnthropicKey(),
          gemini: () => window.electronAPI.getGeminiKey(),
          groq: () => window.electronAPI.getGroqKey(),
        };
        apiKey = (await keyGetters[provider]()) ?? undefined;

        if (apiKey) {
          this.apiKeyCache.set(provider, apiKey);
        }
      } catch (error) {
        logger.logReasoning(`${provider.toUpperCase()}_KEY_FETCH_ERROR`, {
          error: (error as Error).message,
        });
      }
    }

    if (!apiKey) {
      throw new Error(
        `${provider.charAt(0).toUpperCase() + provider.slice(1)} API key not configured`
      );
    }

    return apiKey;
  }

  /**
   * Build the translation prompt
   */
  private getTranslationPrompt(
    text: string,
    config: TranslationConfig
  ): string {
    const { sourceLanguage, targetLanguage } = config;

    if (sourceLanguage && sourceLanguage !== "auto") {
      return `Translate the following text from ${sourceLanguage} to ${targetLanguage}. Output ONLY the translation without any explanations or commentary:\n\n${text}`;
    }

    return `Translate the following text to ${targetLanguage}. Output ONLY the translation without any explanations or commentary:\n\n${text}`;
  }

  /**
   * Calculate optimal max tokens for translation
   */
  private calculateMaxTokens(textLength: number): number {
    // Translations may be longer than source text, so allow more tokens
    return Math.max(
      TOKEN_LIMITS.MIN_TOKENS,
      Math.min(textLength * 3, TOKEN_LIMITS.MAX_TOKENS)
    );
  }

  /**
   * Translate text using the specified model
   */
  async translate(
    text: string,
    model: string,
    config: TranslationConfig
  ): Promise<string> {
    const trimmedText = text?.trim();
    if (!trimmedText) {
      return "";
    }

    const trimmedModel = model?.trim();
    if (!trimmedModel) {
      throw new Error("No translation model selected");
    }

    // Check cache first
    const cached = this.getCachedTranslation(
      trimmedText,
      config.targetLanguage,
      trimmedModel
    );
    if (cached) {
      return cached;
    }

    const provider = getModelProvider(trimmedModel);

    logger.logReasoning("TRANSLATION_START", {
      model: trimmedModel,
      provider,
      targetLanguage: config.targetLanguage,
      sourceLanguage: config.sourceLanguage || "auto",
      textLength: trimmedText.length,
    });

    if (this.isProcessing) {
      throw new Error("Translation already in progress");
    }

    this.isProcessing = true;

    try {
      let result: string;
      const startTime = Date.now();

      switch (provider) {
        case "openai":
          result = await this.translateWithOpenAI(trimmedText, trimmedModel, config);
          break;
        case "anthropic":
          result = await this.translateWithAnthropic(trimmedText, trimmedModel, config);
          break;
        case "gemini":
          result = await this.translateWithGemini(trimmedText, trimmedModel, config);
          break;
        case "groq":
          result = await this.translateWithGroq(trimmedText, trimmedModel, config);
          break;
        default:
          throw new Error(`Unsupported translation provider: ${provider}`);
      }

      const processingTime = Date.now() - startTime;

      logger.logReasoning("TRANSLATION_SUCCESS", {
        provider,
        model: trimmedModel,
        processingTimeMs: processingTime,
        resultLength: result.length,
      });

      // Cache the result
      this.cacheTranslation(
        trimmedText,
        result,
        config.sourceLanguage || "auto",
        config.targetLanguage,
        trimmedModel
      );

      return result;
    } catch (error) {
      logger.logReasoning("TRANSLATION_ERROR", {
        provider,
        model: trimmedModel,
        error: (error as Error).message,
      });
      throw error;
    } finally {
      this.isProcessing = false;
    }
  }

  private async translateWithOpenAI(
    text: string,
    model: string,
    config: TranslationConfig
  ): Promise<string> {
    const apiKey = await this.getApiKey("openai");
    const prompt = this.getTranslationPrompt(text, config);

    const systemPrompt =
      "You are a professional translator. Translate text accurately while preserving the original meaning, tone, and style. Output only the translation.";

    const messages = [
      { role: "system", content: systemPrompt },
      { role: "user", content: prompt },
    ];

    const requestBody = {
      model,
      messages,
      temperature: config.temperature ?? 0.3,
      max_tokens: config.maxTokens || this.calculateMaxTokens(text.length),
    };

    const endpoint = buildApiUrl(API_ENDPOINTS.OPENAI_BASE, "/chat/completions");

    const response = await withRetry(async () => {
      const res = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify(requestBody),
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({ error: res.statusText }));
        throw new Error(errorData.error?.message || `OpenAI API error: ${res.status}`);
      }

      return res.json();
    }, createApiRetryStrategy());

    const responseText = response.choices?.[0]?.message?.content?.trim();
    if (!responseText) {
      throw new Error("OpenAI returned empty translation");
    }

    return responseText;
  }

  private async translateWithAnthropic(
    text: string,
    model: string,
    config: TranslationConfig
  ): Promise<string> {
    // Use IPC to communicate with main process for Anthropic API
    if (typeof window !== "undefined" && window.electronAPI) {
      const prompt = this.getTranslationPrompt(text, config);

      const result = await window.electronAPI.processAnthropicReasoning(
        prompt,
        model,
        null,
        {
          maxTokens: config.maxTokens || this.calculateMaxTokens(text.length),
          temperature: config.temperature ?? 0.3,
        }
      );

      if (result.success) {
        return result.text;
      } else {
        throw new Error(result.error);
      }
    }

    throw new Error("Anthropic translation is not available in this environment");
  }

  private async translateWithGemini(
    text: string,
    model: string,
    config: TranslationConfig
  ): Promise<string> {
    const apiKey = await this.getApiKey("gemini");
    const prompt = this.getTranslationPrompt(text, config);

    const systemPrompt =
      "You are a professional translator. Translate text accurately while preserving the original meaning, tone, and style. Output only the translation.";

    const requestBody = {
      contents: [
        {
          parts: [{ text: `${systemPrompt}\n\n${prompt}` }],
        },
      ],
      generationConfig: {
        temperature: config.temperature ?? 0.3,
        maxOutputTokens: config.maxTokens || this.calculateMaxTokens(text.length),
      },
    };

    const response = await withRetry(async () => {
      const res = await fetch(
        `${API_ENDPOINTS.GEMINI}/models/${model}:generateContent`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-goog-api-key": apiKey,
          },
          body: JSON.stringify(requestBody),
        }
      );

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({ error: res.statusText }));
        throw new Error(errorData.error?.message || `Gemini API error: ${res.status}`);
      }

      return res.json();
    }, createApiRetryStrategy());

    const responseText = response.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
    if (!responseText) {
      throw new Error("Gemini returned empty translation");
    }

    return responseText;
  }

  private async translateWithGroq(
    text: string,
    model: string,
    config: TranslationConfig
  ): Promise<string> {
    const apiKey = await this.getApiKey("groq");
    const prompt = this.getTranslationPrompt(text, config);

    const systemPrompt =
      "You are a professional translator. Translate text accurately while preserving the original meaning, tone, and style. Output only the translation.";

    const messages = [
      { role: "system", content: systemPrompt },
      { role: "user", content: prompt },
    ];

    const requestBody = {
      model,
      messages,
      temperature: config.temperature ?? 0.3,
      max_tokens: config.maxTokens || this.calculateMaxTokens(text.length),
    };

    const endpoint = buildApiUrl(API_ENDPOINTS.GROQ_BASE, "/chat/completions");

    const response = await withRetry(async () => {
      const res = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify(requestBody),
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({ error: res.statusText }));
        throw new Error(errorData.error?.message || `Groq API error: ${res.status}`);
      }

      return res.json();
    }, createApiRetryStrategy());

    const responseText = response.choices?.[0]?.message?.content?.trim();
    if (!responseText) {
      throw new Error("Groq returned empty translation");
    }

    return responseText;
  }

  /**
   * Check if translation service is available
   */
  async isAvailable(): Promise<boolean> {
    try {
      const openaiKey = await window.electronAPI?.getOpenAIKey?.();
      const anthropicKey = await window.electronAPI?.getAnthropicKey?.();
      const geminiKey = await window.electronAPI?.getGeminiKey?.();
      const groqKey = await window.electronAPI?.getGroqKey?.();

      return !!(openaiKey || anthropicKey || geminiKey || groqKey);
    } catch {
      return false;
    }
  }

  /**
   * Clear the translation cache
   */
  clearCache(): void {
    this.translationCache.clear();
    this.cacheSize = 0;
    logger.logReasoning("TRANSLATION_CACHE_CLEARED", {});
  }

  /**
   * Clean up resources
   */
  destroy(): void {
    if (this.cacheCleanupStop) {
      this.cacheCleanupStop();
    }
  }
}

export default new TranslationService();
