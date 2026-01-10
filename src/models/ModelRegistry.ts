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
      const model = provider.models.find((m) => m.id === modelId);
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
          providerId: provider.id,
        });
      }
    }

    return models;
  }

  private registerDefaultProviders() {
    // Qwen Provider
    this.registerProvider({
      id: "qwen",
      name: "Qwen",
      baseUrl: "https://huggingface.co",
      models: [
        {
          id: "qwen2.5-0.5b-instruct-q5_k_m",
          name: "Qwen2.5 0.5B",
          size: "0.4GB",
          sizeBytes: 429496729,
          description: "Smallest model, fast but limited capabilities",
          fileName: "qwen2.5-0.5b-instruct-q5_k_m.gguf",
          quantization: "q5_k_m",
          contextLength: 32768,
        },
        {
          id: "qwen2.5-1.5b-instruct-q5_k_m",
          name: "Qwen2.5 1.5B",
          size: "1.3GB",
          sizeBytes: 1395864371,
          description: "Small model, good for basic tasks",
          fileName: "qwen2.5-1.5b-instruct-q5_k_m.gguf",
          quantization: "q5_k_m",
          contextLength: 32768,
        },
        {
          id: "qwen2.5-3b-instruct-q5_k_m",
          name: "Qwen2.5 3B",
          size: "2.3GB",
          sizeBytes: 2469606195,
          description: "Balanced model for general use",
          fileName: "qwen2.5-3b-instruct-q5_k_m.gguf",
          quantization: "q5_k_m",
          contextLength: 32768,
        },
        {
          id: "qwen2.5-7b-instruct-q5_k_m",
          name: "Qwen2.5 7B",
          size: "5.4GB",
          sizeBytes: 5798205849,
          description: "Large model, high quality reasoning",
          fileName: "qwen2.5-7b-instruct-q5_k_m.gguf",
          quantization: "q5_k_m",
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
        return `${this.baseUrl}/Qwen/Qwen2.5-${model.name.split(" ")[1]}-Instruct-GGUF/resolve/main/${model.fileName}`;
      },
    });

    this.registerProvider({
      id: "mistral",
      name: "Mistral AI",
      baseUrl: "https://huggingface.co",
      models: [
        {
          id: "mistral-7b-instruct-v0.3-q4_k_m",
          name: "Mistral 7B Instruct v0.3",
          size: "4.4GB",
          sizeBytes: 4724956928,
          description: "Fast and efficient instruction model",
          fileName: "Mistral-7B-Instruct-v0.3-Q4_K_M.gguf",
          quantization: "q4_k_m",
          contextLength: 32768,
          recommended: true,
        },
        {
          id: "mistral-7b-instruct-v0.3-q5_k_m",
          name: "Mistral 7B Instruct v0.3 (Q5)",
          size: "5.1GB",
          sizeBytes: 5477387264,
          description: "Higher quality instruction model",
          fileName: "Mistral-7B-Instruct-v0.3-Q5_K_M.gguf",
          quantization: "q5_k_m",
          contextLength: 32768,
        },
        {
          id: "mistral-7b-v0.1-q4_k_m",
          name: "Mistral 7B v0.1",
          size: "4.4GB",
          sizeBytes: 4724956928,
          description: "Base model for general text",
          fileName: "mistral-7b-v0.1.Q4_K_M.gguf",
          quantization: "q4_k_m",
          contextLength: 32768,
        },
      ],
      formatPrompt(text: string, systemPrompt: string): string {
        return `[INST] ${systemPrompt}\n\n${text} [/INST]`;
      },
      getDownloadUrl(model: ModelDefinition): string {
        if (model.id.includes("v0.3")) {
          return `${this.baseUrl}/bartowski/Mistral-7B-Instruct-v0.3-GGUF/resolve/main/${model.fileName}`;
        }
        return `${this.baseUrl}/TheBloke/Mistral-7B-v0.1-GGUF/resolve/main/${model.fileName}`;
      },
    });

    // Llama Provider
    this.registerProvider({
      id: "llama",
      name: "Meta Llama",
      baseUrl: "https://huggingface.co",
      models: [
        {
          id: "llama-3.2-1b-instruct-q4_k_m",
          name: "Llama 3.2 1B",
          size: "0.9GB",
          sizeBytes: 966367642,
          description: "Tiny model for edge devices",
          fileName: "Llama-3.2-1B-Instruct-Q4_K_M.gguf",
          quantization: "q4_k_m",
          contextLength: 131072,
        },
        {
          id: "llama-3.2-3b-instruct-q4_k_m",
          name: "Llama 3.2 3B",
          size: "2.0GB",
          sizeBytes: 2147483648,
          description: "Small but capable multilingual model",
          fileName: "Llama-3.2-3B-Instruct-Q4_K_M.gguf",
          quantization: "q4_k_m",
          contextLength: 131072,
          recommended: true,
        },
        {
          id: "llama-3.1-8b-instruct-q4_k_m",
          name: "Llama 3.1 8B",
          size: "4.9GB",
          sizeBytes: 5260091802,
          description: "Powerful model with great performance",
          fileName: "Meta-Llama-3.1-8B-Instruct-Q4_K_M.gguf",
          quantization: "q4_k_m",
          contextLength: 131072,
        },
      ],
      formatPrompt(text: string, systemPrompt: string): string {
        return `<|begin_of_text|><|start_header_id|>system<|end_header_id|>

${systemPrompt}<|eot_id|><|start_header_id|>user<|end_header_id|>

${text}<|eot_id|><|start_header_id|>assistant<|end_header_id|>

`;
      },
      getDownloadUrl(model: ModelDefinition): string {
        if (model.id.includes("3.2")) {
          return `${this.baseUrl}/bartowski/Llama-3.2-${model.name.split(" ")[2]}-Instruct-GGUF/resolve/main/${model.fileName}`;
        }
        return `${this.baseUrl}/bartowski/Meta-Llama-3.1-8B-Instruct-GGUF/resolve/main/${model.fileName}`;
      },
    });

    // OpenAI OSS Provider
    this.registerProvider({
      id: "openai-oss",
      name: "OpenAI OSS",
      baseUrl: "https://huggingface.co",
      models: [
        {
          id: "gpt-oss-20b-q4_k_m",
          name: "GPT-OSS 20B",
          size: "12.1GB",
          sizeBytes: 12999763968,
          description: "OpenAI's open-source model for consumer hardware",
          fileName: "openai_gpt-oss-20b-Q4_K_M.gguf",
          quantization: "q4_k_m",
          contextLength: 128000,
          recommended: true,
        },
      ],
      formatPrompt(text: string, systemPrompt: string): string {
        // GPT-OSS uses ChatML format
        return `<|im_start|>system
${systemPrompt}<|im_end|>
<|im_start|>user
${text}<|im_end|>
<|im_start|>assistant
`;
      },
      getDownloadUrl(model: ModelDefinition): string {
        return `${this.baseUrl}/bartowski/openai_gpt-oss-20b-GGUF/resolve/main/${model.fileName}`;
      },
    });
  }
}

export const modelRegistry = ModelRegistry.getInstance();
