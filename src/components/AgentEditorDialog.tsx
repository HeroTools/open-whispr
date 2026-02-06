import React, { useState, useEffect } from 'react';
import { Agent } from '../types/agent';
import { validateAgent } from '../utils/agentValidation';
import { generateAgentId, loadAgents } from '../utils/agentStorage';
import ModelRegistry from '../models/ModelRegistry';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from './ui/dialog';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Textarea } from './ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from './ui/select';

interface AgentEditorDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  agent: Agent | null;
  onSave: (agent: Agent) => void;
}

export function AgentEditorDialog({
  open,
  onOpenChange,
  agent,
  onSave,
}: AgentEditorDialogProps) {
  const [name, setName] = useState('');
  const [isDefault, setIsDefault] = useState(false);
  const [aiProvider, setAiProvider] = useState('openai');
  const [aiModel, setAiModel] = useState('');
  const [customInstructions, setCustomInstructions] = useState('');
  const [errors, setErrors] = useState<string[]>([]);

  const isEditMode = agent !== null;
  const registry = ModelRegistry.getInstance();
  const cloudProviders = registry.getCloudProviders();
  const localProviders = registry.getAllProviders();

  // Combine cloud and local providers
  const allProviders = [
    ...cloudProviders.map(p => ({ id: p.id, name: p.name })),
    { id: 'local', name: 'Local Models' }
  ];

  // Get models for selected provider
  const getModelsForProvider = () => {
    if (aiProvider === 'local') {
      // Get all local models from all local providers
      const allModels: Array<{ id: string; name: string }> = [];
      localProviders.forEach(provider => {
        provider.models.forEach(model => {
          allModels.push({ id: model.id, name: `${model.name} (${provider.name})` });
        });
      });
      return allModels;
    } else {
      // Get cloud models
      const provider = cloudProviders.find(p => p.id === aiProvider);
      return provider?.models || [];
    }
  };

  const availableModels = getModelsForProvider();

  // Initialize form when agent changes
  useEffect(() => {
    if (agent) {
      setName(agent.name);
      setIsDefault(agent.isDefault);
      setAiProvider(agent.aiProvider);
      setAiModel(agent.aiModel);
      setCustomInstructions(agent.customInstructions || '');
    } else {
      // Reset for new agent
      setName('');
      setIsDefault(false);
      setAiProvider('openai');
      setAiModel('');
      setCustomInstructions('');
    }
    setErrors([]);
  }, [agent, open]);

  // Auto-select first model when provider changes
  useEffect(() => {
    if (!isEditMode || aiProvider !== agent?.aiProvider) {
      const models = getModelsForProvider();
      if (models.length > 0 && !aiModel) {
        setAiModel(models[0].id);
      }
    }
  }, [aiProvider]);

  const handleSave = () => {
    const config = loadAgents();
    const existingAgents = config.agents.filter(a => a.id !== agent?.id);

    const agentData: Partial<Agent> = {
      name: name.trim(),
      isDefault,
      aiProvider,
      aiModel,
      customInstructions: customInstructions.trim() || undefined,
    };

    const validation = validateAgent(agentData, existingAgents, agent?.id);

    if (!validation.valid) {
      setErrors(validation.errors);
      return;
    }

    const savedAgent: Agent = {
      ...agentData,
      id: agent?.id || generateAgentId(),
      name: agentData.name!,
      aiProvider: agentData.aiProvider!,
      aiModel: agentData.aiModel!,
      isDefault: agentData.isDefault!,
      createdAt: agent?.createdAt || Date.now(),
      updatedAt: Date.now(),
    };

    onSave(savedAgent);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[525px]">
        <DialogHeader>
          <DialogTitle>{isEditMode ? 'Edit Agent' : 'Create Agent'}</DialogTitle>
          <DialogDescription>
            {isEditMode
              ? 'Update the configuration for this agent.'
              : 'Create a new agent with custom AI settings.'}
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 py-4">
          {errors.length > 0 && (
            <div className="bg-destructive/15 text-destructive text-sm p-3 rounded-md">
              {errors.map((error, index) => (
                <div key={index}>• {error}</div>
              ))}
            </div>
          )}

          <div className="grid gap-2">
            <Label htmlFor="name">Agent Name</Label>
            <Input
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g., Jarvis, Assistant"
              maxLength={50}
            />
          </div>

          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="isDefault"
              checked={isDefault}
              onChange={(e) => setIsDefault(e.target.checked)}
              className="h-4 w-4 rounded border-gray-300"
            />
            <Label htmlFor="isDefault" className="cursor-pointer">
              Set as default agent
            </Label>
          </div>

          <div className="grid gap-2">
            <Label htmlFor="provider">AI Provider</Label>
            <Select value={aiProvider} onValueChange={setAiProvider}>
              <SelectTrigger id="provider">
                <SelectValue placeholder="Select provider" />
              </SelectTrigger>
              <SelectContent>
                {allProviders.map((provider) => (
                  <SelectItem key={provider.id} value={provider.id}>
                    {provider.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid gap-2">
            <Label htmlFor="model">AI Model</Label>
            <Select value={aiModel} onValueChange={setAiModel}>
              <SelectTrigger id="model">
                <SelectValue placeholder="Select model" />
              </SelectTrigger>
              <SelectContent>
                {availableModels.map((model) => (
                  <SelectItem key={model.id} value={model.id}>
                    {model.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid gap-2">
            <Label htmlFor="instructions">
              Custom Instructions{' '}
              <span className="text-muted-foreground font-normal">(Optional)</span>
            </Label>
            <Textarea
              id="instructions"
              value={customInstructions}
              onChange={(e) => setCustomInstructions(e.target.value)}
              placeholder="Add custom instructions to modify this agent's behavior..."
              rows={4}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSave}>
            {isEditMode ? 'Save Changes' : 'Create Agent'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
