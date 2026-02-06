import React, { useState, useEffect } from 'react';
import { Agent } from '../types/agent';
import {
  loadAgents,
  addAgent,
  updateAgent,
  deleteAgent,
  setDefaultAgent,
} from '../utils/agentStorage';
import { canDeleteAgent } from '../utils/agentValidation';
import { AgentList } from './AgentList';
import { AgentEditorDialog } from './AgentEditorDialog';
import { Button } from './ui/button';
import { Plus } from 'lucide-react';
import { useToast } from '../hooks/useToast';

export function AgentManagementPage() {
  const [agents, setAgents] = useState<Agent[]>([]);
  const [editingAgent, setEditingAgent] = useState<Agent | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [deletingAgentId, setDeletingAgentId] = useState<string | undefined>();
  const { toast } = useToast();

  // Load agents on mount
  useEffect(() => {
    refreshAgents();
  }, []);

  const refreshAgents = () => {
    const config = loadAgents();
    setAgents(config.agents);
  };

  const handleAddAgent = () => {
    setEditingAgent(null);
    setIsDialogOpen(true);
  };

  const handleEditAgent = (agent: Agent) => {
    setEditingAgent(agent);
    setIsDialogOpen(true);
  };

  const handleSaveAgent = (agent: Agent) => {
    try {
      if (editingAgent) {
        // Update existing agent
        updateAgent(agent);
        toast({
          title: 'Agent Updated',
          description: `${agent.name} has been updated successfully.`,
        });
      } else {
        // Add new agent
        addAgent(agent);
        toast({
          title: 'Agent Created',
          description: `${agent.name} has been created successfully.`,
        });
      }
      refreshAgents();
    } catch (error) {
      toast({
        title: 'Error',
        description: (error as Error).message,
        variant: 'destructive',
      });
    }
  };

  const handleDeleteAgent = async (agent: Agent) => {
    const config = loadAgents();
    const validation = canDeleteAgent(agent, config);

    if (!validation.valid) {
      toast({
        title: 'Cannot Delete Agent',
        description: validation.errors[0],
        variant: 'destructive',
      });
      return;
    }

    // Show confirmation
    const confirmed = await window.electronAPI?.showDialog({
      type: 'question',
      title: 'Delete Agent',
      message: `Are you sure you want to delete "${agent.name}"?`,
      buttons: ['Cancel', 'Delete'],
      defaultId: 0,
      cancelId: 0,
    });

    if (confirmed?.response === 1) {
      try {
        setDeletingAgentId(agent.id);
        deleteAgent(agent.id);
        toast({
          title: 'Agent Deleted',
          description: `${agent.name} has been deleted.`,
        });
        refreshAgents();
      } catch (error) {
        toast({
          title: 'Error',
          description: (error as Error).message,
          variant: 'destructive',
        });
      } finally {
        setDeletingAgentId(undefined);
      }
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Agents</h1>
          <p className="text-muted-foreground mt-2">
            Manage your AI agents and their configurations
          </p>
        </div>
        <Button onClick={handleAddAgent}>
          <Plus className="h-4 w-4 mr-2" />
          Add Agent
        </Button>
      </div>

      <AgentList
        agents={agents}
        onEdit={handleEditAgent}
        onDelete={handleDeleteAgent}
        deletingAgentId={deletingAgentId}
      />

      <AgentEditorDialog
        open={isDialogOpen}
        onOpenChange={setIsDialogOpen}
        agent={editingAgent}
        onSave={handleSaveAgent}
      />
    </div>
  );
}
