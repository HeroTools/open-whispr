export interface ModelDefinition {
  id: string;
  name: string;
  size: string;
  sizeBytes: number;
  description: string;
  fileName: string;
  quantization: string;
  contextLength: number;
  recommended?: boolean;
}

export interface ModelProvider {
  id: string;
  name: string;
  baseUrl: string;
  models: ModelDefinition[];
  formatPrompt(text: string, systemPrompt: string): string;
  getDownloadUrl(model: ModelDefinition): string;
}

export interface InferenceOptions {
  maxTokens?: number;
  temperature?: number;
  topK?: number;
  topP?: number;
  repeatPenalty?: number;
  contextSize?: number;
  threads?: number;
  stream?: boolean;
}

class ModelRegistry {
  private static instance: ModelRegistry;
  private providers = new Map<string, ModelProvider>();

  private constructor() {
    this.registerDefaultProviders();
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
        models.push({
          ...model,
          providerId: provider.id
        });
      }
    }
    
    return models;
  }

  private registerDefaultProviders() {
    // Qwen Provider
    this.registerProvider({
      id: 'qwen',
      name: 'Qwen',
      baseUrl: 'https://huggingface.co',
      models: [
        {
          id: 'qwen2.5-0.5b-instruct-q5_k_m',
          name: 'Qwen2.5 0.5B',
          size: '0.4GB',
          sizeBytes: 429496729,
          description: 'Smallest model, fast but limited capabilities',
          fileName: 'qwen2.5-0.5b-instruct-q5_k_m.gguf',
          quantization: 'q5_k_m',
          contextLength: 32768,
        },
        {
          id: 'qwen2.5-1.5b-instruct-q5_k_m',
          name: 'Qwen2.5 1.5B',
          size: '1.3GB',
          sizeBytes: 1395864371,
          description: 'Small model, good for basic tasks',
          fileName: 'qwen2.5-1.5b-instruct-q5_k_m.gguf',
          quantization: 'q5_k_m',
          contextLength: 32768,
        },
        {
          id: 'qwen2.5-3b-instruct-q5_k_m',
          name: 'Qwen2.5 3B',
          size: '2.3GB',
          sizeBytes: 2469606195,
          description: 'Balanced model for general use',
          fileName: 'qwen2.5-3b-instruct-q5_k_m.gguf',
          quantization: 'q5_k_m',
          contextLength: 32768,
        },
        {
          id: 'qwen2.5-7b-instruct-q5_k_m',
          name: 'Qwen2.5 7B',
          size: '5.4GB',
          sizeBytes: 5798205849,
          description: 'Large model, high quality reasoning',
          fileName: 'qwen2.5-7b-instruct-q5_k_m.gguf',
          quantization: 'q5_k_m',
          contextLength: 128000,
          recommended: true,
        },
      ],
      formatPrompt(text: string, systemPrompt: string): string {
        return `<|im_start|>system
${systemPrompt}<|im_end|>
<|im_start|>user
${text}<|im_end|>
<|im_start|>assistant
`;
      },
      getDownloadUrl(model: ModelDefinition): string {
        return `${this.baseUrl}/Qwen/Qwen2.5-${model.name.split(' ')[1]}-Instruct-GGUF/resolve/main/${model.fileName}`;
      }
    });

    // Future: Add Mistral provider
    // this.registerProvider({
    //   id: 'mistral',
    //   name: 'Mistral AI',
    //   baseUrl: 'https://huggingface.co',
    //   models: [...],
    //   formatPrompt: ...,
    //   getDownloadUrl: ...
    // });
  }
}

export const modelRegistry = ModelRegistry.getInstance();