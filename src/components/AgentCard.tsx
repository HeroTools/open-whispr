import React from 'react';
import { Agent } from '../types/agent';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { Edit, Trash2 } from 'lucide-react';

interface AgentCardProps {
  agent: Agent;
  onEdit: (agent: Agent) => void;
  onDelete: (agent: Agent) => void;
  isDeleting?: boolean;
}

export function AgentCard({ agent, onEdit, onDelete, isDeleting = false }: AgentCardProps) {
  return (
    <Card className="relative">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <CardTitle className="text-lg flex items-center gap-2">
              {agent.name}
              {agent.isDefault && (
                <Badge variant="secondary" className="text-xs">
                  Default
                </Badge>
              )}
            </CardTitle>
            <p className="text-sm text-muted-foreground mt-1">
              {agent.aiProvider} • {agent.aiModel}
            </p>
          </div>
          <div className="flex gap-2">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => onEdit(agent)}
              disabled={isDeleting}
            >
              <Edit className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => onDelete(agent)}
              disabled={isDeleting || agent.isDefault}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </CardHeader>
      {agent.customInstructions && (
        <CardContent>
          <p className="text-sm text-muted-foreground line-clamp-2">
            {agent.customInstructions}
          </p>
        </CardContent>
      )}
    </Card>
  );
}
