import modelData from './modelRegistryData.json';

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
    return modelData.cloudProviders as CloudProviderData[];
  }

  private registerProvidersFromData() {
    const localProviders = modelData.localProviders as LocalProviderData[];

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
    if (modelId.includes("gemini")) return "gemini";
    if (modelId.includes("gpt-4") || modelId.includes("gpt-5")) return "openai";
    if (modelId.includes("qwen") || modelId.includes("llama") || modelId.includes("mistral")) return "local";
  }

  return model?.provider || "openai";
}
