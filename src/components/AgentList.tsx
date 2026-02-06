import React from 'react';
import { Agent } from '../types/agent';
import { AgentCard } from './AgentCard';

interface AgentListProps {
  agents: Agent[];
  onEdit: (agent: Agent) => void;
  onDelete: (agent: Agent) => void;
  deletingAgentId?: string;
}

export function AgentList({ agents, onEdit, onDelete, deletingAgentId }: AgentListProps) {
  if (agents.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        <p>No agents configured yet.</p>
        <p className="text-sm mt-2">Click "Add Agent" to create your first agent.</p>
      </div>
    );
  }

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
      {agents.map((agent) => (
        <AgentCard
          key={agent.id}
          agent={agent}
          onEdit={onEdit}
          onDelete={onDelete}
          isDeleting={deletingAgentId === agent.id}
        />
      ))}
    </div>
  );
}
