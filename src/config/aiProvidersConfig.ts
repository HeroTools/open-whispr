export interface AIModel {
  value: string;
  label: string;
  description: string;
  size?: string;
}

export interface AIProvider {
  id: string;
  name: string;
  models: AIModel[];
}

export interface AIMode {
  id: 'cloud' | 'local';
  name: string;
  providers: AIProvider[];
}

export const AI_MODES: AIMode[] = [
  {
    id: 'cloud',
    name: 'Cloud AI',
    providers: [
      {
        id: 'openai',
        name: 'OpenAI',
        models: [
          {
            value: 'gpt-3.5-turbo',
            label: 'GPT-3.5 Turbo',
            description: 'Fast and efficient for most tasks'
          },
          {
            value: 'gpt-4o-mini',
            label: 'GPT-4o Mini',
            description: 'Higher quality reasoning'
          },
          {
            value: 'gpt-4-turbo-preview',
            label: 'GPT-4 Turbo',
            description: 'Most capable model'
          }
        ]
      },
      {
        id: 'anthropic',
        name: 'Anthropic',
        models: [
          {
            value: 'claude-3-haiku-20240307',
            label: 'Claude 3 Haiku',
            description: 'Fast and affordable'
          },
          {
            value: 'claude-3-sonnet-20240229',
            label: 'Claude 3 Sonnet',
            description: 'Balanced performance'
          },
          {
            value: 'claude-3-opus-20240229',
            label: 'Claude 3 Opus',
            description: 'Most capable Claude model'
          }
        ]
      }
    ]
  },
  {
    id: 'local',
    name: 'Local AI',
    providers: [
      {
        id: 'qwen',
        name: 'Qwen',
        models: [
          {
            value: 'qwen2.5-0.5b-instruct-q5_k_m',
            label: 'Qwen 2.5 0.5B',
            description: 'Smallest, fast but limited',
            size: '0.4GB'
          },
          {
            value: 'qwen2.5-1.5b-instruct-q5_k_m',
            label: 'Qwen 2.5 1.5B',
            description: 'Small, good for basic tasks',
            size: '1.3GB'
          },
          {
            value: 'qwen2.5-3b-instruct-q5_k_m',
            label: 'Qwen 2.5 3B',
            description: 'Balanced for general use',
            size: '2.3GB'
          },
          {
            value: 'qwen2.5-7b-instruct-q4km',
            label: 'Qwen 2.5 7B (Q4_K_M)',
            description: 'Large, high quality',
            size: '4.7GB'
          },
          {
            value: 'qwen2.5-7b-instruct-q5_k_m',
            label: 'Qwen 2.5 7B (Q5_K_M)',
            description: 'Large, highest quality',
            size: '5.4GB'
          }
        ]
      },
      {
        id: 'mistral',
        name: 'Mistral',
        models: [
          {
            value: 'mistral-7b-instruct-v0.2-q4_k_m',
            label: 'Mistral 7B v0.2',
            description: 'Popular open model',
            size: '4.1GB'
          },
          {
            value: 'mixtral-8x7b-instruct-v0.1-q3_k_m',
            label: 'Mixtral 8x7B',
            description: 'MoE architecture, very capable',
            size: '26.4GB'
          }
        ]
      },
      {
        id: 'llama',
        name: 'Meta Llama',
        models: [
          {
            value: 'llama-3.2-1b-instruct-q5_k_m',
            label: 'Llama 3.2 1B',
            description: 'Small and efficient',
            size: '1.0GB'
          },
          {
            value: 'llama-3.2-3b-instruct-q4_k_m',
            label: 'Llama 3.2 3B',
            description: 'Good balance',
            size: '2.0GB'
          },
          {
            value: 'llama-3.1-8b-instruct-q4_k_m',
            label: 'Llama 3.1 8B',
            description: 'Large, high quality',
            size: '4.7GB'
          }
        ]
      }
    ]
  }
];

export function getAIMode(modeId: 'cloud' | 'local'): AIMode | undefined {
  return AI_MODES.find(mode => mode.id === modeId);
}

export function getAIProvider(modeId: 'cloud' | 'local', providerId: string): AIProvider | undefined {
  const mode = getAIMode(modeId);
  return mode?.providers.find(provider => provider.id === providerId);
}

export function getAIModel(modeId: 'cloud' | 'local', providerId: string, modelId: string): AIModel | undefined {
  const provider = getAIProvider(modeId, providerId);
  return provider?.models.find(model => model.value === modelId);
}

export function detectModeFromModel(modelId: string): { mode: 'cloud' | 'local', providerId: string } | undefined {
  for (const mode of AI_MODES) {
    for (const provider of mode.providers) {
      if (provider.models.some(model => model.value === modelId)) {
        return { mode: mode.id, providerId: provider.id };
      }
    }
  }
  return undefined;
}