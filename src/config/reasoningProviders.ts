import { modelRegistry } from "../models/ModelRegistry";

// Reasoning model configuration with provider abstraction
export const REASONING_PROVIDERS = {
  openai: {
    name: "OpenAI",
    models: [
      // GPT-5 Series (Latest)
      {
        value: "gpt-5-nano",
        label: "GPT-5 Nano",
        description: "Ultra-fast, low latency",
      },
      {
        value: "gpt-5-mini",
        label: "GPT-5 Mini",
        description: "Fast and cost-efficient (default)",
      },
      {
        value: "gpt-5",
        label: "GPT-5",
        description: "Deep reasoning, multi-step logic",
      },
      // GPT-4.1 Series
      {
        value: "gpt-4.1-nano",
        label: "GPT-4.1 Nano",
        description: "Fastest, cheapest for low latency",
      },
      {
        value: "gpt-4.1-mini",
        label: "GPT-4.1 Mini",
        description: "Improved coding, 1M context",
      },
      {
        value: "gpt-4.1",
        label: "GPT-4.1",
        description: "Best GPT-4, June 2024 knowledge",
      },
      // o-series Reasoning Models
      {
        value: "o4-mini",
        label: "o4 Mini",
        description: "Fast reasoning, math & coding",
      },
      {
        value: "o3",
        label: "o3",
        description: "Advanced reasoning, longer thinking",
      },
      {
        value: "o3-pro",
        label: "o3 Pro",
        description: "Most intelligent, deepest reasoning",
      },
      // GPT-4o Series
      {
        value: "gpt-4o-mini",
        label: "GPT-4o Mini",
        description: "Multimodal, balanced performance",
      },
      {
        value: "gpt-4o",
        label: "GPT-4o",
        description: "Multimodal with vision support",
      },
    ],
  },
  anthropic: {
    name: "Anthropic",
    models: [
      {
        value: "claude-3-5-haiku-20241022",
        label: "Claude 3.5 Haiku",
        description: "Fast and efficient",
      },
      {
        value: "claude-3-5-sonnet-20241022",
        label: "Claude 3.5 Sonnet",
        description: "Balanced performance",
      },
      {
        value: "claude-sonnet-4-20250514",
        label: "Claude Sonnet 4",
        description: "Latest balanced model",
      },
      {
        value: "claude-opus-4-1-20250805",
        label: "Claude Opus 4.1",
        description: "Frontier intelligence",
      },
    ],
  },
  gemini: {
    name: "Google Gemini",
    models: [
      {
        value: "gemini-2.5-flash-lite",
        label: "Gemini 2.5 Flash Lite",
        description: "Fast and low-cost",
      },
      {
        value: "gemini-2.5-flash",
        label: "Gemini 2.5 Flash",
        description: "High-performance with thinking",
      },
      {
        value: "gemini-2.5-pro",
        label: "Gemini 2.5 Pro",
        description: "Most intelligent with thinking",
      },
      {
        value: "gemini-2.0-flash",
        label: "Gemini 2.0 Flash",
        description: "1M token context",
      },
    ],
  },
  local: {
    name: "Local AI",
    models: [], // Will be populated dynamically
  },
};

// Dynamically populate local models from registry
const localModels = modelRegistry.getAllModels();
REASONING_PROVIDERS.local.models = localModels.map((model) => ({
  value: model.id,
  label: model.name,
  description: `${model.description} (${model.size})`,
}));

export const getAllReasoningModels = () => {
  return Object.entries(REASONING_PROVIDERS).flatMap(([providerId, provider]) =>
    provider.models.map((model) => ({
      ...model,
      provider: providerId,
      fullLabel: `${provider.name} ${model.label}`,
    }))
  );
};

export const getReasoningModelLabel = (modelId: string): string => {
  const allModels = getAllReasoningModels();
  const model = allModels.find((m) => m.value === modelId);
  return model?.fullLabel || modelId;
};

export const getModelProvider = (modelId: string): string => {
  const allModels = getAllReasoningModels();
  const model = allModels.find((m) => m.value === modelId);

  // If model not found, try to infer from model name
  if (!model) {
    if (modelId.includes("claude")) return "anthropic";
    if (modelId.includes("gemini")) return "gemini";
    if (
      modelId.includes("gpt") ||
      modelId.includes("o3") ||
      modelId.includes("o4") ||
      modelId.includes("o1")
    )
      return "openai";
    if (modelId.includes("qwen") || modelId.includes("llama") || modelId.includes("mistral"))
      return "local";
  }

  return model?.provider || "openai";
};
