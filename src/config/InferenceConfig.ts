import { cpus } from "os";

export interface InferenceConfig {
  temperature: number;
  maxTokens: number;
  topK: number;
  topP: number;
  repeatPenalty: number;
  threads: number;
  contextSize: number;
  timeout: number;
}

export class InferenceConfigManager {
  private static instance: InferenceConfigManager;
  private config: InferenceConfig;

  private constructor() {
    this.config = this.getDefaultConfig();
  }

  static getInstance(): InferenceConfigManager {
    if (!InferenceConfigManager.instance) {
      InferenceConfigManager.instance = new InferenceConfigManager();
    }
    return InferenceConfigManager.instance;
  }

  getConfig(): InferenceConfig {
    return { ...this.config };
  }

  updateConfig(updates: Partial<InferenceConfig>) {
    this.config = {
      ...this.config,
      ...updates,
    };
  }

  getOptimalThreadCount(): number {
    // Use 75% of available CPUs for optimal performance
    const cpuCount = cpus().length;
    return Math.max(1, Math.floor(cpuCount * 0.75));
  }

  private getDefaultConfig(): InferenceConfig {
    return {
      temperature: 0.3,
      maxTokens: 512,
      topK: 40,
      topP: 0.9,
      repeatPenalty: 1.1,
      threads: this.getOptimalThreadCount(),
      contextSize: 2048,
      timeout: 30000,
    };
  }

  // Get config optimized for specific use cases
  getConfigForUseCase(useCase: "reasoning" | "creative" | "factual"): Partial<InferenceConfig> {
    switch (useCase) {
      case "reasoning":
        return {
          temperature: 0.3,
          topK: 40,
          topP: 0.9,
          repeatPenalty: 1.1,
        };
      case "creative":
        return {
          temperature: 0.8,
          topK: 100,
          topP: 0.95,
          repeatPenalty: 1.0,
        };
      case "factual":
        return {
          temperature: 0.1,
          topK: 20,
          topP: 0.85,
          repeatPenalty: 1.2,
        };
    }
  }
}

export const inferenceConfig = InferenceConfigManager.getInstance();
