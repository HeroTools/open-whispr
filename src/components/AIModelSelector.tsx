import React, { useState, useEffect } from 'react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Select } from './ui/select';
import { LocalModelManager } from './LocalModelManager';
import ApiKeyInput from './ui/ApiKeyInput';
import { AI_MODES, detectModeFromModel } from '../config/aiProvidersConfig';
import { Cloud, HardDrive } from 'lucide-react';

interface AIModelSelectorProps {
  currentModel: string;
  onModelChange: (model: string) => void;
  onProviderChange: (provider: string) => void;
  openaiApiKey: string;
  setOpenaiApiKey: (key: string) => void;
  anthropicApiKey: string;
  setAnthropicApiKey: (key: string) => void;
  pasteFromClipboard: (setter: (value: string) => void) => void;
  showAlertDialog: (dialog: { title: string; description: string }) => void;
}

export default function AIModelSelector({
  currentModel,
  onModelChange,
  onProviderChange,
  openaiApiKey,
  setOpenaiApiKey,
  anthropicApiKey,
  setAnthropicApiKey,
  pasteFromClipboard,
  showAlertDialog,
}: AIModelSelectorProps) {
  // Detect current mode and provider from the selected model
  const detected = detectModeFromModel(currentModel);
  const [selectedMode, setSelectedMode] = useState<'cloud' | 'local'>(detected?.mode || 'cloud');
  const [selectedProvider, setSelectedProvider] = useState(detected?.providerId || 'openai');

  // Get available providers for the selected mode
  const currentMode = AI_MODES.find(mode => mode.id === selectedMode);
  const currentProvider = currentMode?.providers.find(p => p.id === selectedProvider);

  useEffect(() => {
    // Update parent when provider changes
    onProviderChange(selectedProvider);
  }, [selectedProvider, onProviderChange]);

  const handleModeChange = (newMode: 'cloud' | 'local') => {
    setSelectedMode(newMode);
    
    // Select first provider in the new mode
    const mode = AI_MODES.find(m => m.id === newMode);
    if (mode && mode.providers.length > 0) {
      const firstProvider = mode.providers[0];
      setSelectedProvider(firstProvider.id);
      
      // Select first model in the provider
      if (firstProvider.models.length > 0) {
        onModelChange(firstProvider.models[0].value);
      }
    }
  };

  const handleProviderChange = (newProvider: string) => {
    setSelectedProvider(newProvider);
    
    // Select first model in the new provider
    const provider = currentMode?.providers.find(p => p.id === newProvider);
    if (provider && provider.models.length > 0) {
      onModelChange(provider.models[0].value);
    }
  };

  return (
    <div className="space-y-4">
      {/* Cloud vs Local Selection */}
      <div className="space-y-3 p-4 bg-gray-50 border border-gray-200 rounded-xl">
        <h4 className="font-medium text-gray-900">AI Mode</h4>
        <div className="grid grid-cols-2 gap-3">
          <button
            onClick={() => handleModeChange('cloud')}
            className={`flex items-center justify-center gap-2 p-3 rounded-lg border-2 transition-all ${
              selectedMode === 'cloud'
                ? 'border-blue-500 bg-blue-50 text-blue-700'
                : 'border-gray-200 bg-white text-gray-600 hover:border-gray-300'
            }`}
          >
            <Cloud size={20} />
            <span className="font-medium">Cloud AI</span>
          </button>
          <button
            onClick={() => handleModeChange('local')}
            className={`flex items-center justify-center gap-2 p-3 rounded-lg border-2 transition-all ${
              selectedMode === 'local'
                ? 'border-purple-500 bg-purple-50 text-purple-700'
                : 'border-gray-200 bg-white text-gray-600 hover:border-gray-300'
            }`}
          >
            <HardDrive size={20} />
            <span className="font-medium">Local AI</span>
          </button>
        </div>
        <p className="text-xs text-gray-600">
          {selectedMode === 'cloud' 
            ? 'Fast and powerful, requires internet and API keys'
            : 'Private and offline, runs on your device'}
        </p>
      </div>

      {/* Provider Selection */}
      <div className="space-y-3 p-4 bg-blue-50 border border-blue-200 rounded-xl">
        <h4 className="font-medium text-blue-900">AI Provider</h4>
        <select
          value={selectedProvider}
          onChange={(e) => handleProviderChange(e.target.value)}
          className="w-full text-sm border border-blue-300 rounded-md p-2 bg-white focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
        >
          {currentMode?.providers.map(provider => (
            <option key={provider.id} value={provider.id}>
              {provider.name}
            </option>
          ))}
        </select>
      </div>

      {/* Model Selection */}
      {selectedMode === 'cloud' ? (
        <div className="space-y-3 p-4 bg-indigo-50 border border-indigo-200 rounded-xl">
          <h4 className="font-medium text-indigo-900">AI Model</h4>
          <select
            value={currentModel}
            onChange={(e) => onModelChange(e.target.value)}
            className="w-full text-sm border border-indigo-300 rounded-md p-2 bg-white focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
          >
            {currentProvider?.models.map(model => (
              <option key={model.value} value={model.value}>
                {model.label} - {model.description}
              </option>
            ))}
          </select>
          <p className="text-xs text-indigo-600">
            Different models offer varying levels of quality and speed
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          <h4 className="font-medium text-purple-900 px-4">Available Models</h4>
          {/* For local models, we'll show the current provider's models info */}
          <div className="bg-purple-50 border border-purple-200 rounded-xl p-4">
            <p className="text-sm text-purple-800 mb-3">
              {selectedProvider === 'qwen' && 'Qwen models offer excellent multilingual support and reasoning capabilities.'}
              {selectedProvider === 'mistral' && 'Mistral models are known for their efficiency and strong performance.'}
              {selectedProvider === 'llama' && 'Meta Llama models provide state-of-the-art open-source AI capabilities.'}
            </p>
            <p className="text-xs text-purple-600">
              Download and manage models below
            </p>
          </div>
        </div>
      )}

      {/* API Key Input for Cloud Providers */}
      {selectedMode === 'cloud' && selectedProvider === 'openai' && (
        <div className="space-y-3 p-4 bg-blue-50 border border-blue-200 rounded-xl">
          <h4 className="font-medium text-blue-900">OpenAI API Key</h4>
          <ApiKeyInput
            apiKey={openaiApiKey}
            setApiKey={setOpenaiApiKey}
            helpText="Get your API key from platform.openai.com"
          />
        </div>
      )}

      {selectedMode === 'cloud' && selectedProvider === 'anthropic' && (
        <div className="space-y-3 p-4 bg-purple-50 border border-purple-200 rounded-xl">
          <h4 className="font-medium text-purple-900">Anthropic API Key</h4>
          <div className="flex gap-2">
            <Input
              type="password"
              placeholder="sk-ant-..."
              value={anthropicApiKey}
              onChange={(e) => setAnthropicApiKey(e.target.value)}
              className="flex-1 text-sm border-purple-300 focus:border-purple-500"
            />
            <Button
              variant="outline"
              size="sm"
              onClick={() => pasteFromClipboard(setAnthropicApiKey)}
              className="border-purple-300 text-purple-700 hover:bg-purple-50"
            >
              Paste
            </Button>
          </div>
          <p className="text-xs text-purple-600">
            Get your API key from console.anthropic.com
          </p>
        </div>
      )}

      {/* Local Model Manager */}
      {selectedMode === 'local' && (
        <div className="space-y-4">
          <LocalModelManager 
            filterProvider={selectedProvider}
            onModelSelect={onModelChange}
            selectedModel={currentModel}
          />
        </div>
      )}
    </div>
  );
}