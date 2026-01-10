import modelDataRaw from './modelRegistryData.json';

// Types for local models (downloadable GGUF files)
export interface ModelDefinition {
  id: string;
  name: string;
  size: string;
  sizeBytes: number;
  description: string;
  fileName: string;
  quantization: string;
  contextLength: number;
  hfRepo: string;
  recommended?: boolean;
}

export interface LocalProviderData {
  id: string;
  name: string;
  baseUrl: string;
  promptTemplate: string;
  models: ModelDefinition[];
}

export interface ModelProvider {
  id: string;
  name: string;
  baseUrl: string;
  models: ModelDefinition[];
  formatPrompt(text: string, systemPrompt: string): string;
  getDownloadUrl(model: ModelDefinition): string;
}

// Types for cloud models (API-based)
export interface CloudModelDefinition {
  id: string;
  name: string;
  description: string;
}

export interface CloudProviderData {
  id: string;
  name: string;
  models: CloudModelDefinition[];
}

// Types for transcription providers (speech-to-text)
export interface TranscriptionModelDefinition {
  id: string;
  name: string;
  description: string;
}

export interface TranscriptionProviderData {
  id: string;
  name: string;
  baseUrl: string;
  models: TranscriptionModelDefinition[];
}

// Type-safe model registry data structure
interface ModelRegistryData {
  transcriptionProviders: TranscriptionProviderData[];
  cloudProviders: CloudProviderData[];
  localProviders: LocalProviderData[];
}

const modelData: ModelRegistryData = modelDataRaw as ModelRegistryData;

function createPromptFormatter(template: string): (text: string, systemPrompt: string) => string {
  return (text: string, systemPrompt: string) => {
    return template.replace('{system}', systemPrompt).replace('{user}', text);
  };
}

class ModelRegistry {
  private static instance: ModelRegistry;
  private providers = new Map<string, ModelProvider>();

  private constructor() {
    this.registerProvidersFromData();
  }

  static getInstance(): ModelRegistry {
    if (!ModelRegistry.instance) {
      ModelRegistry.instance = new ModelRegistry();
    }
    return ModelRegistry.instance;
  }

  registerProvider(provider: ModelProvider) {
    this.providers.set(provider.id, provider);
  }

  getProvider(providerId: string): ModelProvider | undefined {
    return this.providers.get(providerId);
  }

  getAllProviders(): ModelProvider[] {
    return Array.from(this.providers.values());
  }

  getModel(modelId: string): { model: ModelDefinition; provider: ModelProvider } | undefined {
    for (const provider of this.providers.values()) {
      const model = provider.models.find(m => m.id === modelId);
      if (model) {
        return { model, provider };
      }
    }
    return undefined;
  }

  getAllModels(): Array<ModelDefinition & { providerId: string }> {
    const models: Array<ModelDefinition & { providerId: string }> = [];
    for (const provider of this.providers.values()) {
      for (const model of provider.models) {
        models.push({ ...model, providerId: provider.id });
      }
    }
    return models;
  }

  getCloudProviders(): CloudProviderData[] {
    return modelData.cloudProviders;
  }

  getTranscriptionProviders(): TranscriptionProviderData[] {
    return modelData.transcriptionProviders;
  }

  private registerProvidersFromData() {
    const localProviders = modelData.localProviders;

    for (const providerData of localProviders) {
      const formatPrompt = createPromptFormatter(providerData.promptTemplate);

      this.registerProvider({
        id: providerData.id,
        name: providerData.name,
        baseUrl: providerData.baseUrl,
        models: providerData.models,
        formatPrompt,
        getDownloadUrl(model: ModelDefinition): string {
          return `${providerData.baseUrl}/${model.hfRepo}/resolve/main/${model.fileName}`;
        }
      });
    }
  }
}

export const modelRegistry = ModelRegistry.getInstance();

// Reasoning providers (flat structure for UI dropdowns)
export interface ReasoningModel {
  value: string;
  label: string;
  description: string;
}

export interface ReasoningProvider {
  name: string;
  models: ReasoningModel[];
}

export type ReasoningProviders = Record<string, ReasoningProvider>;

function buildReasoningProviders(): ReasoningProviders {
  const providers: ReasoningProviders = {};

  for (const cloudProvider of modelRegistry.getCloudProviders()) {
    providers[cloudProvider.id] = {
      name: cloudProvider.name,
      models: cloudProvider.models.map(m => ({
        value: m.id,
        label: m.name,
        description: m.description,
      })),
    };
  }

  providers.local = {
    name: "Local AI",
    models: modelRegistry.getAllModels().map(model => ({
      value: model.id,
      label: model.name,
      description: `${model.description} (${model.size})`,
    })),
  };

  return providers;
}

export const REASONING_PROVIDERS = buildReasoningProviders();

export interface ReasoningModelWithProvider extends ReasoningModel {
  provider: string;
  fullLabel: string;
}

export function getAllReasoningModels(): ReasoningModelWithProvider[] {
  return Object.entries(REASONING_PROVIDERS).flatMap(([providerId, provider]) =>
    provider.models.map((model) => ({
      ...model,
      provider: providerId,
      fullLabel: `${provider.name} ${model.label}`,
    }))
  );
}

export function getReasoningModelLabel(modelId: string): string {
  const model = getAllReasoningModels().find((m) => m.value === modelId);
  return model?.fullLabel || modelId;
}

export function getModelProvider(modelId: string): string {
  const model = getAllReasoningModels().find((m) => m.value === modelId);

  if (!model) {
    // Infer provider from model name pattern
    if (modelId.includes("claude")) return "anthropic";
    // Check for gemini but exclude gemma (which could be Groq or local)
    if (modelId.includes("gemini") && !modelId.includes("gemma")) return "gemini";
    // OpenAI cloud models (gpt-4.x, gpt-5.x but NOT gpt-oss which could be Groq)
    if ((modelId.includes("gpt-4") || modelId.includes("gpt-5")) && !modelId.includes("gpt-oss")) return "openai";
    // Groq-specific model patterns (these run on Groq cloud, not local)
    // Groq models have patterns like "qwen/", "openai/gpt-oss-", "llama-3.1-8b-instant", "llama-3.3-", "mixtral-", "gemma2-"
    if (modelId.includes("qwen/") || modelId.includes("openai/") ||
        modelId.includes("llama-3.1-8b-instant") || modelId.includes("llama-3.3-") ||
        modelId.includes("mixtral-") || modelId.includes("gemma2-")) return "groq";
    // Local models have patterns like "qwen2.5-", "qwen3-", "llama-3.2-", "mistral-", "gpt-oss-20b-mxfp4"
    if (modelId.includes("qwen") || modelId.includes("llama") ||
        modelId.includes("mistral") || modelId.includes("gpt-oss-20b-mxfp4")) return "local";
  }

  return model?.provider || "openai";
}

// Transcription provider helpers
export function getTranscriptionProviders(): TranscriptionProviderData[] {
  return modelRegistry.getTranscriptionProviders();
}

export function getTranscriptionProvider(providerId: string): TranscriptionProviderData | undefined {
  return getTranscriptionProviders().find(p => p.id === providerId);
}

export function getTranscriptionModels(providerId: string): TranscriptionModelDefinition[] {
  const provider = getTranscriptionProvider(providerId);
  return provider?.models || [];
}

export function getDefaultTranscriptionModel(providerId: string): string {
  const models = getTranscriptionModels(providerId);
  return models[0]?.id || 'gpt-4o-mini-transcribe';
}
